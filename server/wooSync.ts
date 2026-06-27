/**
 * Shared WooCommerce product sync logic.
 * Used by both the manual tRPC mutation (admin panel) and the
 * automated /api/scheduled/woo-sync Heartbeat handler.
 */

import { createClass, getIntegrationSettings, listClasses, listLocations } from "./db";

export type SyncResult = {
  id: number;
  name: string;
  variationId: number | null;
  variationName: string | null;
  action: "created" | "skipped";
  classId?: number;
  reason?: string;
};

export type SyncSummary = {
  results: SyncResult[];
  created: number;
  skipped: number;
  total: number;
};

// ─── Date parsing helpers ─────────────────────────────────────────────────────

function parseAdvancedDate(
  meta: any,
  metaMap?: Record<string, any>
): { start: Date; end: Date } | null {
  if (!meta) return null;
  try {
    // Case 1 (PREFERRED): class_date__config JSON
    const configRaw = metaMap?.["class_date__config"];
    if (configRaw) {
      try {
        const cfg = typeof configRaw === "string" ? JSON.parse(configRaw) : configRaw;
        const startStr = cfg.date || cfg.start_date;
        const startTime = (cfg.time || cfg.start_time || "08:00").replace(/(\d+:\d+).*/, "$1");
        const endStr = cfg.end_date;
        const endTime = (cfg.end_time || "17:00").replace(/(\d+:\d+).*/, "$1");
        if (startStr) {
          const start = new Date(`${startStr}T${startTime}:00`);
          const end = endStr ? new Date(`${endStr}T${endTime}:00`) : new Date(start.getTime() + 8 * 3600000);
          if (!isNaN(start.getTime())) return { start, end };
        }
      } catch (_) { /* fall through */ }
    }

    // Case 2: Unix timestamp
    const asNum = typeof meta === "string" ? parseInt(meta, 10) : (typeof meta === "number" ? meta : NaN);
    if (!isNaN(asNum) && asNum > 1000000000) {
      const start = new Date(asNum * 1000);
      let end: Date;
      if (metaMap) {
        const endTs = metaMap["class_date__end_date"];
        const endNum = endTs ? parseInt(String(endTs), 10) : NaN;
        end = (!isNaN(endNum) && endNum > asNum)
          ? new Date(endNum * 1000)
          : new Date(start.getTime() + 8 * 3600000);
      } else {
        end = new Date(start.getTime() + 8 * 3600000);
      }
      if (!isNaN(start.getTime())) return { start, end };
    }

    // Case 3: JSON string
    if (typeof meta === "string") {
      try {
        const obj = JSON.parse(meta);
        const startStr = obj.date || obj.start_date || obj.start;
        const startTime = (obj.time || obj.start_time || "08:00").replace(/(\d+:\d+).*/, "$1");
        const endStr = obj.end_date || obj.end;
        const endTime = (obj.end_time || "17:00").replace(/(\d+:\d+).*/, "$1");
        if (!startStr) return null;
        const start = new Date(`${startStr}T${startTime}:00`);
        const end = endStr ? new Date(`${endStr}T${endTime}:00`) : new Date(start.getTime() + 8 * 3600000);
        if (!isNaN(start.getTime())) return { start, end };
      } catch (_) { /* not JSON */ }

      // Case 4: Pipe-delimited string
      const parts = meta.split("|");
      const start = new Date(parts[0]?.trim());
      const end = parts[1] ? new Date(parts[1].trim()) : new Date(start.getTime() + 8 * 3600000);
      if (!isNaN(start.getTime())) return { start, end };
    }

    // Case 5: Object form
    if (typeof meta === "object" && meta !== null) {
      const startStr = meta.start_date || meta.date || meta.start;
      const startTime = (meta.start_time || meta.time || "08:00").replace(/(\d+:\d+).*/, "$1");
      const endStr = meta.end_date || meta.end;
      const endTime = (meta.end_time || "17:00").replace(/(\d+:\d+).*/, "$1");
      if (!startStr) return null;
      const start = new Date(`${startStr}T${startTime}:00`);
      const end = endStr ? new Date(`${endStr}T${endTime}:00`) : new Date(start.getTime() + 8 * 3600000);
      if (!isNaN(start.getTime())) return { start, end };
    }

    return null;
  } catch (_) { return null; }
}

// ─── Main sync function ───────────────────────────────────────────────────────

