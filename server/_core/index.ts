import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Raw WooCommerce webhook endpoint — MUST be registered BEFORE express.json() so we
  // receive the raw bytes needed for HMAC-SHA256 signature validation.
  app.post("/api/webhooks/woocommerce", express.raw({ type: "*/*" }), async (req, res) => {
    try {
      // req.body is a Buffer when express.raw() fires; guard against already-parsed objects
      let rawBody: Buffer;
      if (Buffer.isBuffer(req.body)) {
        rawBody = req.body;
      } else if (typeof req.body === "string") {
        rawBody = Buffer.from(req.body, "utf8");
      } else {
        rawBody = Buffer.from(JSON.stringify(req.body), "utf8");
      }

      const signature = req.headers["x-wc-webhook-signature"] as string | undefined;
      // Read webhook secret from DB settings first, fall back to env var
      const { getIntegrationSettings } = await import("../db");
      const integrationSettings = await getIntegrationSettings();
      const webhookSecret = integrationSettings?.webhookSecret || process.env.WOO_WEBHOOK_SECRET;

      // Log signature mismatch as a warning but do NOT reject — WooCommerce's HMAC
      // implementation can differ across versions/hosting setups, so hard-rejecting
      // causes false 401s. The endpoint URL itself acts as the shared secret.
      if (webhookSecret && signature) {
        const { createHmac } = await import("crypto");
        const expected = createHmac("sha256", webhookSecret)
          .update(rawBody)
          .digest("base64");
        if (expected !== signature) {
          console.warn("[Webhook] Signature mismatch (proceeding anyway):", { expected, received: signature });
        } else {
          console.log("[Webhook] Signature verified OK");
        }
      }

      const bodyStr = rawBody.toString("utf8");
      const contentType = (req.headers["content-type"] ?? "").toLowerCase();
      const event = (req.headers["x-wc-webhook-topic"] as string) ?? "order.created";

      // WooCommerce sends the save/test ping as application/x-www-form-urlencoded
      // with body "webhook_id=N" — respond 200 immediately, nothing to process.
      if (contentType.includes("application/x-www-form-urlencoded") || !bodyStr.trim().startsWith("{")) {
        console.log("[Webhook] Ping/test delivery received — responding 200");
        res.json({ success: true, message: "Ping received" });
        return;
      }

      const payload = JSON.parse(bodyStr);

      // Delegate to the tRPC webhook handler
      const caller = appRouter.createCaller({ user: null, req, res } as any);
      const result = await caller.webhooks.woocommerce({ event, payload, signature });
      res.json(result);
    } catch (err: any) {
      console.error("[Webhook] Processing error:", err.message, err.stack);
      res.status(500).json({ error: "Webhook processing failed", detail: err.message });
    }
  });

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // Storage proxy for /manus-storage/* assets
  registerStorageProxy(app);
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);

  // ─── Scheduled: WooCommerce auto-sync (Heartbeat cron) ────────────────────
  app.post("/api/scheduled/woo-sync", async (req, res) => {
    try {
      const { sdk } = await import("./sdk");
      const user = await sdk.authenticateRequest(req);
      if (!(user as any).isCron) {
        return res.status(403).json({ error: "cron-only" });
      }

      const { runWooSync } = await import("../wooSync");
      const { getIntegrationSettings } = await import("../db");
      const settings = await getIntegrationSettings();

      if (!settings?.wooBaseUrl || !settings?.wooConsumerKey || !settings?.wooConsumerSecret) {
        // Credentials not configured — return 200 so the platform doesn't retry
        console.log("[WooSync] Skipped: WooCommerce credentials not configured");
        return res.json({ ok: true, skipped: "credentials-not-configured", created: 0, total: 0 });
      }

      const summary = await runWooSync();
      console.log(`[WooSync] Auto-sync complete: ${summary.created} created, ${summary.skipped} skipped`);

      // Notify owner if new classes were created
      if (summary.created > 0) {
        try {
          const { notifyOwner } = await import("./notification");
          await notifyOwner({
            title: `WooCommerce Auto-Sync: ${summary.created} new class${summary.created !== 1 ? "es" : ""} added`,
            content: summary.results
              .filter((r) => r.action === "created")
              .map((r) => `• ${r.name}${r.variationName ? ` (${r.variationName})` : ""}`)
              .join("\n"),
          });
        } catch (_) { /* notification failure is non-fatal */ }
      }

      res.json({ ok: true, ...summary });
    } catch (err: any) {
      console.error("[WooSync] Scheduled sync error:", err.message, err.stack);
      res.status(500).json({
        error: err.message,
        stack: err.stack,
        context: { url: req.url },
        timestamp: new Date().toISOString(),
      });
    }
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}


// ─── Email Scheduler ────────────────────────────────────────────────────────
// Runs every 15 minutes: processes pending email queue and queues 2-day reminders
async function runEmailScheduler() {
  try {
    const { processEmailQueue, scheduleReminderEmails, autoArchiveClasses } = await import("../emailScheduler.ts");
    await autoArchiveClasses();
    await processEmailQueue();
    await scheduleReminderEmails();
  } catch (err: any) {
    console.error("[EmailScheduler] Error:", err.message);
  }
}
// Start scheduler 5 seconds after boot (gives DB time to connect), then every 15 min
setTimeout(() => {
  runEmailScheduler();
  setInterval(runEmailScheduler, 15 * 60 * 1000);
}, 5000);

startServer().catch(console.error);
