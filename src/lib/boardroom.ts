import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";

// The Boardroom: every morning at 6 AM (Vercel Cron → /api/boardroom) a team of
// autonomous agents holds a board meeting over the live CRM data.
//
//   1. The CEO reviews yesterday's memory + today's numbers and sets objectives
//      across content, leads, sales, operations and bottlenecks.
//   2. Specialists (CMO, Sales, Researcher, Analyst, Developer) work their
//      directives in parallel, each returning a report + action items.
//   3. The CEO synthesizes everything into a closing summary.
//
// Agents share memory through the agent_memory table — every meeting reads the
// recent entries and writes new insights, so context compounds daily. Action
// items become real rows in the tasks table (they show up in the Today view).

import { AGENTS, type AgentProfile, type AgentRole } from "./boardroomAgents";

export { AGENTS, AGENT_ROLES, type AgentProfile, type AgentRole } from "./boardroomAgents";

const SPECIALISTS: AgentRole[] = ["cmo", "sales", "researcher", "analyst", "developer"];

// ---------------- CRM snapshot ----------------
// A compact, prompt-friendly picture of the business this morning. Aggregates
// plus a few named records — enough signal for good decisions without blowing
// up token usage.

interface Snapshot {
  text: string;
  date: string;
}

function fmtMoney(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

export async function gatherSnapshot(db: SupabaseClient): Promise<Snapshot> {
  const today = new Date().toISOString().slice(0, 10);
  const since14 = new Date(Date.now() - 14 * 86400000).toISOString();

  const [contactsRes, dealsRes, tasksRes, interactionsRes, eventsRes] = await Promise.all([
    db
      .from("contacts")
      .select(
        "name,contact_type,status,lead_temperature,next_follow_up_date,last_contacted_date,bottle_recipient,bottle_status,bottle_priority,shipping_address,posted_content,ambassador_signup,sales_generated,lead_score,follower_count,city,state,outreach_status,notes"
      ),
    db
      .from("deals")
      .select("title,company,deal_type,stage,value,next_step,next_step_date,expected_close_date,notes"),
    db.from("tasks").select("title,due_date,done").eq("done", false),
    db
      .from("interactions")
      .select("date,type,direction,notes")
      .gte("created_at", since14)
      .order("date", { ascending: false })
      .limit(40),
    db
      .from("events")
      .select("name,type,status,date,city,state,goal")
      .gte("date", today)
      .order("date")
      .limit(8),
  ]);

  type Row = Record<string, unknown>;
  const contacts = (contactsRes.data ?? []) as Row[];
  const deals = (dealsRes.data ?? []) as Row[];
  const tasks = (tasksRes.data ?? []) as Row[];
  const interactions = (interactionsRes.data ?? []) as Row[];
  const events = (eventsRes.data ?? []) as Row[];

  const s = (v: unknown) => String(v ?? "");
  const n = (v: unknown) => (typeof v === "number" ? v : 0);

  const overdue = contacts.filter(
    (c) => s(c.next_follow_up_date) !== "" && s(c.next_follow_up_date) <= today
  );
  const hot = contacts.filter((c) => s(c.lead_temperature) === "Hot");
  const readyToShip = contacts.filter((c) => s(c.bottle_status) === "Ready to send");
  const missingAddress = contacts.filter(
    (c) =>
      c.bottle_recipient === true &&
      s(c.shipping_address).trim() === "" &&
      !["Sent", "Delivered", "Followed up"].includes(s(c.bottle_status))
  );
  const posted = contacts.filter((c) => c.posted_content === true);
  const ambassadors = contacts.filter((c) => c.ambassador_signup === true);
  const totalSales = contacts.reduce((sum, c) => sum + n(c.sales_generated), 0);

  const openDeals = deals.filter((d) => !["Won", "Lost"].includes(s(d.stage)));
  const pipelineValue = openDeals.reduce((sum, d) => sum + n(d.value), 0);
  const dueDeals = openDeals.filter(
    (d) => s(d.next_step_date) !== "" && s(d.next_step_date) <= today
  );

  const line = (label: string, items: string[]) =>
    items.length ? `${label}:\n${items.map((i) => `  - ${i}`).join("\n")}` : "";

  const contactLine = (c: Row) =>
    `${s(c.name)} (${s(c.contact_type)}, ${s(c.status)}, ${s(c.lead_temperature)}${
      n(c.follower_count) ? `, ${n(c.follower_count).toLocaleString()} followers` : ""
    }${s(c.city) ? `, ${s(c.city)} ${s(c.state)}` : ""})${
      s(c.next_follow_up_date) ? ` — follow-up ${s(c.next_follow_up_date)}` : ""
    }${s(c.notes) ? ` — ${s(c.notes).slice(0, 90)}` : ""}`;

  const dealLine = (d: Row) =>
    `${s(d.title)} [${s(d.stage)}${n(d.value) ? `, ${fmtMoney(n(d.value))}` : ""}] next: ${
      s(d.next_step) || "—"
    }${s(d.next_step_date) ? ` (${s(d.next_step_date)})` : ""}`;

  const text = [
    `Date: ${today}`,
    `Contacts: ${contacts.length} total | ${hot.length} hot | ${overdue.length} follow-ups due/overdue | ${posted.length} posted content | ${ambassadors.length} ambassadors signed`,
    `Bottles: ${readyToShip.length} ready to ship | ${missingAddress.length} recipients missing an address`,
    `Sales attributed to contacts: ${fmtMoney(totalSales)}`,
    `Deals: ${openDeals.length} open worth ${fmtMoney(pipelineValue)} | ${dueDeals.length} with next-steps due/overdue`,
    `Open tasks: ${tasks.length}`,
    line(
      "Follow-ups due/overdue (top 10)",
      overdue.slice(0, 10).map(contactLine)
    ),
    line("Hot contacts (top 8)", hot.slice(0, 8).map(contactLine)),
    line("Open deals", openDeals.slice(0, 10).map(dealLine)),
    line(
      "Ready to ship",
      readyToShip.slice(0, 8).map((c) => `${s(c.name)} (${s(c.bottle_priority)} priority)`)
    ),
    line(
      "Missing address",
      missingAddress.slice(0, 8).map((c) => s(c.name))
    ),
    line(
      "Recent interactions (14d)",
      interactions
        .slice(0, 15)
        .map((i) => `${s(i.date)} ${s(i.type)}${s(i.notes) ? ` — ${s(i.notes).slice(0, 70)}` : ""}`)
    ),
    line(
      "Upcoming events",
      events.map(
        (e) =>
          `${s(e.date)} ${s(e.name)} (${s(e.type)}, ${s(e.status)}${
            s(e.city) ? `, ${s(e.city)} ${s(e.state)}` : ""
          })${s(e.goal) ? ` — goal: ${s(e.goal)}` : ""}`
      )
    ),
    line(
      "Open tasks (top 10)",
      tasks.slice(0, 10).map((t) => `${s(t.title)}${s(t.due_date) ? ` (due ${s(t.due_date)})` : ""}`)
    ),
  ]
    .filter(Boolean)
    .join("\n\n");

  return { text, date: today };
}

// ---------------- shared memory ----------------

interface MemoryEntry {
  agent_role: string;
  kind: string;
  content: string;
  created_at: string;
}

async function loadMemory(db: SupabaseClient): Promise<string> {
  const [memRes, lastMeetingRes] = await Promise.all([
    db
      .from("agent_memory")
      .select("agent_role,kind,content,created_at")
      .order("created_at", { ascending: false })
      .limit(40),
    db
      .from("board_meetings")
      .select("meeting_date,summary,objectives")
      .eq("status", "completed")
      .order("meeting_date", { ascending: false })
      .limit(1),
  ]);

  const parts: string[] = [];
  const last = lastMeetingRes.data?.[0];
  if (last) {
    parts.push(
      `Last completed meeting (${last.meeting_date}) summary:\n${String(last.summary).slice(0, 1200)}`
    );
  }
  const entries = (memRes.data ?? []) as MemoryEntry[];
  if (entries.length) {
    parts.push(
      "Shared memory (newest first):\n" +
        entries
          .map(
            (m) =>
              `  - [${m.created_at.slice(0, 10)}] ${AGENTS[m.agent_role as AgentRole]?.title ?? m.agent_role} (${m.kind}): ${m.content.slice(0, 200)}`
          )
          .join("\n")
    );
  }
  return parts.join("\n\n") || "No shared memory yet — this is the first board meeting.";
}

// ---------------- LLM plumbing ----------------

const COMPANY_CONTEXT =
  "The business is NuKava, a premium kava wellness beverage brand (calm, relaxation, focus). " +
  "Growth engine: gifting bottles to creators/ambassadors who post content, plus a B2B pipeline " +
  "(retailers, distributors, wholesale) and local events (kalapus, kava circles, mixers, pop-ups). " +
  "The CRM tracks contacts, bottle gifting, deals, events, sequences and tasks.";

function extractJson<T>(text: string): T {
  const cleaned = text.replace(/```(?:json)?/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Agent returned no JSON object.");
  }
  return JSON.parse(cleaned.slice(start, end + 1)) as T;
}

async function askAgent<T>(
  client: Anthropic,
  model: string,
  system: string,
  prompt: string
): Promise<T> {
  const response = await client.messages.create({
    model,
    max_tokens: 1500,
    system,
    messages: [{ role: "user", content: prompt }],
  });
  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  return extractJson<T>(text);
}

// ---------------- meeting phases ----------------

interface CeoPlan {
  state_of_business: string;
  objectives: { area: string; objective: string; why: string }[];
  directives: Partial<Record<AgentRole, string>>;
}

interface SpecialistReport {
  headline: string;
  report: string;
  action_items: { title: string; detail: string; impact: string }[];
  memory: { kind: string; content: string }[];
}

interface CeoSynthesis {
  summary: string;
  memory: { kind: string; content: string }[];
}

const JSON_RULES =
  "Respond with ONLY a valid JSON object — no prose before or after, no markdown fences.";

function agentSystem(agent: AgentProfile): string {
  return (
    `You are ${agent.name}, the autonomous ${agent.title} agent on NuKava's AI board. ` +
    `Your mandate: ${agent.mandate} ${COMPANY_CONTEXT} ` +
    "You sit in a daily 6 AM board meeting with the other agents. Be specific and " +
    "operational: name real contacts, deals and events from the data, never invent " +
    "records, and push for actions with revenue impact today. " +
    JSON_RULES
  );
}

async function runCeoPlanning(
  client: Anthropic,
  model: string,
  snapshot: Snapshot,
  memory: string
): Promise<CeoPlan> {
  const prompt = [
    "Morning board meeting. Review the shared memory and this morning's CRM snapshot, then set the plan.",
    `SHARED MEMORY\n${memory}`,
    `CRM SNAPSHOT\n${snapshot.text}`,
    `Return JSON with this exact shape:
{
  "state_of_business": "2-3 sentence assessment of where the business stands vs yesterday",
  "objectives": [{ "area": "content|leads|sales|operations|bottleneck", "objective": "specific, measurable objective for today", "why": "one sentence" }],
  "directives": { "cmo": "one-paragraph directive", "sales": "...", "researcher": "...", "analyst": "...", "developer": "..." }
}
Set 3-5 objectives spanning content, leads, sales, operations and the biggest bottleneck.`,
  ].join("\n\n");
  return askAgent<CeoPlan>(client, model, agentSystem(AGENTS.ceo), prompt);
}

async function runSpecialist(
  client: Anthropic,
  model: string,
  agent: AgentProfile,
  directive: string,
  snapshot: Snapshot,
  memory: string
): Promise<SpecialistReport> {
  const prompt = [
    `Morning board meeting. The CEO's directive for you today:\n${directive || agent.mandate}`,
    `SHARED MEMORY\n${memory}`,
    `CRM SNAPSHOT\n${snapshot.text}`,
    `Do your job for today and return JSON with this exact shape:
{
  "headline": "one-line takeaway of your report",
  "report": "your report in markdown (short paragraphs / bullets, reference real records)",
  "action_items": [{ "title": "imperative task title under 60 chars", "detail": "exactly what to do and to whom", "impact": "expected effect" }],
  "memory": [{ "kind": "insight|decision|metric|note", "content": "one durable fact/insight worth remembering tomorrow" }]
}
Give 1-3 action_items (only ones worth a human's time today) and 1-2 memory entries.`,
  ].join("\n\n");
  return askAgent<SpecialistReport>(client, model, agentSystem(agent), prompt);
}

async function runCeoSynthesis(
  client: Anthropic,
  model: string,
  plan: CeoPlan,
  reports: { agent: AgentProfile; report: SpecialistReport }[]
): Promise<CeoSynthesis> {
  const prompt = [
    "The specialists have reported back. Close the meeting.",
    `Your morning objectives were:\n${plan.objectives
      .map((o) => `- [${o.area}] ${o.objective}`)
      .join("\n")}`,
    `TEAM REPORTS\n${reports
      .map(
        ({ agent, report }) =>
          `${agent.title} — ${report.headline}\n${report.report}\nProposed actions: ${report.action_items
            .map((a) => a.title)
            .join("; ")}`
      )
      .join("\n\n")}`,
    `Return JSON with this exact shape:
{
  "summary": "closing synthesis in markdown: how the plan came together, the top 3 priorities for the human operator today (as a numbered list), and one risk to watch",
  "memory": [{ "kind": "insight|decision|metric|note", "content": "one durable takeaway for tomorrow's meeting" }]
}`,
  ].join("\n\n");
  return askAgent<CeoSynthesis>(client, model, agentSystem(AGENTS.ceo), prompt);
}

// ---------------- orchestrator ----------------

export interface MeetingResult {
  meetingId: string;
  date: string;
  objectives: CeoPlan["objectives"];
  summary: string;
  reports: { role: AgentRole; headline: string }[];
  tasksCreated: number;
}

const MAX_TASKS_PER_MEETING = 8;

export async function runBoardMeeting(
  db: SupabaseClient,
  options: { trigger: "cron" | "manual" }
): Promise<MeetingResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured.");
  const client = new Anthropic({ apiKey });
  const model = process.env.BOARDROOM_MODEL || "claude-sonnet-5";

  const snapshot = await gatherSnapshot(db);
  const memory = await loadMemory(db);

  const { data: meetingRow, error: meetingErr } = await db
    .from("board_meetings")
    .insert({ meeting_date: snapshot.date, trigger: options.trigger, status: "running" })
    .select("id")
    .single();
  if (meetingErr || !meetingRow) {
    throw new Error(`Could not create meeting: ${meetingErr?.message ?? "unknown error"}`);
  }
  const meetingId = meetingRow.id as string;

  try {
    // Phase 1 — CEO reviews progress and sets the day's plan.
    const plan = await runCeoPlanning(client, model, snapshot, memory);

    // Phase 2 — specialists work their directives in parallel.
    const specialistResults = await Promise.all(
      SPECIALISTS.map(async (role) => {
        const agent = AGENTS[role];
        const report = await runSpecialist(
          client,
          model,
          agent,
          plan.directives[role] ?? "",
          snapshot,
          memory
        );
        return { agent, report };
      })
    );

    // Phase 3 — CEO closes the meeting.
    const synthesis = await runCeoSynthesis(client, model, plan, specialistResults);

    // Persist reports (CEO first, then specialists in roster order).
    const reportRows = [
      {
        meeting_id: meetingId,
        agent_role: "ceo",
        headline: plan.state_of_business,
        report: synthesis.summary,
        action_items: [],
        position: 0,
      },
      ...specialistResults.map(({ agent, report }, i) => ({
        meeting_id: meetingId,
        agent_role: agent.role,
        headline: report.headline,
        report: report.report,
        action_items: report.action_items ?? [],
        position: i + 1,
      })),
    ];
    const { error: reportsErr } = await db.from("agent_reports").insert(reportRows);
    if (reportsErr) throw new Error(`Could not save reports: ${reportsErr.message}`);

    // Write shared memory so tomorrow's meeting starts smarter.
    const memoryRows = [
      ...specialistResults.flatMap(({ agent, report }) =>
        (report.memory ?? []).slice(0, 2).map((m) => ({
          meeting_id: meetingId,
          agent_role: agent.role,
          kind: m.kind || "note",
          content: m.content,
        }))
      ),
      ...(synthesis.memory ?? []).slice(0, 2).map((m) => ({
        meeting_id: meetingId,
        agent_role: "ceo",
        kind: m.kind || "note",
        content: m.content,
      })),
    ].filter((m) => m.content && m.content.trim() !== "");
    if (memoryRows.length) await db.from("agent_memory").insert(memoryRows);

    // Turn the best action items into real CRM tasks (visible in the Today view).
    const taskRows = specialistResults
      .flatMap(({ agent, report }) =>
        (report.action_items ?? []).slice(0, 2).map((a) => ({
          title: `${agent.emoji} ${a.title}`.slice(0, 120),
          notes: `${agent.name} (${agent.title}) — board meeting ${snapshot.date}.\n${a.detail}${
            a.impact ? `\nImpact: ${a.impact}` : ""
          }`,
          due_date: snapshot.date,
          done: false,
        }))
      )
      .filter((t) => t.title.trim() !== "")
      .slice(0, MAX_TASKS_PER_MEETING);
    let tasksCreated = 0;
    if (taskRows.length) {
      const { error: tasksErr } = await db.from("tasks").insert(taskRows);
      if (!tasksErr) tasksCreated = taskRows.length;
    }

    await db
      .from("board_meetings")
      .update({
        status: "completed",
        objectives: plan.objectives,
        summary: synthesis.summary,
        completed_at: new Date().toISOString(),
      })
      .eq("id", meetingId);

    return {
      meetingId,
      date: snapshot.date,
      objectives: plan.objectives,
      summary: synthesis.summary,
      reports: specialistResults.map(({ agent, report }) => ({
        role: agent.role,
        headline: report.headline,
      })),
      tasksCreated,
    };
  } catch (err) {
    await db
      .from("board_meetings")
      .update({
        status: "failed",
        error: (err as Error).message ?? "Unknown error",
        completed_at: new Date().toISOString(),
      })
      .eq("id", meetingId);
    throw err;
  }
}

/** True if a completed meeting already exists for today (used to keep the cron idempotent). */
export async function hasMeetingToday(db: SupabaseClient): Promise<boolean> {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await db
    .from("board_meetings")
    .select("id")
    .eq("meeting_date", today)
    .eq("status", "completed")
    .limit(1);
  return Boolean(data && data.length > 0);
}
