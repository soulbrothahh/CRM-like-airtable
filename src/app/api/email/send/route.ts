import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAdminClient } from "@/lib/supabaseAdmin";
import {
  appOrigin,
  buildEmailHtml,
  emailConfigured,
  emailFrom,
} from "@/lib/emailServer";

// Sends a tracked outreach email via Resend and records the full loop:
// email_sent activity (carrying the tracking id), an "Emailed" interaction,
// and the outreach-status side-effects (Awaiting reply + 3-day follow-up).
// Auth: the logged-in app user's Supabase access token.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  // Lets the Compose UI know whether sending is available.
  return NextResponse.json({ configured: emailConfigured(), from: emailFrom() });
}

async function verifyUser(req: Request): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return false;
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return false;
  const token = auth.slice(7);
  const sb = createClient(url, anon, { auth: { persistSession: false } });
  const { data, error } = await sb.auth.getUser(token);
  return !error && Boolean(data.user);
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export async function POST(req: Request) {
  if (!emailConfigured()) {
    return NextResponse.json(
      { error: "Email isn't configured. Set RESEND_API_KEY (and the Supabase service key) in Vercel." },
      { status: 503 }
    );
  }
  if (!(await verifyUser(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const sb = getAdminClient()!;

  let body: { contact_id?: string; subject?: string; body?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const subject = (body.subject ?? "").trim();
  const text = (body.body ?? "").trim();
  if (!body.contact_id || !subject || !text) {
    return NextResponse.json(
      { error: "contact_id, subject, and body are required." },
      { status: 400 }
    );
  }

  const { data: contact, error: cErr } = await sb
    .from("contacts")
    .select("id,name,email,status,outreach_status")
    .eq("id", body.contact_id)
    .single();
  if (cErr || !contact) {
    return NextResponse.json({ error: "Contact not found." }, { status: 404 });
  }
  if (!contact.email) {
    return NextResponse.json(
      { error: `${contact.name} has no email address on file.` },
      { status: 400 }
    );
  }

  const emailId = crypto.randomUUID();
  const origin = appOrigin(req);
  const html = buildEmailHtml(text, origin, emailId);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: emailFrom(),
      to: contact.email,
      subject,
      html,
      text, // plain-text alternative for clients that prefer it
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    return NextResponse.json(
      { error: "Resend rejected the send.", detail },
      { status: 502 }
    );
  }
  const sent = (await res.json()) as { id?: string };

  const nowIso = new Date().toISOString();
  const today = nowIso.slice(0, 10);

  // 1) Signal on the unified timeline (carries the tracking id).
  await sb.from("activities").insert({
    contact_id: contact.id,
    visitor_id: null,
    source: "email",
    type: "email_sent",
    title: `Sent “${subject.slice(0, 160)}”`,
    url: "",
    metadata: { email_id: emailId, subject, resend_id: sent.id ?? "" },
    occurred_at: nowIso,
    created_at: nowIso,
  });

  // 2) Interaction on the manual timeline (what was said).
  await sb.from("interactions").insert({
    contact_id: contact.id,
    date: today,
    type: "Emailed",
    direction: "outbound",
    notes: `Subject: ${subject}\n\n${text}`,
    next_action: "Awaiting reply",
    created_at: nowIso,
  });

  // 3) Outreach-loop side-effects, same as the app UI.
  await sb
    .from("contacts")
    .update({
      last_contacted_date: today,
      outreach_status: "Awaiting reply",
      next_follow_up_date: addDays(today, 3),
      status: contact.status === "New Lead" ? "Contacted" : contact.status,
      updated_at: nowIso,
    })
    .eq("id", contact.id);

  return NextResponse.json({
    sent: true,
    to: contact.email,
    email_id: emailId,
    follow_up: addDays(today, 3),
  });
}