export async function runWooSync(): Promise<SyncSummary> {
  const settings = await getIntegrationSettings();
  if (!settings?.wooBaseUrl || !settings?.wooConsumerKey || !settings?.wooConsumerSecret) {
    throw new Error("WooCommerce credentials not configured");
  }

  const baseUrl = settings.wooBaseUrl.replace(/\/$/, "");
  const auth = Buffer.from(`${settings.wooConsumerKey}:${settings.wooConsumerSecret}`).toString("base64");

  // Fetch up to 100 published products
  const url = `${baseUrl}/wp-json/wc/v3/products?per_page=100&status=publish`;
  const response = await fetch(url, { headers: { Authorization: `Basic ${auth}` } });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`WooCommerce API error ${response.status}: ${text.slice(0, 200)}`);
  }
  const products: any[] = await response.json();

  // Load existing classes to detect already-mapped products
  const existingClasses = await listClasses();
  const mappedProductIds = new Set(existingClasses.map((c) => c.wooProductId).filter(Boolean));
  const mappedVariationIds = new Set(existingClasses.map((c) => c.wooVariationId).filter(Boolean));

  // Load locations for fuzzy matching
  const allLocations = await listLocations();

  function matchLocation(locationText: string | null): number | undefined {
    if (!locationText) return undefined;
    const lower = locationText.toLowerCase();
    const match = allLocations.find((loc) =>
      lower.includes(loc.name.toLowerCase()) || loc.name.toLowerCase().includes(lower.split(",")[0]?.trim() ?? "")
    );
    return match?.id;
  }

  const results: SyncResult[] = [];

  for (const product of products) {
    const metaData: Record<string, any> = {};
    for (const m of (product.meta_data ?? [])) {
      metaData[m.key] = m.value;
    }

    const classDateMeta = metaData["class_date"];
    const classLocation = metaData["class_location"] || null;
    const stockQty = product.stock_quantity;
    const capacity = (stockQty && stockQty > 0) ? stockQty : 20;
    const locationId = matchLocation(classLocation);
    const dates = parseAdvancedDate(classDateMeta, metaData);

    if (product.type === "variable" && product.variations?.length > 0) {
      try {
        const varUrl = `${baseUrl}/wp-json/wc/v3/products/${product.id}/variations?per_page=100`;
        const varRes = await fetch(varUrl, { headers: { Authorization: `Basic ${auth}` } });
        if (varRes.ok) {
          const variations: any[] = await varRes.json();
          for (const v of variations) {
            const attrLabel = v.attributes?.map((a: any) => a.option).join(", ") || `Variation #${v.id}`;
            const varId = String(v.id);
            if (mappedVariationIds.has(varId)) {
              results.push({ id: product.id, name: product.name, variationId: v.id, variationName: attrLabel, action: "skipped", reason: "Already mapped" });
              continue;
            }
            const varMeta: Record<string, any> = {};
            for (const m of (v.meta_data ?? [])) varMeta[m.key] = m.value;
            const varDates = parseAdvancedDate(varMeta["class_date"], varMeta) ?? dates;
            if (!varDates) {
              results.push({ id: product.id, name: product.name, variationId: v.id, variationName: attrLabel, action: "skipped", reason: "No class_date found" });
              continue;
            }
            const title = `${product.name}${attrLabel ? ` – ${attrLabel}` : ""}`;
            const classId = await createClass({
              title,
              classType: product.categories?.[0]?.name ?? undefined,
              description: classLocation ?? undefined,
              locationId,
              startDatetime: varDates.start,
              endDatetime: varDates.end,
              capacity,
              price: v.price || product.price || undefined,
              wooProductId: String(product.id),
              wooVariationId: varId,
              status: "upcoming",
              isActive: true,
            } as any);
            results.push({ id: product.id, name: product.name, variationId: v.id, variationName: attrLabel, action: "created", classId });
          }
          continue;
        }
      } catch (_) { /* fall through to simple product */ }
    }

    // Simple product
    const productId = String(product.id);
    if (mappedProductIds.has(productId)) {
      results.push({ id: product.id, name: product.name, variationId: null, variationName: null, action: "skipped", reason: "Already mapped" });
      continue;
    }
    if (!dates) {
      results.push({ id: product.id, name: product.name, variationId: null, variationName: null, action: "skipped", reason: "No class_date found" });
      continue;
    }
    const classId = await createClass({
      title: product.name,
      classType: product.categories?.[0]?.name ?? undefined,
      description: classLocation ?? undefined,
      locationId,
      startDatetime: dates.start,
      endDatetime: dates.end,
      capacity,
      price: product.price || undefined,
      wooProductId: productId,
      status: "upcoming",
      isActive: true,
    } as any);
    results.push({ id: product.id, name: product.name, variationId: null, variationName: null, action: "created", classId });
  }

  const created = results.filter((r) => r.action === "created").length;
  const skipped = results.filter((r) => r.action === "skipped").length;
  return { results, created, skipped, total: results.length };
}
