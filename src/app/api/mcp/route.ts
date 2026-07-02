import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabaseAdmin";
import { computeScore, scoreBand } from "@/lib/scoring";
import { addDays, todayISO } from "@/lib/helpers";
import type { Activity } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

// NuKava CRM MCP server — Streamable HTTP transport (stateless JSON-RPC).
// Lets AI agents (Claude Code, claude.ai connectors, etc.) read and work the
// CRM: contacts, engagement scores, activity timelines, sequences, and deals.
//
// Connect:   claude mcp add --transport http nukava https://<app>/api/mcp \
//              --header "Authorization: Bearer $MCP_API_KEY"
// Auth:      Bearer token (or ?key=) checked against the MCP_API_KEY env var.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PROTOCOL_VERSION = "2025-06-18";
const SERVER_INFO = { name: "nukava-crm", version: "1.0.0" };

type Json = Record<string, unknown>;

function rpcResult(id: unknown, result: unknown) {
  return NextResponse.json({ jsonrpc: "2.0", id, result });
}
function rpcError(id: unknown, code: number, message: string, status = 200) {
  return NextResponse.json(
    { jsonrpc: "2.0", id: id ?? null, error: { code, message } },
    { status }
  );
}

function authorized(req: Request): boolean {
  const secret = process.env.MCP_API_KEY;
  if (!secret) return false; // no key configured → locked
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  return new URL(req.url).searchParams.get("key") === secret;
}

export async function GET() {
  // No standalone SSE stream in this stateless server (allowed by the spec).
  return new NextResponse(null, { status: 405, headers: { Allow: "POST" } });
}

export async function DELETE() {
  return new NextResponse(null, { status: 200 }); // stateless — nothing to end
}

