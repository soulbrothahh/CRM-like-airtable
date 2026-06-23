"use client";

import { getSupabase } from "./supabase";
import type { CrmEvent, NewEvent } from "./types";

const EVENTS_KEY = "nukava_events_v1";
const EVENTS_SEEDED_KEY = "nukava_events_seeded_v1";

function uid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "id_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}
function nowISO(): string {
  return new Date().toISOString();
}
function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function readLocal(): CrmEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(EVENTS_KEY);
    return raw ? (JSON.parse(raw) as CrmEvent[]) : [];
  } catch {
    return [];
  }
}
function writeLocal(value: CrmEvent[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(EVENTS_KEY, JSON.stringify(value));
}

function seedEvents(): CrmEvent[] {
  const ts = nowISO();
  const base = (e: Partial<CrmEvent>): CrmEvent => ({
    id: uid(),
    name: "",
    type: "Kalapu",
    status: "Idea",
    date: null,
    city: "",
    state: "",
    venue: "",
    host: "",
    goal: "",
    cost: null,
    url: "",
    notes: "",
    created_at: ts,
    updated_at: ts,
    ...e,
  });
  return [
    base({
      name: "SLC Kalapu Night",
      type: "Kalapu",
      status: "Going",
      date: daysFromNow(6),
      city: "Salt Lake City",
      state: "UT",
      venue: "Tongan community hall",
      host: "Community group",
      goal: "Hand out 20 samples, sign 2 ambassadors",
      cost: 50,
      notes: "Big local kava crowd — bring the cooler and discount cards.",
    }),
    base({
      name: "Provo Wellness Mixer",
      type: "Mixer",
      status: "Reaching out",
      date: daysFromNow(13),
      city: "Provo",
      state: "UT",
      venue: "Startup co-working space",
      goal: "Meet creators + gym owners",
      cost: 0,
      notes: "Reaching out to the host about a sampling table.",
    }),
    base({
      name: "Park City Farmers Market",
      type: "Farmers market",
      status: "Researching",
      date: daysFromNow(20),
      city: "Park City",
      state: "UT",
      goal: "Test retail interest",
      notes: "Check booth fees and permit requirements.",
    }),
    base({
      name: "Friday Kava Circle",
      type: "Kava circle",
      status: "Attended",
      date: daysFromNow(-4),
      city: "Ogden",
      state: "UT",
      venue: "Backyard",
      goal: "Casual hangout, share new flavor",
      notes: "Great vibe — a few people want bottles. Follow up this week.",
    }),
  ];
}

function ensureSeeded(): void {
  if (typeof window === "undefined") return;
  if (window.localStorage.getItem(EVENTS_SEEDED_KEY)) return;
  writeLocal(seedEvents());
  window.localStorage.setItem(EVENTS_SEEDED_KEY, "1");
}

export async function listEvents(): Promise<CrmEvent[]> {
  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb
      .from("events")
      .select("*")
      .order("date", { ascending: true, nullsFirst: false });
    if (error) throw error;
    return (data ?? []) as CrmEvent[];
  }
  ensureSeeded();
  return readLocal().sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999"));
}

export async function getEvent(id: string): Promise<CrmEvent | null> {
  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb.from("events").select("*").eq("id", id).single();
    if (error) return null;
    return data as CrmEvent;
  }
  ensureSeeded();
  return readLocal().find((e) => e.id === id) ?? null;
}

export async function createEvent(input: NewEvent): Promise<CrmEvent> {
  const sb = getSupabase();
  const ts = nowISO();
  if (sb) {
    const { data, error } = await sb
      .from("events")
      .insert({ ...input, created_at: ts, updated_at: ts })
      .select("*")
      .single();
    if (error) throw error;
    return data as CrmEvent;
  }
  ensureSeeded();
  const ev: CrmEvent = { ...input, id: uid(), created_at: ts, updated_at: ts };
  const all = readLocal();
  all.unshift(ev);
  writeLocal(all);
  return ev;
}

export async function updateEvent(id: string, patch: Partial<CrmEvent>): Promise<CrmEvent> {
  const sb = getSupabase();
  const ts = nowISO();
  if (sb) {
    const { data, error } = await sb
      .from("events")
      .update({ ...patch, updated_at: ts })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return data as CrmEvent;
  }
  ensureSeeded();
  const all = readLocal();
  const idx = all.findIndex((e) => e.id === id);
  if (idx === -1) throw new Error("Event not found");
  all[idx] = { ...all[idx], ...patch, updated_at: ts };
  writeLocal(all);
  return all[idx];
}

export async function deleteEvent(id: string): Promise<void> {
  const sb = getSupabase();
  if (sb) {
    const { error } = await sb.from("events").delete().eq("id", id);
    if (error) throw error;
    return;
  }
  ensureSeeded();
  writeLocal(readLocal().filter((e) => e.id !== id));
}
