import { isOverdue, isToday } from "./helpers";
import type { Contact } from "./types";

export interface ViewDef {
  id: string;
  label: string;
  predicate: (c: Contact) => boolean;
}

export const VIEWS: ViewDef[] = [
  { id: "all", label: "All Contacts", predicate: () => true },
  {
    id: "hot",
    label: "Hot Leads",
    predicate: (c) =>
      c.lead_temperature === "Hot" || c.relationship_strength === "Hot",
  },
  {
    id: "giveaway",
    label: "Kava Giveaway List",
    predicate: (c) =>
      c.bottle_recipient &&
      !["Sent", "Delivered", "Followed up"].includes(c.bottle_status),
  },
  {
    id: "ready",
    label: "Ready to Send",
    predicate: (c) => c.bottle_status === "Ready to send",
  },
  {
    id: "missing-address",
    label: "Missing Address",
    predicate: (c) =>
      c.bottle_recipient &&
      c.shipping_address.trim() === "" &&
      !["Sent", "Delivered", "Followed up"].includes(c.bottle_status),
  },
  {
    id: "sent",
    label: "Bottles Sent",
    predicate: (c) => ["Sent", "Delivered", "Followed up"].includes(c.bottle_status),
  },
  {
    id: "followup",
    label: "Needs Follow-Up",
    predicate: (c) =>
      c.status === "Needs Follow-Up" ||
      isOverdue(c.next_follow_up_date) ||
      isToday(c.next_follow_up_date),
  },
  { id: "creators", label: "Creators", predicate: (c) => c.contact_type === "Creator" },
  { id: "agencies", label: "Agencies", predicate: (c) => c.contact_type === "Agency" },
  {
    id: "ambassadors",
    label: "Ambassadors",
    predicate: (c) =>
      c.contact_type === "Ambassador" || c.ambassador_signup,
  },
  {
    id: "wholesale",
    label: "Wholesale / Retail",
    predicate: (c) => c.contact_type === "Wholesale" || c.contact_type === "Retailer",
  },
  {
    id: "utah",
    label: "Utah Contacts",
    predicate: (c) => c.state.trim().toUpperCase() === "UT",
  },
];

export function searchContact(c: Contact, q: string): boolean {
  if (!q.trim()) return true;
  const hay = [
    c.name,
    c.instagram,
    c.tiktok,
    c.city,
    c.state,
    c.status,
    c.notes,
    c.email,
    c.phone,
    c.contact_type,
    c.source,
    ...(c.tags ?? []),
  ]
    .join(" ")
    .toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .every((term) => hay.includes(term));
}
