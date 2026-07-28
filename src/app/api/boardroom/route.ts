import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabaseAdmin";
import { hasMeetingToday, runBoardMeeting } from "@/lib/boardroom";

// The Boardroom: daily 9 AM agent board meeting.
//   GET  — Vercel Cron (see vercel.json). Skips if today's meeting already ran.
//          Manual testing: /api/boardroom?key=YOUR_CRON_SECRET
//   POST — "Convene now" button in the Boardroom page (signed-in users).
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// A full meeting is ~7 model calls; give the function room to finish.
export const maxDuration = 300;

function cronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  // If no secret is configured, allow (e.g. local testing) — same policy as /api/reminders.
  if (!secret) return true;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true; // Vercel Cron sends this
  const url = new URL(req.url);
  return url.searchParams.get("key") === secret;
}

async function userAuthorized(req: Request): Promise<boolean> {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return false;
  const token = auth.slice("Bearer ".length);
  const db = getAdminClient();
  if (!db) return false;
  const { data, error } = await db.auth.getUser(token);
  return !error && Boolean(data.user);
}

export async function GET(req: Request) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = getAdminClient();
  if (!db) {
    return NextResponse.json(
      { error: "Supabase is not configured (need NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)." },
      { status: 500 }
    );
  }

  // Cron fires every day; don't hold a second meeting if one already completed.
  if (await hasMeetingToday(db)) {
    return NextResponse.json({ ran: false, reason: "Today's board meeting already happened." });
  }

  try {
    const result = await runBoardMeeting(db, { trigger: "cron" });
    return NextResponse.json({ ran: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "Board meeting failed." },
      { status: 502 }
    );
  }
}

export async function POST(req: Request) {
  const db = getAdminClient();
  if (!db) {
    return NextResponse.json(
      { error: "Supabase is not configured (need NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)." },
      { status: 500 }
    );
  }
  if (!cronAuthorized(req) && !(await userAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runBoardMeeting(db, { trigger: "manual" });
    return NextResponse.json({ ran: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "Board meeting failed." },
      { status: 502 }
    );
  }
}
