import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAdminClient } from "@/lib/supabaseAdmin";
import { findShipmentInfo, shopifyConfigured } from "@/lib/shopify";

// Pull a linked ambassador's Shopify order info (address + tracking) onto
// their sample shipment. Read-only toward Shopify. Auth: Supabase user token.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function authorized(req: Request): Promise<boolean> {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !url || !anon) return false;
  const sb = createClient(url, anon, { auth: { persistSession: false } });
  const { data, error } = await sb.auth.getUser(token);
  return !error && Boolean(data.user);
}

export async function POST(req: Request) {
  if (!(await authorized(req))) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!shopifyConfigured()) {
    return NextResponse.json(
      { error: "Shopify is not connected. Set SHOPIFY_CLIENT_ID / SHOPIFY_CLIENT_SECRET / SHOPIFY_STORE_DOMAIN in Vercel." },
      { status: 503 }
    );
  }
  const sb = getAdminClient();
  if (!sb) return NextResponse.json({ error: "Cloud is not configured." }, { status: 503 });

  const { ambassador_id } = (await req.json().catch(() => ({}))) as { ambassador_id?: string };
  if (!ambassador_id) return NextResponse.json({ error: "Missing ambassador_id." }, { status: 400 });

  const { data: amb } = await sb
    .from("ambassadors")
    .select("id, contact_id, email, first_name, last_name")
    .eq("id", ambassador_id)
    .maybeSingle();
  if (!amb?.contact_id) {
    return NextResponse.json(
      { error: "Link this ambassador to a contact first — shipments attach to contacts." },
      { status: 400 }
    );
  }
  const { data: contact } = await sb
    .from("contacts")
    .select("phone, email")
    .eq("id", amb.contact_id)
    .maybeSingle();

  let info;
  try {
    info = await findShipmentInfo(
      String(amb.email || contact?.email || ""),
      String(contact?.phone || "")
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Shopify lookup failed." },
      { status: 502 }
    );
  }
  if (!info) {
    return NextResponse.json({ ok: true, found: false, message: "No Shopify customer/order matched their email or phone yet." });
  }

  // Fill the newest open shipment, or create one for this order.
  const status =
    info.fulfillmentStatus === "delivered"
      ? "Delivered"
      : info.trackingNumber || info.shippedAt
        ? "Shipped"
        : "Ready";
  const patch = {
    shipping_name: info.shippingName,
    shipping_address: info.shippingAddress,
    tracking_number: info.trackingNumber,
    status,
    shipped_at: info.shippedAt ? info.shippedAt.slice(0, 10) : null,
    delivered_at: info.deliveredAt ? info.deliveredAt.slice(0, 10) : null,
    updated_at: new Date().toISOString(),
  };
  const { data: open } = await sb
    .from("sample_shipments")
    .select("id, status")
    .eq("contact_id", amb.contact_id)
    .not("status", "in", '("Delivered","Followed up")')
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (open) {
    await sb.from("sample_shipments").update(patch).eq("id", open.id);
  } else {
    await sb.from("sample_shipments").insert({
      contact_id: amb.contact_id,
      quantity: 1,
      notes: `Shopify order ${info.orderName}`,
      ...patch,
    });
  }
  // Delivered via Shopify pull → same follow-up task the manual flow creates.
  if (status === "Delivered") {
    const due = new Date();
    due.setDate(due.getDate() + 3);
    const who = `${amb.first_name} ${amb.last_name}`.trim() || amb.email;
    await sb.from("tasks").insert({
      title: `Follow up with ${who} — bottles delivered, content posted?`,
      notes: `Shopify shows order ${info.orderName} delivered. Check in and nudge the first post.`,
      due_date: due.toISOString().slice(0, 10),
      contact_id: amb.contact_id,
    });
  }
  return NextResponse.json({ ok: true, found: true, order: info.orderName, status });
}
