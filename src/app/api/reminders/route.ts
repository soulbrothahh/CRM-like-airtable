import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Daily follow-up reminder email. Triggered by Vercel Cron (see vercel.json),
// or manually via /api/reminders?key=YOUR_CRON_SECRET for testing.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface ContactRow {
  id: string;
  name: string;
  contact_type: string;
  status: string;
  next_follow_up_date: string | null;
  notes: string;
  bottle_status: string;
  shipping_address: string;
  bottle_recipient: boolean;
}

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  // If no secret is configured, allow (e.g. local testing).
  if (!secret) return true;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true; // Vercel Cron sends this
  const url = new URL(req.url);
  return url.searchParams.get("key") === secret;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  const to = process.env.REMINDER_EMAIL_TO;
  const from = process.env.REMINDER_EMAIL_FROM || "NuKava CRM <onboarding@resend.dev>";

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { error: "Supabase is not configured (need NEXT_PUBLIC_SUPABASE_URL + a key)." },
      { status: 500 }
    );
  }
  if (!resendKey || !to) {
    return NextResponse.json(
      { error: "Email is not configured (need RESEND_API_KEY + REMINDER_EMAIL_TO)." },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const today = todayISO();

  const { data, error } = await supabase
    .from("contacts")
    .select(
      "id,name,contact_type,status,next_follow_up_date,notes,bottle_status,shipping_address,bottle_recipient"
    );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const contacts = (data ?? []) as ContactRow[];

  const dueFollowUps = contacts
    .filter((c) => c.next_follow_up_date && c.next_follow_up_date <= today)
    .sort((a, b) =>
      (a.next_follow_up_date ?? "").localeCompare(b.next_follow_up_date ?? "")
    );

  const readyToShip = contacts.filter((c) => c.bottle_status === "Ready to send");
  const missingAddress = contacts.filter(
    (c) =>
      c.bottle_recipient &&
      c.shipping_address.trim() === "" &&
      !["Sent", "Delivered", "Followed up"].includes(c.bottle_status)
  );

  // Nothing actionable — skip sending so you don't get empty emails.
  if (dueFollowUps.length === 0 && readyToShip.length === 0 && missingAddress.length === 0) {
    return NextResponse.json({ sent: false, reason: "Nothing due today." });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  const html = buildEmail({ today, dueFollowUps, readyToShip, missingAddress, appUrl });
  const subject = `🍶 NuKava CRM — ${dueFollowUps.length} follow-up${
    dueFollowUps.length === 1 ? "" : "s"
  } today`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html }),
  });

  if (!res.ok) {
    const body = await res.text();
    return NextResponse.json({ error: "Resend failed", detail: body }, { status: 502 });
  }

  return NextResponse.json({
    sent: true,
    counts: {
      followUps: dueFollowUps.length,
      readyToShip: readyToShip.length,
      missingAddress: missingAddress.length,
    },
  });
}

function row(c: ContactRow, appUrl: string): string {
  const link = appUrl ? `${appUrl}/contacts/${c.id}` : "#";
  const overdue = c.next_follow_up_date && c.next_follow_up_date < new Date().toISOString().slice(0, 10);
  const when = c.next_follow_up_date
    ? `${c.next_follow_up_date}${overdue ? " (overdue)" : " (today)"}`
    : "";
  return `<tr>
    <td style="padding:8px 12px;border-bottom:1px solid #1f2937;">
      <a href="${link}" style="color:#ff9d3c;text-decoration:none;font-weight:600;">${escapeHtml(
        c.name
      )}</a>
      <div style="color:#94a3b8;font-size:12px;">${escapeHtml(c.contact_type)} · ${escapeHtml(
        c.status
      )}</div>
      ${c.notes ? `<div style="color:#cbd5e1;font-size:12px;margin-top:2px;">${escapeHtml(c.notes.slice(0, 120))}</div>` : ""}
    </td>
    <td style="padding:8px 12px;border-bottom:1px solid #1f2937;color:${
      overdue ? "#fb7185" : "#cbd5e1"
    };font-size:13px;white-space:nowrap;">${when}</td>
  </tr>`;
}

function section(title: string, items: ContactRow[], appUrl: string): string {
  if (items.length === 0) return "";
  return `<h2 style="font-size:15px;color:#e2e8f0;margin:20px 0 6px;">${title} (${items.length})</h2>
    <table style="width:100%;border-collapse:collapse;background:#0f1518;border-radius:10px;overflow:hidden;">
      ${items.map((c) => row(c, appUrl)).join("")}
    </table>`;
}

function buildEmail({
  today,
  dueFollowUps,
  readyToShip,
  missingAddress,
  appUrl,
}: {
  today: string;
  dueFollowUps: ContactRow[];
  readyToShip: ContactRow[];
  missingAddress: ContactRow[];
  appUrl: string;
}): string {
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#0a0e0f;padding:24px;color:#e2e8f0;">
    <div style="max-width:560px;margin:0 auto;">
      <div style="font-size:20px;font-weight:800;">🍶 NuKava CRM</div>
      <div style="color:#94a3b8;font-size:13px;margin-bottom:4px;">Your daily snapshot — ${today}</div>
      ${section("🔔 Follow-ups due", dueFollowUps, appUrl)}
      ${section("🚀 Ready to ship", readyToShip, appUrl)}
      ${section("📍 Missing address", missingAddress, appUrl)}
      ${
        appUrl
          ? `<div style="margin-top:24px;"><a href="${appUrl}" style="background:#f97f16;color:#0a0e0f;padding:10px 16px;border-radius:10px;text-decoration:none;font-weight:700;">Open NuKava CRM</a></div>`
          : ""
      }
      <div style="color:#64748b;font-size:11px;margin-top:24px;">You're receiving this because reminders are enabled in NuKava CRM.</div>
    </div>
  </div>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
