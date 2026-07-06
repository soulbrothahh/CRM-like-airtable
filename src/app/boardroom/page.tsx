"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useAuth } from "@/components/AuthProvider";
import { getSupabase } from "@/lib/supabase";
import { AGENTS, type AgentRole } from "@/lib/boardroomAgents";

// The Boardroom — where the agent team's daily 6 AM meeting is published.
// Reads meetings/reports/memory straight from Supabase (RLS: signed-in users),
// and can convene an extra meeting on demand via POST /api/boardroom.

interface MeetingRow {
  id: string;
  meeting_date: string;
  trigger: string;
  status: string;
  objectives: { area: string; objective: string; why: string }[];
  summary: string;
  error: string;
  started_at: string;
}

interface ReportRow {
  id: string;
  meeting_id: string;
  agent_role: AgentRole;
  headline: string;
  report: string;
  action_items: { title: string; detail: string; impact: string }[];
  position: number;
}

interface MemoryRow {
  id: string;
  agent_role: string;
  kind: string;
  content: string;
  created_at: string;
}

export default function BoardroomPage() {
  const { cloudEnabled, session } = useAuth();
  const [meetings, setMeetings] = useState<MeetingRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [memory, setMemory] = useState<MemoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [convening, setConvening] = useState(false);
  const [error, setError] = useState("");

  const loadMeetings = useCallback(async () => {
    const sb = getSupabase();
    if (!sb) {
      setLoading(false);
      return;
    }
    const [meetingsRes, memoryRes] = await Promise.all([
      sb
        .from("board_meetings")
        .select("id,meeting_date,trigger,status,objectives,summary,error,started_at")
        .order("started_at", { ascending: false })
        .limit(30),
      sb
        .from("agent_memory")
        .select("id,agent_role,kind,content,created_at")
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
    const rows = (meetingsRes.data ?? []) as MeetingRow[];
    setMeetings(rows);
    setMemory((memoryRes.data ?? []) as MemoryRow[]);
    setSelectedId((prev) => prev ?? rows[0]?.id ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadMeetings();
  }, [loadMeetings]);

  // Load the selected meeting's reports.
  useEffect(() => {
    const sb = getSupabase();
    if (!sb || !selectedId) {
      setReports([]);
      return;
    }
    let active = true;
    sb.from("agent_reports")
      .select("id,meeting_id,agent_role,headline,report,action_items,position")
      .eq("meeting_id", selectedId)
      .order("position")
      .then(({ data }) => {
        if (active) setReports((data ?? []) as ReportRow[]);
      });
    return () => {
      active = false;
    };
  }, [selectedId]);

  const selected = useMemo(
    () => meetings.find((m) => m.id === selectedId) ?? null,
    [meetings, selectedId]
  );

  async function convene() {
    setConvening(true);
    setError("");
    try {
      const res = await fetch("/api/boardroom", {
        method: "POST",
        headers: session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : undefined,
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "The meeting failed.");
      await loadMeetings();
      if (body.meetingId) setSelectedId(body.meetingId);
    } catch (err) {
      setError((err as Error).message);
      await loadMeetings(); // pick up the failed row too
    } finally {
      setConvening(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="The Boardroom"
        subtitle="Your agent team meets at 6 AM, every day"
        action={
          cloudEnabled ? (
            <button onClick={convene} disabled={convening} className="btn-primary">
              {convening ? "Meeting in session…" : "🧠 Convene now"}
            </button>
          ) : undefined
        }
      />

      <div className="space-y-6 px-4 py-5 sm:px-6">
        {!cloudEnabled ? (
          <SetupNotice />
        ) : loading ? (
          <div className="py-20 text-center text-taupe-400">Loading…</div>
        ) : (
          <>
            {convening && (
              <div className="card p-4 text-sm text-taupe-600">
                The board is meeting — the CEO is setting objectives and delegating to the
                team. This usually takes a minute or two. You can leave and come back.
              </div>
            )}
            {error && (
              <div className="card border border-rose-300/40 p-4 text-sm text-rose-600">
                {error}
              </div>
            )}

            {meetings.length === 0 ? (
              <EmptyState onConvene={convene} convening={convening} />
            ) : (
              <>
                <MeetingPicker
                  meetings={meetings}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                />
                {selected && <MeetingView meeting={selected} reports={reports} />}
              </>
            )}

            {memory.length > 0 && <MemoryFeed entries={memory} />}
          </>
        )}
      </div>
    </div>
  );
}

function SetupNotice() {
  return (
    <div className="card p-6">
      <h2 className="text-lg font-bold">☁️ The Boardroom needs cloud sync</h2>
      <p className="mt-2 text-sm text-taupe-600">
        The agent team runs in the cloud so it can meet at 6 AM even while your phone is
        off. To turn it on:
      </p>
      <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-taupe-600">
        <li>Enable Supabase cloud sync (see the README) and run the boardroom migration.</li>
        <li>
          Add <code className="rounded bg-night-900/5 px-1">ANTHROPIC_API_KEY</code>,{" "}
          <code className="rounded bg-night-900/5 px-1">SUPABASE_SERVICE_ROLE_KEY</code> and{" "}
          <code className="rounded bg-night-900/5 px-1">CRON_SECRET</code> to your Vercel
          project.
        </li>
        <li>Deploy — the 6 AM meeting is already scheduled in vercel.json.</li>
      </ol>
    </div>
  );
}

function EmptyState({ onConvene, convening }: { onConvene: () => void; convening: boolean }) {
  return (
    <div className="card p-8 text-center">
      <div className="text-4xl">🧠</div>
      <h2 className="mt-3 text-lg font-bold">No board meetings yet</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-taupe-600">
        Every morning at 6 AM your agent team — CEO, CMO, Sales, Researcher, Analyst and
        Developer — reviews the CRM, sets objectives, and turns them into tasks. Hold the
        first meeting now.
      </p>
      <button onClick={onConvene} disabled={convening} className="btn-primary mt-4">
        {convening ? "Meeting in session…" : "Convene the first meeting"}
      </button>
      <div className="mx-auto mt-6 flex max-w-md flex-wrap justify-center gap-2">
        {Object.values(AGENTS).map((a) => (
          <span key={a.role} className="chip">
            {a.emoji} {a.name} · {a.title}
          </span>
        ))}
      </div>
    </div>
  );
}

function MeetingPicker({
  meetings,
  selectedId,
  onSelect,
}: {
  meetings: MeetingRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {meetings.map((m) => (
        <button
          key={m.id}
          onClick={() => onSelect(m.id)}
          className={m.id === selectedId ? "chip chip-on shrink-0" : "chip chip-off shrink-0"}
        >
          {m.meeting_date}
          {m.status === "failed" ? " ⚠️" : m.status === "running" ? " …" : ""}
          {m.trigger === "cron" ? " ⏰" : ""}
        </button>
      ))}
    </div>
  );
}

function MeetingView({ meeting, reports }: { meeting: MeetingRow; reports: ReportRow[] }) {
  const ceoReport = reports.find((r) => r.agent_role === "ceo");
  const specialists = reports.filter((r) => r.agent_role !== "ceo");

  return (
    <div className="space-y-6">
      {meeting.status === "failed" && (
        <div className="card border border-rose-300/40 p-4 text-sm">
          <span className="font-semibold text-rose-600">This meeting failed:</span>{" "}
          <span className="text-taupe-600">{meeting.error || "Unknown error."}</span>
        </div>
      )}

      {/* CEO: state of business + objectives */}
      {(ceoReport || meeting.objectives.length > 0) && (
        <div className="card p-5">
          <AgentHeader role="ceo" headline={ceoReport?.headline ?? ""} />
          {meeting.objectives.length > 0 && (
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {meeting.objectives.map((o, i) => (
                <div key={i} className="rounded-xl bg-night-900/[0.03] p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-gold-600">
                    {o.area}
                  </div>
                  <div className="mt-0.5 text-sm font-semibold">{o.objective}</div>
                  {o.why && <div className="mt-1 text-xs text-taupe-500">{o.why}</div>}
                </div>
              ))}
            </div>
          )}
          {meeting.summary && (
            <div className="mt-4 border-t border-night-900/5 pt-4">
              <div className="text-xs font-bold uppercase tracking-wide text-taupe-400">
                Closing synthesis
              </div>
              <Markdown text={meeting.summary} />
            </div>
          )}
        </div>
      )}

      {/* Specialist reports */}
      <div className="grid gap-4 lg:grid-cols-2">
        {specialists.map((r) => (
          <div key={r.id} className="card p-5">
            <AgentHeader role={r.agent_role} headline={r.headline} />
            <Markdown text={r.report} />
            {r.action_items.length > 0 && (
              <div className="mt-3 space-y-2 border-t border-night-900/5 pt-3">
                {r.action_items.map((a, i) => (
                  <div key={i} className="rounded-xl bg-gold-400/10 p-3">
                    <div className="text-sm font-semibold">☑️ {a.title}</div>
                    {a.detail && <div className="mt-0.5 text-xs text-taupe-600">{a.detail}</div>}
                    {a.impact && (
                      <div className="mt-1 text-[11px] font-medium text-gold-700">
                        Impact: {a.impact}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function AgentHeader({ role, headline }: { role: AgentRole; headline: string }) {
  const agent = AGENTS[role];
  if (!agent) return null;
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold-400/15 text-xl ring-1 ring-gold-400/20">
        {agent.emoji}
      </div>
      <div className="min-w-0">
        <div className="text-sm font-bold">
          {agent.name} <span className="font-medium text-taupe-500">· {agent.title}</span>
        </div>
        {headline && <div className="mt-0.5 text-sm text-taupe-600">{headline}</div>}
      </div>
    </div>
  );
}

function MemoryFeed({ entries }: { entries: MemoryRow[] }) {
  return (
    <div className="card p-5">
      <h2 className="text-sm font-bold">🧬 Shared memory</h2>
      <p className="mt-0.5 text-xs text-taupe-500">
        What the team carries forward — every meeting reads this and adds to it, so the
        system compounds daily.
      </p>
      <div className="mt-3 space-y-2">
        {entries.map((m) => {
          const agent = AGENTS[m.agent_role as AgentRole];
          return (
            <div key={m.id} className="flex items-start gap-2 text-sm">
              <span className="shrink-0">{agent?.emoji ?? "•"}</span>
              <div className="min-w-0">
                <span className="text-taupe-600">{m.content}</span>
                <span className="ml-2 text-[10px] text-taupe-400">
                  {agent?.title ?? m.agent_role} · {m.kind} · {m.created_at.slice(0, 10)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Tiny markdown renderer for agent reports: headings, bullets, numbered lists,
// bold. Keeps us dependency-free — reports are short and simple.
function Markdown({ text }: { text: string }) {
  const blocks = useMemo(() => text.split(/\n/), [text]);
  return (
    <div className="mt-3 space-y-1.5 text-sm text-taupe-600">
      {blocks.map((raw, i) => {
        const line = raw.trim();
        if (line === "") return null;
        if (/^#{1,4}\s/.test(line)) {
          return (
            <div key={i} className="pt-1 text-[13px] font-bold text-night-800">
              <Inline text={line.replace(/^#{1,4}\s/, "")} />
            </div>
          );
        }
        if (/^[-*•]\s/.test(line)) {
          return (
            <div key={i} className="flex gap-2 pl-1">
              <span className="text-gold-500">•</span>
              <span>
                <Inline text={line.replace(/^[-*•]\s/, "")} />
              </span>
            </div>
          );
        }
        const num = line.match(/^(\d+)[.)]\s(.*)$/);
        if (num) {
          return (
            <div key={i} className="flex gap-2 pl-1">
              <span className="font-semibold text-gold-600">{num[1]}.</span>
              <span>
                <Inline text={num[2]} />
              </span>
            </div>
          );
        }
        return (
          <p key={i}>
            <Inline text={line} />
          </p>
        );
      })}
    </div>
  );
}

function Inline({ text }: { text: string }) {
  // **bold** only — enough for agent reports without pulling in a parser.
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("**") && p.endsWith("**") ? (
          <strong key={i} className="font-semibold text-night-800">
            {p.slice(2, -2)}
          </strong>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </>
  );
}
