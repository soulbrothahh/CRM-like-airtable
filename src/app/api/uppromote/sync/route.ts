import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAdminClient } from "@/lib/supabaseAdmin";
import { uppromoteConfigured } from "@/lib/uppromote/client";
import { runBackfill } from "@/lib/uppromote/sync";

// UpPromote sync endpoint (read-only toward UpPromote).
//   GET  — connection status + recent sync runs (signed-in users)
//   POST — run a backfill; ?dry_run=1 reports without writing, ?demo=1 runs
//          the mapper over built-in fixtures when UpPromote isn't configured.
// Auth: a Supabase user access token (Authorization: Bearer <token>) or the
// CRON_SECRET. The UpPromote API key never leaves the server.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300; // full backfill pages through every collection

async function authorized(req: Request): Promise<boolean> {
  const url = new URL(req.url);
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth === `Bearer ${secret}` || url.searchParams.get("key") === secret) return true;
  }
  // Fall through to Supabase user-token auth (same pattern as /api/email/send).
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !supaUrl || !anonKey) return false;
  const sb = createClient(supaUrl, anonKey, { auth: { persistSession: false } });
  const { data, error } = await sb.auth.getUser(token);
  return !error && Boolean(data.user);
}

export async function GET(req: Request) {
  if (!(await authorized(req))) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const sb = getAdminClient();
  if (!sb) {
    return NextResponse.json(
      { configured: uppromoteConfigured(), cloud: false, runs: [] },
      { status: 200 }
    );
  }
  const { data: runs } = await sb
    .from("sync_runs")
    .select("id, provider, kind, dry_run, status, started_at, finished_at, counts, errors")
    .eq("provider", "uppromote")
    .order("started_at", { ascending: false })
    .limit(5);
  const { count } = await sb
    .from("ambassadors")
    .select("id", { count: "exact", head: true });
  return NextResponse.json({
    configured: uppromoteConfigured(),
    cloud: true,
    ambassadors: count ?? 0,
    runs: runs ?? [],
  });
}

export async function POST(req: Request) {
  if (!(await authorized(req))) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const sb = getAdminClient();
  if (!sb) {
    return NextResponse.json(
      { error: "Cloud is not configured. Set SUPABASE_SERVICE_ROLE_KEY in Vercel." },
      { status: 503 }
    );
  }
  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dry_run") === "1";
  const demo = url.searchParams.get("demo") === "1";
  if (!uppromoteConfigured() && !demo) {
    return NextResponse.json(
      {
        error:
          "UpPromote is not connected. Set UPPROMOTE_API_KEY in Vercel (UpPromote → Settings → Integrations → API & Webhook), or pass ?demo=1 to exercise the pipeline with fixtures.",
      },
      { status: 503 }
    );
  }
  const result = await runBackfill(sb, { dryRun, demo });
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
