// The agent roster for the Boardroom. Kept dependency-free so both the client
// UI and the server-side orchestrator (src/lib/boardroom.ts) can import it.

export const AGENT_ROLES = [
  "ceo",
  "cmo",
  "sales",
  "researcher",
  "analyst",
  "developer",
] as const;

export type AgentRole = (typeof AGENT_ROLES)[number];

export interface AgentProfile {
  role: AgentRole;
  name: string;
  title: string;
  emoji: string;
  mandate: string;
}

export const AGENTS: Record<AgentRole, AgentProfile> = {
  ceo: {
    role: "ceo",
    name: "Ava",
    title: "CEO",
    emoji: "🧠",
    mandate:
      "Review progress, set today's objectives across content, leads, sales, operations and system bottlenecks, and delegate to the team.",
  },
  cmo: {
    role: "cmo",
    name: "Marlow",
    title: "CMO",
    emoji: "📣",
    mandate:
      "Own content and creator marketing: which creators/ambassadors to activate, what content to push, which posted content to amplify or follow up on.",
  },
  sales: {
    role: "sales",
    name: "Rex",
    title: "Sales Rep",
    emoji: "🤝",
    mandate:
      "Own the lead pipeline and follow-ups: overdue touches, deals to advance, warm leads going cold, and the exact next message to send.",
  },
  researcher: {
    role: "researcher",
    name: "Iris",
    title: "Researcher",
    emoji: "🔍",
    mandate:
      "Gather market and competitor context relevant to today's pipeline: segments, cities, event opportunities, and angles the team should exploit.",
  },
  analyst: {
    role: "analyst",
    name: "Dot",
    title: "Data Analyst",
    emoji: "📊",
    mandate:
      "Prioritize by revenue impact: rank where today's effort pays off most (deals, bottles, follow-ups), and flag metrics moving the wrong way.",
  },
  developer: {
    role: "developer",
    name: "Kit",
    title: "Developer",
    emoji: "🛠️",
    mandate:
      "Watch the system itself: data hygiene issues (missing addresses, stale statuses, unlinked records), workflow bottlenecks, and improvements to the CRM setup.",
  },
};
