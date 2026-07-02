// Server-only helpers for the tracked-email pipeline (send / open / click).
// Never import from client components — used by the /api/email/* routes.
import type { SupabaseClient } from "@supabase/supabase-js";
import { computeScore } from "./scoring";
import type { Activity } from "./types";

export const DEFAULT_FROM = "Taylor at NuKava <taylor@nukava.co>";

export function emailFrom(): string {
  return process.env.EMAIL_FROM || DEFAULT_FROM;
}

export function emailConfigured(): boolean {
  return Boolean(
    process.env.RESEND_API_KEY &&
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

// The pixel/click URLs carry an opaque email_id; the email_sent activity's
// metadata maps it back to the contact.
export async function contactIdForEmailId(
  sb: SupabaseClient,
  emailId: string
): Promise<string | null> {
  const { data } = await sb
    .from("activities")
    .select("contact_id")
    .eq("type", "email_sent")
    .eq("metadata->>email_id", emailId)
    .limit(1)
    .maybeSingle();
  return (data?.contact_id as string) ?? null;
}

export async function recomputeLeadScore(
  sb: SupabaseClient,
  contactId: string
): Promise<number> {
  const { data } = await sb.from("activities").select("*").eq("contact_id", contactId);
  const { score } = computeScore((data ?? []) as Activity[]);
  await sb
    .from("contacts")
    .update({ lead_score: score, lead_score_updated_at: new Date().toISOString() })
    .eq("id", contactId);
  return score;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Personal-looking outreach email: plain paragraphs, tracked links, and an
// open pixel. Deliberately NOT a heavy marketing template — 1:1 outreach
// converts (and delivers) better when it reads like a normal email.
export function buildEmailHtml(
  body: string,
  origin: string,
  emailId: string
): string {
  const escaped = escapeHtml(body.trim());
  // Turn bare URLs into click-tracked links.
  const linked = escaped.replace(/https?:\/\/[^\s<>"']+/g, (url) => {
    const tracked = `${origin}/api/email/click?e=${emailId}&u=${encodeURIComponent(url)}`;
    return `<a href="${tracked}" style="color:#A06B16;">${url}</a>`;
  });
  const paragraphs = linked
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px;">${p.replace(/\n/g, "<br/>")}</p>`)
    .join("");
  return `<div style="font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#222;max-width:600px;">
${paragraphs}<img src="${origin}/api/email/open?e=${emailId}" width="1" height="1" alt="" style="display:block;border:0;"/>
</div>`;
}

export function appOrigin(req: Request): string {
  const env = process.env.NEXT_PUBLIC_APP_URL;
  if (env) return env.replace(/\/$/, "");
  return new URL(req.url).origin;
}
