import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabaseAdmin";
import { contactIdForEmailId, recomputeLeadScore } from "@/lib/emailServer";

// Open-tracking pixel. Referenced from every tracked email; logs the FIRST
// open per email onto the contact's timeline and recomputes their score.
// Always returns the gif, even on errors — never break the email render.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// 1x1 transparent GIF
const PIXEL = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

function gif(): NextResponse {
  return new NextResponse(PIXEL, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
    },
  });
}

export async function GET(req: Request) {
  try {
    const emailId = new URL(req.url).searchParams.get("e");
    const sb = getAdminClient();
    if (!emailId || !sb) return gif();

    const contactId = await contactIdForEmailId(sb, emailId);
    if (!contactId) return gif();

    // Only the first open per email counts (repeat renders are noise).
    const { data: existing } = await sb
      .from("activities")
      .select("id")
      .eq("type", "email_open")
      .eq("metadata->>email_id", emailId)
      .limit(1)
      .maybeSingle();
    if (existing) return gif();

    const { data: sentAct } = await sb
      .from("activities")
      .select("metadata")
      .eq("type", "email_sent")
      .eq("metadata->>email_id", emailId)
      .limit(1)
      .maybeSingle();
    const subject =
      ((sentAct?.metadata as Record<string, unknown>)?.subject as string) || "";

    const nowIso = new Date().toISOString();
    await sb.from("activities").insert({
      contact_id: contactId,
      visitor_id: null,
      source: "email",
      type: "email_open",
      title: subject ? `Opened “${subject.slice(0, 160)}”` : "Opened an email",
      url: "",
      metadata: { email_id: emailId },
      occurred_at: nowIso,
      created_at: nowIso,
    });
    await recomputeLeadScore(sb, contactId);
  } catch {
    /* never fail the pixel */
  }
  return gif();
}
