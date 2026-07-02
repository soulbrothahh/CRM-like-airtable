import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabaseAdmin";
import { contactIdForEmailId, recomputeLeadScore } from "@/lib/emailServer";

// Click-tracking redirect. Tracked emails wrap their links through here:
// log the click on the contact's timeline, bump the score, then redirect.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const emailId = params.get("e");
  const target = params.get("u");

  // Only ever redirect to http(s) — anything else goes home.
  let dest = "https://nukava.co";
  try {
    const parsed = new URL(target ?? "");
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      dest = parsed.toString();
    }
  } catch {
    /* fall through to default */
  }

  try {
    const sb = getAdminClient();
    if (emailId && sb) {
      const contactId = await contactIdForEmailId(sb, emailId);
      if (contactId) {
        // A click implies an open — clicks are logged every time (high intent).
        const nowIso = new Date().toISOString();
        await sb.from("activities").insert({
          contact_id: contactId,
          visitor_id: null,
          source: "email",
          type: "email_click",
          title: "Clicked a link in an email",
          url: dest,
          metadata: { email_id: emailId },
          occurred_at: nowIso,
          created_at: nowIso,
        });
        await recomputeLeadScore(sb, contactId);
      }
    }
  } catch {
    /* never block the redirect */
  }

  return NextResponse.redirect(dest, 302);
}
