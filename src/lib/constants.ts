import type {
  BottlePriority,
  BottleStatus,
  ContactType,
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

// Tailwind class sets for colored badges.
export const STATUS_COLORS: Record<Status, string> = {
  "New Lead": "bg-slate-500/15 text-slate-300 ring-slate-400/30",
  Contacted: "bg-sky-500/15 text-sky-300 ring-sky-400/30",
  Interested: "bg-indigo-500/15 text-indigo-300 ring-indigo-400/30",
  "Needs Follow-Up": "bg-amber-500/15 text-amber-300 ring-amber-400/30",
  "Approved for Bottles": "bg-kava-500/15 text-kava-300 ring-kava-400/30",
  "Bottle Sent": "bg-palm-500/15 text-palm-400 ring-palm-400/30",
  "Posted Content": "bg-fuchsia-500/15 text-fuchsia-300 ring-fuchsia-400/30",
  "Ambassador Signed Up": "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30",
  "Not Interested": "bg-rose-500/15 text-rose-300 ring-rose-400/30",
};

export const PRIORITY_COLORS: Record<BottlePriority, string> = {
  Low: "bg-slate-500/15 text-slate-300 ring-slate-400/30",
  Medium: "bg-sky-500/15 text-sky-300 ring-sky-400/30",
  High: "bg-amber-500/15 text-amber-300 ring-amber-400/30",
  VIP: "bg-kava-500/20 text-kava-300 ring-kava-400/40",
};

export const BOTTLE_STATUS_COLORS: Record<BottleStatus, string> = {
  "Not planned": "bg-slate-500/15 text-slate-300 ring-slate-400/30",
  "Want to send": "bg-indigo-500/15 text-indigo-300 ring-indigo-400/30",
  "Need address": "bg-rose-500/15 text-rose-300 ring-rose-400/30",
  "Ready to send": "bg-kava-500/15 text-kava-300 ring-kava-400/30",
  Sent: "bg-sky-500/15 text-sky-300 ring-sky-400/30",
  Delivered: "bg-palm-500/15 text-palm-400 ring-palm-400/30",
  "Followed up": "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30",
};

export const RELATIONSHIP_COLORS: Record<RelationshipStrength, string> = {
  Cold: "bg-slate-500/15 text-slate-300 ring-slate-400/30",
  Warm: "bg-amber-500/15 text-amber-300 ring-amber-400/30",
  Hot: "bg-rose-500/15 text-rose-300 ring-rose-400/30",
  "Close Friend": "bg-palm-500/15 text-palm-400 ring-palm-400/30",
};
