import type { Contact, NewContact } from "./types";

export function blankContact(): NewContact {
  return {
    name: "",
    phone: "",
    email: "",
    instagram: "",
    tiktok: "",
    city: "",
    state: "",
    contact_type: "Creator",
    relationship_strength: "Cold",
    lead_temperature: "Cold",
    status: "New Lead",
    source: "",
    follower_count: null,
    audience_type: "",
    owner: "",
    notes: "",
    last_contacted_date: null,
    next_follow_up_date: null,
    bottle_recipient: false,
    bottle_priority: "Medium",
    bottle_status: "Not planned",
    bottle_quantity: null,
    shipping_name: "",
    shipping_address: "",
    tracking_number: "",
    date_sent: null,
    date_delivered: null,
    posted_content: false,
    ambassador_signup: false,
    discount_code: "",
    sales_generated: null,
    created_at: "",
    updated_at: "",
  } as unknown as NewContact;
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return dateStr < todayISO();
}

export function isToday(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return dateStr === todayISO();
}

export function isDueSoon(dateStr: string | null, withinDays = 7): boolean {
  if (!dateStr) return false;
  const today = todayISO();
  const limit = new Date();
  limit.setDate(limit.getDate() + withinDays);
  const limitStr = limit.toISOString().slice(0, 10);
  return dateStr >= today && dateStr <= limitStr;
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr + (dateStr.length === 10 ? "T00:00:00" : ""));
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function instagramUrl(handle: string): string | null {
  if (!handle) return null;
  return "https://instagram.com/" + handle.replace(/^@/, "");
}

export function tiktokUrl(handle: string): string | null {
  if (!handle) return null;
  return "https://tiktok.com/@" + handle.replace(/^@/, "");
}

export function fullContact(input: NewContact): Contact {
  const ts = new Date().toISOString();
  return {
    ...input,
    id:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : "id_" + Math.random().toString(36).slice(2),
    created_at: ts,
    updated_at: ts,
  } as Contact;
}
