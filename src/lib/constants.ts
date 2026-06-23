import type {
  BottlePriority,
  BottleStatus,
  ContactType,
  DealActivityType,
  DealStage,
  DealType,
  InteractionType,
  LeadTemperature,
  RelationshipStrength,
  Status,
} from "./types";

export const CONTACT_TYPES: ContactType[] = [
  "Creator",
  "Ambassador",
  "Agency",
  "Friend",
  "Retailer",
  "Event Contact",
  "Wholesale",
  "Other",
];

export const RELATIONSHIP_STRENGTHS: RelationshipStrength[] = [
  "Cold",
  "Warm",
  "Hot",
  "Close Friend",
];

export const LEAD_TEMPERATURES: LeadTemperature[] = ["Cold", "Warm", "Hot"];

export const STATUSES: Status[] = [
  "New Lead",
  "Contacted",
  "Interested",
  "Needs Follow-Up",
  "Approved for Bottles",
  "Bottle Sent",
  "Posted Content",
  "Ambassador Signed Up",
  "Not Interested",
];

export const BOTTLE_PRIORITIES: BottlePriority[] = ["Low", "Medium", "High", "VIP"];

export const BOTTLE_STATUSES: BottleStatus[] = [
  "Not planned",
  "Want to send",
  "Need address",
  "Ready to send",
  "Sent",
  "Delivered",
  "Followed up",
];

export const INTERACTION_TYPES: InteractionType[] = [
  "Texted",
  "Called",
  "DM'd",
  "Met in person",
  "Sent bottle",
  "Followed up",
  "Posted content",
  "Signed up as ambassador",
];

// Soft, warm badge styles tuned for a light cream background:
// gentle tinted fill + readable dark-tinted text + subtle ring.
const NEUTRAL = "bg-taupe-400/15 text-taupe-600 ring-taupe-400/30";
const SKY = "bg-sky-500/12 text-sky-700 ring-sky-500/25";
const INDIGO = "bg-indigo-500/12 text-indigo-700 ring-indigo-500/25";
const AMBER = "bg-amber-500/15 text-amber-700 ring-amber-500/30";
const VIOLET = "bg-violet-500/12 text-violet-700 ring-violet-500/25";
const FUCHSIA = "bg-fuchsia-500/12 text-fuchsia-700 ring-fuchsia-500/25";
const EMERALD = "bg-emerald-500/12 text-emerald-700 ring-emerald-500/25";
const ROSE = "bg-rose-500/12 text-rose-700 ring-rose-500/25";
const GOLD = "bg-gold-400/18 text-gold-700 ring-gold-500/30";
const SAGE = "bg-sage-500/15 text-sage-600 ring-sage-500/30";
const CLAY = "bg-clay-500/12 text-clay-600 ring-clay-500/25";

export const STATUS_COLORS: Record<Status, string> = {
  "New Lead": NEUTRAL,
  Contacted: SKY,
  Interested: INDIGO,
  "Needs Follow-Up": AMBER,
  "Approved for Bottles": GOLD,
  "Bottle Sent": SAGE,
  "Posted Content": FUCHSIA,
  "Ambassador Signed Up": EMERALD,
  "Not Interested": ROSE,
};

export const PRIORITY_COLORS: Record<BottlePriority, string> = {
  Low: NEUTRAL,
  Medium: SKY,
  High: AMBER,
  VIP: GOLD,
};

export const BOTTLE_STATUS_COLORS: Record<BottleStatus, string> = {
  "Not planned": NEUTRAL,
  "Want to send": INDIGO,
  "Need address": ROSE,
  "Ready to send": GOLD,
  Sent: SKY,
  Delivered: SAGE,
  "Followed up": EMERALD,
};

export const RELATIONSHIP_COLORS: Record<RelationshipStrength, string> = {
  Cold: NEUTRAL,
  Warm: AMBER,
  Hot: CLAY,
  "Close Friend": SAGE,
};

// ---------------- Deal flow ----------------

export const DEAL_TYPES: DealType[] = [
  "Wholesale",
  "Distribution",
  "Retail",
  "Partnership",
  "Ambassador",
  "Sponsorship",
  "Other",
];

// Ordered pipeline. "Won" and "Lost" are terminal.
export const DEAL_STAGES: DealStage[] = [
  "Lead",
  "Contacted",
  "Qualified",
  "Meeting",
  "Proposal",
  "Negotiation",
  "Won",
  "Lost",
];

export const OPEN_STAGES: DealStage[] = DEAL_STAGES.filter(
  (s) => s !== "Won" && s !== "Lost"
);

export const DEAL_ACTIVITY_TYPES: DealActivityType[] = [
  "Call",
  "Email",
  "DM",
  "Meeting",
  "Sample sent",
  "Proposal sent",
  "Follow-up",
  "Contract",
  "Note",
];

// Default win probability per stage (used for weighted pipeline when a deal
// has no explicit probability set).
export const STAGE_PROBABILITY: Record<DealStage, number> = {
  Lead: 10,
  Contacted: 20,
  Qualified: 35,
  Meeting: 50,
  Proposal: 65,
  Negotiation: 80,
  Won: 100,
  Lost: 0,
};

export const STAGE_COLORS: Record<DealStage, string> = {
  Lead: NEUTRAL,
  Contacted: SKY,
  Qualified: INDIGO,
  Meeting: VIOLET,
  Proposal: AMBER,
  Negotiation: GOLD,
  Won: SAGE,
  Lost: ROSE,
};

export const DEAL_TYPE_COLORS: Record<DealType, string> = {
  Wholesale: GOLD,
  Distribution: INDIGO,
  Retail: SKY,
  Partnership: VIOLET,
  Ambassador: EMERALD,
  Sponsorship: FUCHSIA,
  Other: NEUTRAL,
};
