import type { Contact, Interaction } from "./types";
import { blankContact, fullContact } from "./helpers";

// Column order for CSV export/import.
const COLUMNS: (keyof Contact)[] = [
  "id",
  "name",
  "phone",
  "email",
  "instagram",
  "tiktok",
  "city",
  "state",
  "contact_type",
  "relationship_strength",
  "lead_temperature",
  "status",
  "source",
  "follower_count",
  "audience_type",
  "owner",
  "tags",
  "outreach_status",
  "notes",
  "last_contacted_date",
  "next_follow_up_date",
  "bottle_recipient",
  "bottle_priority",
  "bottle_status",
  "bottle_quantity",
  "shipping_name",
  "shipping_address",
  "tracking_number",
  "date_sent",
  "date_delivered",
  "posted_content",
  "ambassador_signup",
  "discount_code",
  "sales_generated",
  "created_at",
  "updated_at",
];

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  // arrays (e.g. tags) are joined with semicolons so commas stay CSV-safe
  const s = Array.isArray(value) ? value.join("; ") : String(value);
  if (/[",\n]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

export function contactsToCsv(contacts: Contact[]): string {
  const header = COLUMNS.join(",");
  const rows = contacts.map((c) =>
    COLUMNS.map((col) => escapeCell(c[col])).join(",")
  );
  return [header, ...rows].join("\n");
}

// Minimal RFC-4180-ish CSV parser that handles quoted fields and commas.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const t = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (inQuotes) {
      if (ch === '"') {
        if (t[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(field);
        field = "";
      } else if (ch === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else {
        field += ch;
      }
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

const BOOL_FIELDS = new Set<keyof Contact>([
  "bottle_recipient",
  "posted_content",
  "ambassador_signup",
]);
const NUMBER_FIELDS = new Set<keyof Contact>([
  "follower_count",
  "bottle_quantity",
  "sales_generated",
]);

function coerce(field: keyof Contact, raw: string): unknown {
  const v = raw.trim();
  if (field === "tags") {
    return v
      ? v
          .split(/[;,]/)
          .map((t) => t.trim())
          .filter(Boolean)
      : [];
  }
  if (BOOL_FIELDS.has(field)) {
    return /^(true|yes|y|1)$/i.test(v);
  }
  if (NUMBER_FIELDS.has(field)) {
    if (v === "") return null;
    const n = Number(v.replace(/[^0-9.\-]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return v;
}

// Maps common header aliases so messy creator-list CSVs still import.
const HEADER_ALIASES: Record<string, keyof Contact> = {
  name: "name",
  "full name": "name",
  phone: "phone",
  "phone number": "phone",
  email: "email",
  "e-mail": "email",
  instagram: "instagram",
  ig: "instagram",
  "instagram handle": "instagram",
  tiktok: "tiktok",
  "tiktok handle": "tiktok",
  city: "city",
  state: "state",
  "contact type": "contact_type",
  type: "contact_type",
  followers: "follower_count",
  "follower count": "follower_count",
  notes: "notes",
  status: "status",
  source: "source",
  "shipping address": "shipping_address",
  address: "shipping_address",
};

export function csvToContacts(text: string): Contact[] {
  const rows = parseCsv(text);
  if (rows.length === 0) return [];
  const rawHeaders = rows[0].map((h) => h.trim());
  const validFields = new Set(COLUMNS);

  const headerMap = rawHeaders.map((h): keyof Contact | null => {
    const lower = h.toLowerCase();
    if (validFields.has(h as keyof Contact)) return h as keyof Contact;
    if (validFields.has(lower as keyof Contact)) return lower as keyof Contact;
    return HEADER_ALIASES[lower] ?? null;
  });

  const out: Contact[] = [];
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    const base = blankContact();
    const partial: Record<string, unknown> = { ...base };
    headerMap.forEach((field, idx) => {
      if (!field) return;
      const raw = cells[idx] ?? "";
      partial[field] = coerce(field, raw);
    });
    // build a full contact; keep provided id if present, else generate
    const built = fullContact(base);
    const merged = { ...built, ...partial } as Contact;
    if (!merged.id) merged.id = built.id;
    if (!merged.name) continue; // skip rows with no name
    out.push(merged);
  }
  return out;
}

export function download(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function backupJson(contacts: Contact[], interactions: Interaction[]): string {
  return JSON.stringify(
    { version: 1, exportedAt: new Date().toISOString(), contacts, interactions },
    null,
    2
  );
}