export async function POST(req: Request) {
  if (!process.env.MCP_API_KEY) {
    return rpcError(
      null,
      -32000,
      "MCP is not configured. Set the MCP_API_KEY environment variable in Vercel.",
      503
    );
  }
  if (!authorized(req)) {
    return rpcError(null, -32001, "Unauthorized. Pass Authorization: Bearer <MCP_API_KEY>.", 401);
  }
  const sb = getAdminClient();
  if (!sb) {
    return rpcError(
      null,
      -32002,
      "Supabase is not configured (need SUPABASE_SERVICE_ROLE_KEY).",
      503
    );
  }

  let msg: Json;
  try {
    msg = (await req.json()) as Json;
  } catch {
    return rpcError(null, -32700, "Parse error", 400);
  }

  const { id, method, params } = msg as {
    id?: unknown;
    method?: string;
    params?: Json;
  };

  // Notifications get an empty 202 per the Streamable HTTP transport.
  if (method?.startsWith("notifications/")) {
    return new NextResponse(null, { status: 202 });
  }

  switch (method) {
    case "initialize":
      return rpcResult(id, {
        protocolVersion:
          typeof params?.protocolVersion === "string"
            ? params.protocolVersion
            : PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
        instructions:
          "NuKava CRM: manage contacts, engagement scores, activity timelines, outreach sequences, and B2B deals. Dates are YYYY-MM-DD.",
      });
    case "ping":
      return rpcResult(id, {});
    case "tools/list":
      return rpcResult(id, { tools: TOOLS });
    case "tools/call": {
      const name = params?.name as string;
      const args = (params?.arguments ?? {}) as Json;
      const handler = HANDLERS[name];
      if (!handler) return rpcError(id, -32602, `Unknown tool: ${name}`);
      try {
        const result = await handler(sb, args);
        return rpcResult(id, {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        });
      } catch (err) {
        return rpcResult(id, {
          content: [{ type: "text", text: `Error: ${(err as Error).message}` }],
          isError: true,
        });
      }
    }
    default:
      return rpcError(id, -32601, `Method not found: ${method}`);
  }
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

const CONTACT_FIELDS =
  "id,name,email,phone,instagram,tiktok,city,state,contact_type,status,outreach_status,lead_score,tags,next_follow_up_date,last_contacted_date,bottle_status,notes";

const TOOLS = [
  {
    name: "get_crm_overview",
    description:
      "Dashboard snapshot: contact counts, follow-ups due, hottest leads by engagement score, open deal pipeline value. Call this first to orient.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "search_contacts",
    description:
      "Search contacts by name/email/instagram/city/tag. Optional filters. Returns compact summaries — use get_contact for full detail.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Text to match (name, email, handle, city, tag)" },
        status: { type: "string", description: "Filter by pipeline status, e.g. 'New Lead'" },
        outreach_status: { type: "string", description: "e.g. 'Awaiting reply', 'Replied'" },
        min_score: { type: "number", description: "Minimum lead_score" },
        limit: { type: "number", description: "Max results (default 20)" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_contact",
    description:
      "Full contact record plus recent interactions (manual log) and activities (web/email/social signals), and computed engagement score.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "create_contact",
    description: "Create a new contact. Only name is required.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
        instagram: { type: "string" },
        tiktok: { type: "string" },
        city: { type: "string" },
        state: { type: "string" },
        contact_type: {
          type: "string",
          description: "Creator | Ambassador | Agency | Friend | Retailer | Event Contact | Wholesale | Other",
        },
        source: { type: "string" },
        notes: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
      },
      required: ["name"],
      additionalProperties: false,
    },
  },
  {
    name: "update_contact",
    description:
      "Update fields on a contact (name, status, outreach_status, notes, tags, next_follow_up_date, bottle_status, shipping_address, etc.).",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        patch: {
          type: "object",
          description: "Fields to change, e.g. {\"status\": \"Interested\", \"next_follow_up_date\": \"2026-07-10\"}",
        },
      },
      required: ["id", "patch"],
      additionalProperties: false,
    },
  },
  {
    name: "log_interaction",
    description:
      "Log a touch on a contact's timeline. Outbound → sets 'Awaiting reply' + schedules a 3-day follow-up. Inbound → sets 'Replied' + clears follow-up (same behavior as the app).",
    inputSchema: {
      type: "object",
      properties: {
        contact_id: { type: "string" },
        type: {
          type: "string",
          description: "Texted | Called | DM'd | Met in person | Sent bottle | Followed up | Posted content | Signed up as ambassador",
        },
        direction: { type: "string", description: "outbound (default) or inbound" },
        notes: { type: "string", description: "What was said / what happened" },
        next_action: { type: "string" },
        date: { type: "string", description: "YYYY-MM-DD, default today" },
      },
      required: ["contact_id", "notes"],
      additionalProperties: false,
    },
  },
  {
    name: "log_activity",
    description:
      "Record an engagement signal (email_open, email_click, email_reply, social_dm, social_mention, form_submit, note...) on the unified timeline and recompute the lead score.",
    inputSchema: {
      type: "object",
      properties: {
        contact_id: { type: "string" },
        type: { type: "string" },
        title: { type: "string" },
        url: { type: "string" },
        source: { type: "string", description: "web | email | social | form | manual | system" },
      },
      required: ["contact_id", "type", "title"],
      additionalProperties: false,
    },
  },
  {
    name: "list_followups_due",
    description: "Contacts whose next_follow_up_date is today or overdue, oldest first.",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "number", description: "default 25" } },
      additionalProperties: false,
    },
  },
  {
    name: "list_deals",
    description: "B2B deal pipeline. Optionally filter by stage (Lead, Contacted, Qualified, Meeting, Proposal, Negotiation, Won, Lost).",
    inputSchema: {
      type: "object",
      properties: { stage: { type: "string" } },
      additionalProperties: false,
    },
  },
  {
    name: "update_deal",
    description: "Update a deal (stage, value, next_step, next_step_date, notes...).",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        patch: { type: "object", description: "Fields to change, e.g. {\"stage\": \"Proposal\"}" },
      },
      required: ["id", "patch"],
      additionalProperties: false,
    },
  },
  {
    name: "list_sequences",
    description: "Outreach cadences (multi-step sequences) with their steps.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "enroll_in_sequence",
    description:
      "Enroll a contact in a cadence starting today at step 0, scheduling the first step as their follow-up.",
    inputSchema: {
      type: "object",
      properties: {
        contact_id: { type: "string" },
        sequence_id: { type: "string" },
      },
      required: ["contact_id", "sequence_id"],
      additionalProperties: false,
    },
  },
];

// ---------------------------------------------------------------------------
// Tool handlers
// ---------------------------------------------------------------------------

type Handler = (sb: SupabaseClient, args: Json) => Promise<unknown>;

