import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabaseAdmin";
import { computeScore } from "@/lib/scoring";
import type { Activity, ActivitySource, ActivityType } from "@/lib/types";

// Public web-analytics ingestion endpoint. The tracking snippet on the NuKava
// marketing site POSTs signals here. Anonymous visits are stored by visitor_id;
// a form fill (`identify`) finds-or-creates a contact and stitches all of that
// device's prior activity onto the record, then recomputes the lead score.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: CORS });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

const VALID_TYPES: ActivityType[] = [
  "page_view",
  "session",
  "form_submit",
  "email_sent",
  "email_open",
  "email_click",
  "email_reply",
  "social_follow",
  "social_mention",
  "social_dm",
  "note",
];

interface Identify {
  email?: string;
  name?: string;
  phone?: string;
  instagram?: string;
  tiktok?: string;
  city?: string;
  state?: string;
}

interface TrackBody {
  visitor_id?: string;
  type?: ActivityType;
  source?: ActivitySource;
  title?: string;
  url?: string;
  properties?: Record<string, unknown>;
  identify?: Identify;
  occurred_at?: string;
}

export async function POST(req: Request) {
  const sb = getAdminClient();
  if (!sb) {
    return json(
      {
        error:
          "Tracking is not configured. Set SUPABASE_SERVICE_ROLE_KEY (and NEXT_PUBLIC_SUPABASE_URL) in your Vercel project.",
      },
      503
    );
  }

  let body: TrackBody;
  try {
    body = (await req.json()) as TrackBody;
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  const visitorId = (body.visitor_id || "").trim() || null;
  const type: ActivityType = VALID_TYPES.includes(body.type as ActivityType)
    ? (body.type as ActivityType)
    : "page_view";
  const occurredAt = body.occurred_at || new Date().toISOString();

  if (!visitorId && !body.identify?.email) {
    return json({ error: "Missing visitor_id or identify.email." }, 400);
  }

  // 1) Resolve the contact: identify (form fill) finds-or-creates and stitches.
  let contactId: string | null = null;
  if (body.identify?.email || type === "form_submit") {
    contactId = await resolveContact(sb, body.identify ?? {}, visitorId);
  } else if (visitorId) {
    // Already-known device → attach this signal to the same contact.
    const { data } = await sb
      .from("contacts")
      .select("id")
      .eq("visitor_id", visitorId)
      .limit(1)
      .maybeSingle();
    contactId = (data?.id as string) ?? null;
  }

  // 2) Record the activity.
  const { error: insErr } = await sb.from("activities").insert({
    contact_id: contactId,
    visitor_id: visitorId,
    source: body.source || (type === "form_submit" ? "form" : "web"),
    type,
    title: (body.title || defaultTitle(type)).slice(0, 240),
    url: body.url || "",
    metadata: body.properties || {},
    occurred_at: occurredAt,
    created_at: new Date().toISOString(),
  });
  if (insErr) return json({ error: insErr.message }, 500);

  // 3) If we know who this is, recompute their lead score.
  let score: number | undefined;
  if (contactId) {
    score = await recomputeScore(sb, contactId);
  }

  return json({ ok: true, contact_id: contactId, score });
}

async function resolveContact(
  sb: NonNullable<ReturnType<typeof getAdminClient>>,
  identify: Identify,
  visitorId: string | null
): Promise<string | null> {
  const email = (identify.email || "").trim().toLowerCase();
  let contactId: string | null = null;

  if (email) {
    const { data } = await sb
      .from("contacts")
      .select("id")
      .ilike("email", email)
      .limit(1)
      .maybeSingle();
    if (data?.id) contactId = data.id as string;
  }

  if (!contactId) {
    const ts = new Date().toISOString();
    const { data, error } = await sb
      .from("contacts")
      .insert({
        name: identify.name || email || "Website lead",
        email,
        phone: identify.phone || "",
        instagram: identify.instagram || "",
        tiktok: identify.tiktok || "",
        city: identify.city || "",
        state: identify.state || "",
        contact_type: "Other",
        status: "New Lead",
        source: "Website form",
        outreach_status: "Not contacted",
        visitor_id: visitorId,
        lead_score: 0,
        created_at: ts,
        updated_at: ts,
      })
      .select("id")
      .single();
    if (error) throw error;
    contactId = data.id as string;
  } else if (visitorId) {
    // Keep the most recent device on the record.
    await sb.from("contacts").update({ visitor_id: visitorId }).eq("id", contactId);
  }

  // Stitch any earlier anonymous activity from this device onto the contact.
  if (visitorId && contactId) {
    await sb
      .from("activities")
      .update({ contact_id: contactId })
      .eq("visitor_id", visitorId)
      .is("contact_id", null);
  }

  return contactId;
}

async function recomputeScore(
  sb: NonNullable<ReturnType<typeof getAdminClient>>,
  contactId: string
): Promise<number | undefined> {
  const { data } = await sb
    .from("activities")
    .select("*")
    .eq("contact_id", contactId);
  const { score } = computeScore((data ?? []) as Activity[]);
  await sb
    .from("contacts")
    .update({ lead_score: score, lead_score_updated_at: new Date().toISOString() })
    .eq("id", contactId);
  return score;
}

function defaultTitle(type: ActivityType): string {
  switch (type) {
    case "page_view":
      return "Viewed a page";
    case "session":
      return "Visited the site";
    case "form_submit":
      return "Submitted a form";
    case "email_open":
      return "Opened an email";
    case "email_click":
      return "Clicked an email link";
    case "email_reply":
      return "Replied to an email";
    case "email_sent":
      return "Email sent";
    case "social_follow":
      return "Followed on social";
    case "social_mention":
      return "Mentioned on social";
    case "social_dm":
      return "Sent a DM";
    default:
      return "Activity";
  }
}
