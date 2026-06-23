"use client";

import { getSupabase, isCloudEnabled } from "./supabase";
import { SEED_CONTACTS, SEED_INTERACTIONS } from "./seed";
import type {
  Contact,
  Interaction,
  NewContact,
  NewInteraction,
} from "./types";

export const storageMode: "cloud" | "local" = isCloudEnabled ? "cloud" : "local";

const CONTACTS_KEY = "nukava_contacts_v1";
const INTERACTIONS_KEY = "nukava_interactions_v1";
const SEEDED_KEY = "nukava_seeded_v1";

function uid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "id_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function nowISO(): string {
  return new Date().toISOString();
}

// ---------- Local storage adapter ----------

function readLocal<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function writeLocal<T>(key: string, value: T[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function ensureSeeded(): void {
  if (typeof window === "undefined") return;
  if (window.localStorage.getItem(SEEDED_KEY)) return;
  writeLocal(CONTACTS_KEY, SEED_CONTACTS);
  writeLocal(INTERACTIONS_KEY, SEED_INTERACTIONS);
  window.localStorage.setItem(SEEDED_KEY, "1");
}

// ---------- Public API ----------

export async function listContacts(): Promise<Contact[]> {
  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb
      .from("contacts")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as Contact[];
  }
  ensureSeeded();
  return readLocal<Contact>(CONTACTS_KEY).sort((a, b) =>
    b.updated_at.localeCompare(a.updated_at)
  );
}

export async function getContact(id: string): Promise<Contact | null> {
  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb.from("contacts").select("*").eq("id", id).single();
    if (error) return null;
    return data as Contact;
  }
  ensureSeeded();
  return readLocal<Contact>(CONTACTS_KEY).find((c) => c.id === id) ?? null;
}

export async function createContact(input: NewContact): Promise<Contact> {
  const sb = getSupabase();
  const ts = nowISO();
  if (sb) {
    const { data, error } = await sb
      .from("contacts")
      .insert({ ...input, created_at: ts, updated_at: ts })
      .select("*")
      .single();
    if (error) throw error;
    return data as Contact;
  }
  ensureSeeded();
  const contact: Contact = { ...input, id: uid(), created_at: ts, updated_at: ts };
  const all = readLocal<Contact>(CONTACTS_KEY);
  all.unshift(contact);
  writeLocal(CONTACTS_KEY, all);
  return contact;
}

export async function updateContact(
  id: string,
  patch: Partial<Contact>
): Promise<Contact> {
  const sb = getSupabase();
  const ts = nowISO();
  if (sb) {
    const { data, error } = await sb
      .from("contacts")
      .update({ ...patch, updated_at: ts })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return data as Contact;
  }
  ensureSeeded();
  const all = readLocal<Contact>(CONTACTS_KEY);
  const idx = all.findIndex((c) => c.id === id);
  if (idx === -1) throw new Error("Contact not found");
  all[idx] = { ...all[idx], ...patch, updated_at: ts };
  writeLocal(CONTACTS_KEY, all);
  return all[idx];
}

export async function deleteContact(id: string): Promise<void> {
  const sb = getSupabase();
  if (sb) {
    await sb.from("interactions").delete().eq("contact_id", id);
    const { error } = await sb.from("contacts").delete().eq("id", id);
    if (error) throw error;
    return;
  }
  ensureSeeded();
  writeLocal(
    CONTACTS_KEY,
    readLocal<Contact>(CONTACTS_KEY).filter((c) => c.id !== id)
  );
  writeLocal(
    INTERACTIONS_KEY,
    readLocal<Interaction>(INTERACTIONS_KEY).filter((i) => i.contact_id !== id)
  );
}

export async function listInteractions(contactId: string): Promise<Interaction[]> {
  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb
      .from("interactions")
      .select("*")
      .eq("contact_id", contactId)
      .order("date", { ascending: false });
    if (error) throw error;
    return (data ?? []) as Interaction[];
  }
  ensureSeeded();
  return readLocal<Interaction>(INTERACTIONS_KEY)
    .filter((i) => i.contact_id === contactId)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export async function createInteraction(input: NewInteraction): Promise<Interaction> {
  const sb = getSupabase();
  const ts = nowISO();
  if (sb) {
    const { data, error } = await sb
      .from("interactions")
      .insert({ ...input, created_at: ts })
      .select("*")
      .single();
    if (error) throw error;
    return data as Interaction;
  }
  ensureSeeded();
  const interaction: Interaction = { ...input, id: uid(), created_at: ts };
  const all = readLocal<Interaction>(INTERACTIONS_KEY);
  all.unshift(interaction);
  writeLocal(INTERACTIONS_KEY, all);
  return interaction;
}

export async function deleteInteraction(id: string): Promise<void> {
  const sb = getSupabase();
  if (sb) {
    const { error } = await sb.from("interactions").delete().eq("id", id);
    if (error) throw error;
    return;
  }
  ensureSeeded();
  writeLocal(
    INTERACTIONS_KEY,
    readLocal<Interaction>(INTERACTIONS_KEY).filter((i) => i.id !== id)
  );
}

// Used by CSV/JSON import to bulk-replace local data.
export async function importContacts(contacts: Contact[]): Promise<void> {
  const sb = getSupabase();
  if (sb) {
    const { error } = await sb.from("contacts").upsert(contacts);
    if (error) throw error;
    return;
  }
  ensureSeeded();
  const existing = readLocal<Contact>(CONTACTS_KEY);
  const byId = new Map(existing.map((c) => [c.id, c]));
  for (const c of contacts) byId.set(c.id, c);
  writeLocal(CONTACTS_KEY, Array.from(byId.values()));
}

export async function getAllForBackup(): Promise<{
  contacts: Contact[];
  interactions: Interaction[];
}> {
  const sb = getSupabase();
  if (sb) {
    const [c, i] = await Promise.all([
      sb.from("contacts").select("*"),
      sb.from("interactions").select("*"),
    ]);
    return {
      contacts: (c.data ?? []) as Contact[],
      interactions: (i.data ?? []) as Interaction[],
    };
  }
  ensureSeeded();
  return {
    contacts: readLocal<Contact>(CONTACTS_KEY),
    interactions: readLocal<Interaction>(INTERACTIONS_KEY),
  };
}
