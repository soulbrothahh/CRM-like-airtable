// Server-only Shopify Admin API adapter (read-only).
//
// Auth: Dev Dashboard app credentials — SHOPIFY_CLIENT_ID/SECRET are
// exchanged server-side for a short-lived Admin access token
// (client-credentials grant) and cached until just before expiry. Scopes:
// read_customers, read_orders, read_fulfillments. Secrets never reach the
// browser.

const API_VERSION = "2025-01";

export function shopifyConfigured(): boolean {
  return Boolean(
    process.env.SHOPIFY_CLIENT_ID &&
      process.env.SHOPIFY_CLIENT_SECRET &&
      process.env.SHOPIFY_STORE_DOMAIN
  );
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.token;
  const domain = process.env.SHOPIFY_STORE_DOMAIN!;
  const res = await fetch(`https://${domain}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.SHOPIFY_CLIENT_ID,
      client_secret: process.env.SHOPIFY_CLIENT_SECRET,
      grant_type: "client_credentials",
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Shopify token exchange failed (${res.status}).`);
  }
  const body = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!body.access_token) throw new Error("Shopify token exchange returned no token.");
  cachedToken = {
    token: body.access_token,
    expiresAt: Date.now() + Math.max(60, (body.expires_in ?? 86400) - 120) * 1000,
  };
  return body.access_token;
}

async function adminGet(path: string): Promise<Record<string, unknown>> {
  const token = await getToken();
  const domain = process.env.SHOPIFY_STORE_DOMAIN!;
  const res = await fetch(`https://${domain}/admin/api/${API_VERSION}${path}`, {
    headers: { "X-Shopify-Access-Token": token, Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Shopify responded ${res.status} for ${path}.`);
  return (await res.json()) as Record<string, unknown>;
}

export interface ShopifyShipmentInfo {
  customerId: number;
  orderName: string;
  shippingName: string;
  shippingAddress: string;
  trackingNumber: string;
  fulfillmentStatus: string; // "", "pending", "success", "delivered", …
  deliveredAt: string | null;
  shippedAt: string | null;
}

/** Find the customer's most recent order and its fulfillment/tracking. */
export async function findShipmentInfo(
  email: string,
  phone: string
): Promise<ShopifyShipmentInfo | null> {
  type Row = Record<string, unknown>;
  let customers: Row[] = [];
  if (email) {
    const body = await adminGet(
      `/customers/search.json?query=${encodeURIComponent(`email:${email}`)}&limit=3`
    );
    customers = (body.customers as Row[]) ?? [];
  }
  if (customers.length === 0 && phone) {
    const body = await adminGet(
      `/customers/search.json?query=${encodeURIComponent(`phone:${phone}`)}&limit=3`
    );
    customers = (body.customers as Row[]) ?? [];
  }
  if (customers.length === 0) return null;
  const customerId = Number(customers[0].id);

  const ordersBody = await adminGet(
    `/orders.json?customer_id=${customerId}&status=any&limit=5&order=created_at+desc`
  );
  const orders = (ordersBody.orders as Row[]) ?? [];
  if (orders.length === 0) return null;
  const order = orders[0];

  const addr = (order.shipping_address ?? {}) as Row;
  const addressParts = [
    addr.address1,
    addr.address2,
    addr.city,
    addr.province_code ?? addr.province,
    addr.zip,
  ]
    .map((v) => String(v ?? "").trim())
    .filter(Boolean);
  const fulfillments = (order.fulfillments as Row[]) ?? [];
  const f = fulfillments[fulfillments.length - 1] ?? {};
  const shipmentStatus = String(f.shipment_status ?? "");
  const status = shipmentStatus || String(f.status ?? "");

  return {
    customerId,
    orderName: String(order.name ?? ""),
    shippingName: String(addr.name ?? "").trim(),
    shippingAddress: addressParts.join(", "),
    trackingNumber: String(f.tracking_number ?? ""),
    fulfillmentStatus: status,
    deliveredAt: shipmentStatus === "delivered" ? String(f.updated_at ?? "") || null : null,
    shippedAt: f.created_at ? String(f.created_at) : null,
  };
}