// Fields agents may write. Guards against clobbering ids/timestamps.
const WRITABLE_CONTACT = new Set([
  "name", "email", "phone", "instagram", "tiktok", "city", "state",
  "contact_type", "relationship_strength", "lead_temperature", "status",
  "source", "follower_count", "audience_type", "owner", "tags", "event_id",
  "outreach_status", "notes", "last_contacted_date", "next_follow_up_date",
  "bottle_recipient", "bottle_priority", "bottle_status", "bottle_quantity",
  "shipping_name", "shipping_address", "tracking_number", "date_sent",
  "date_delivered", "posted_content", "ambassador_signup", "discount_code",
  "sales_generated",
]);
const WRITABLE_DEAL = new Set([
  "title", "company", "deal_type", "stage", "value", "probability",
  "expected_close_date", "owner", "source", "next_step", "next_step_date", "notes",
]);

function pick(obj: Json, allowed: Set<string>): Json {
  const out: Json = {};
  for (const [k, v] of Object.entries(obj)) if (allowed.has(k)) out[k] = v;
  return out;
}

async function fetchContact(sb: SupabaseClient, id: string) {
  const { data, error } = await sb.from("contacts").select("*").eq("id", id).single();
  if (error) throw new Error(`Contact not found: ${error.message}`);
  return data;
}

