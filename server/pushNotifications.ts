import webpush from "web-push";
import { getDb } from "./db";
import { pushSubscriptions } from "../drizzle/schema";
import { eq } from "drizzle-orm";

let vapidInitialized = false;

function ensureVapid() {
  if (vapidInitialized) return;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) throw new Error("VAPID keys not configured");
  webpush.setVapidDetails("mailto:admin@r2bear.com", pub, priv);
  vapidInitialized = true;
}

export function getVapidPublicKey(): string {
  const pub = process.env.VAPID_PUBLIC_KEY;
  if (!pub) throw new Error("VAPID_PUBLIC_KEY not set");
  return pub;
}

export async function saveSubscription(
  userId: number,
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  userAgent?: string
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  // Remove any existing subscription with the same endpoint (re-subscribe)
  await db
    .delete(pushSubscriptions)
    .where(eq(pushSubscriptions.endpoint, subscription.endpoint));

  await db.insert(pushSubscriptions).values({
    userId,
    endpoint: subscription.endpoint,
    p256dh: subscription.keys.p256dh,
    auth: subscription.keys.auth,
    userAgent: userAgent?.slice(0, 512),
  });
}

export async function removeSubscription(endpoint: string) {
  const db = await getDb();
  if (!db) return;
  await db
    .delete(pushSubscriptions)
    .where(eq(pushSubscriptions.endpoint, endpoint));
}

export async function sendPushToAllAdmins(payload: {
  title: string;
  body: string;
  icon?: string;
  url?: string;
}) {
  ensureVapid();
  const db = await getDb();
  if (!db) return;

  const subs = await db.select().from(pushSubscriptions);
  if (subs.length === 0) return;

  const message = JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: payload.icon ?? "/icon-192.png",
    url: payload.url ?? "/",
  });

  const results = await Promise.allSettled(
    subs.map((sub) =>
      webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        message
      )
    )
  );

  // Remove subscriptions that are no longer valid (410 Gone)
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === "rejected") {
      const err = result.reason as any;
      if (err?.statusCode === 410 || err?.statusCode === 404) {
        await removeSubscription(subs[i].endpoint);
      }
    }
  }
}