const HANDLERS: Record<string, Handler> = {
  async get_crm_overview(sb) {
    const today = todayISO();
    const [contacts, deals] = await Promise.all([
      sb.from("contacts").select("id,name,status,outreach_status,lead_score,next_follow_up_date,bottle_status"),
      sb.from("deals").select("id,title,stage,value"),
    ]);
    const cs = contacts.data ?? [];
    const ds = deals.data ?? [];
    const due = cs.filter((c) => c.next_follow_up_date && c.next_follow_up_date <= today);
    const open = ds.filter((d) => d.stage !== "Won" && d.stage !== "Lost");
    return {
      total_contacts: cs.length,
      followups_due: due.length,
      awaiting_reply: cs.filter((c) => c.outreach_status === "Awaiting reply").length,
      replied: cs.filter((c) => c.outreach_status === "Replied").length,
      bottles_ready_to_send: cs.filter((c) => c.bottle_status === "Ready to send").length,
      hottest_leads: cs
        .filter((c) => (c.lead_score ?? 0) > 0)
        .sort((a, b) => (b.lead_score ?? 0) - (a.lead_score ?? 0))
        .slice(0, 5)
        .map((c) => ({ id: c.id, name: c.name, score: c.lead_score, band: scoreBand(c.lead_score ?? 0) })),
      open_deals: open.length,
      open_pipeline_value: open.reduce((s, d) => s + (d.value ?? 0), 0),
    };
  },

  async search_contacts(sb, args) {
    const limit = Math.min(Number(args.limit) || 20, 100);
    let q = sb.from("contacts").select(CONTACT_FIELDS).limit(200);
    if (args.status) q = q.eq("status", args.status);
    if (args.outreach_status) q = q.eq("outreach_status", args.outreach_status);
    if (args.min_score !== undefined) q = q.gte("lead_score", Number(args.min_score));
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    let rows = data ?? [];
    const query = String(args.query ?? "").trim().toLowerCase();
    if (query) {
      rows = rows.filter((c) =>
        [c.name, c.email, c.instagram, c.tiktok, c.city, ...(c.tags ?? [])]
          .join(" ")
          .toLowerCase()
          .includes(query)
      );
    }
    return rows
      .sort((a, b) => (b.lead_score ?? 0) - (a.lead_score ?? 0))
      .slice(0, limit);
  },

  async get_contact(sb, args) {
    const contact = await fetchContact(sb, String(args.id));
    const [ix, acts] = await Promise.all([
      sb.from("interactions").select("date,type,direction,notes,next_action")
        .eq("contact_id", contact.id).order("date", { ascending: false }).limit(15),
      sb.from("activities").select("occurred_at,source,type,title,url")
        .eq("contact_id", contact.id).order("occurred_at", { ascending: false }).limit(20),
    ]);
    return {
      contact,
      engagement: { score: contact.lead_score ?? 0, band: scoreBand(contact.lead_score ?? 0) },
      interactions: ix.data ?? [],
      activities: acts.data ?? [],
    };
  },

  async create_contact(sb, args) {
    const ts = new Date().toISOString();
    const fields = pick(args, WRITABLE_CONTACT);
    const { data, error } = await sb
      .from("contacts")
      .insert({
        contact_type: "Other",
        status: "New Lead",
        outreach_status: "Not contacted",
        source: "Agent (MCP)",
        ...fields,
        created_at: ts,
        updated_at: ts,
      })
      .select(CONTACT_FIELDS)
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async update_contact(sb, args) {
    const patch = pick((args.patch ?? {}) as Json, WRITABLE_CONTACT);
    if (Object.keys(patch).length === 0) throw new Error("No writable fields in patch.");
    const { data, error } = await sb
      .from("contacts")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", String(args.id))
      .select(CONTACT_FIELDS)
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async log_interaction(sb, args) {
    const contactId = String(args.contact_id);
    const direction = args.direction === "inbound" ? "inbound" : "outbound";
    const date = typeof args.date === "string" && args.date ? args.date : todayISO();
    const { error } = await sb.from("interactions").insert({
      contact_id: contactId,
      date,
      type: (args.type as string) || "Texted",
      direction,
      notes: String(args.notes ?? ""),
      next_action: String(args.next_action ?? ""),
      created_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    // Same outreach-loop side-effects as the app UI.
    const patch =
      direction === "inbound"
        ? { outreach_status: "Replied", next_follow_up_date: null }
        : {
            last_contacted_date: date,
            outreach_status: "Awaiting reply",
            next_follow_up_date: addDays(date, 3),
          };
    await sb
      .from("contacts")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", contactId);
    return { logged: true, direction, outreach_update: patch };
  },

  async log_activity(sb, args) {
    const contactId = String(args.contact_id);
    await fetchContact(sb, contactId); // validate id
    const { error } = await sb.from("activities").insert({
      contact_id: contactId,
      visitor_id: null,
      source: (args.source as string) || "manual",
      type: String(args.type),
      title: String(args.title).slice(0, 240),
      url: String(args.url ?? ""),
      metadata: {},
      occurred_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    const { data: acts } = await sb.from("activities").select("*").eq("contact_id", contactId);
    const { score, band } = computeScore((acts ?? []) as Activity[]);
    await sb
      .from("contacts")
      .update({ lead_score: score, lead_score_updated_at: new Date().toISOString() })
      .eq("id", contactId);
    return { logged: true, new_score: score, band };
  },

  async list_followups_due(sb, args) {
    const limit = Math.min(Number(args.limit) || 25, 100);
    const { data, error } = await sb
      .from("contacts")
      .select(CONTACT_FIELDS)
      .lte("next_follow_up_date", todayISO())
      .not("next_follow_up_date", "is", null)
      .order("next_follow_up_date", { ascending: true })
      .limit(limit);
    if (error) throw new Error(error.message);
    return data ?? [];
  },

  async list_deals(sb, args) {
    let q = sb
      .from("deals")
      .select("id,title,company,deal_type,stage,value,probability,expected_close_date,next_step,next_step_date,notes")
      .order("updated_at", { ascending: false });
    if (args.stage) q = q.eq("stage", args.stage);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return data ?? [];
  },

  async update_deal(sb, args) {
    const patch = pick((args.patch ?? {}) as Json, WRITABLE_DEAL);
    if (Object.keys(patch).length === 0) throw new Error("No writable fields in patch.");
    const { data, error } = await sb
      .from("deals")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", String(args.id))
      .select("id,title,company,stage,value,next_step,next_step_date")
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async list_sequences(sb) {
    const { data, error } = await sb
      .from("sequences")
      .select("id,name,description,steps")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  },

  async enroll_in_sequence(sb, args) {
    const contact = await fetchContact(sb, String(args.contact_id));
    const { data: seq, error } = await sb
      .from("sequences")
      .select("*")
      .eq("id", String(args.sequence_id))
      .single();
    if (error || !seq) throw new Error("Sequence not found.");
    const steps = (seq.steps ?? []) as { day: number; label: string }[];
    if (steps.length === 0) throw new Error("Sequence has no steps.");
    const today = todayISO();
    // Mirrors the app's enrollInSequence: start at step 0 today.
    await sb
      .from("contacts")
      .update({
        sequence_id: seq.id,
        sequence_step: 0,
        sequence_started: today,
        next_follow_up_date: addDays(today, steps[0].day),
        outreach_status:
          contact.outreach_status === "Not contacted" ? "Messaged" : contact.outreach_status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", contact.id);
    return {
      enrolled: true,
      contact: contact.name,
      sequence: seq.name,
      first_step: { due: addDays(today, steps[0].day), label: steps[0].label },
    };
  },
};
