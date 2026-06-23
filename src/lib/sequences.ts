"use client";

import { getSupabase } from "./supabase";
import type { NewSequence, Sequence } from "./types";

const SEQ_KEY = "nukava_sequences_v1";
const SEQ_SEEDED_KEY = "nukava_sequences_seeded_v1";

function uid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "id_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}
function nowISO(): string {
  return new Date().toISOString();
}

function readLocal(): Sequence[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SEQ_KEY);
    return raw ? (JSON.parse(raw) as Sequence[]) : [];
  } catch {
    return [];
  }
}
function writeLocal(value: Sequence[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SEQ_KEY, JSON.stringify(value));
}

// Built-in starter cadences.
export function defaultSequences(): Sequence[] {
  const ts = nowISO();
  const mk = (s: Omit<Sequence, "id" | "created_at" | "updated_at">): Sequence => ({
    ...s,
    id: uid(),
    created_at: ts,
    updated_at: ts,
  });
  return [
    mk({
      name: "Creator / Ambassador",
      description: "Warm DM cadence to seed a bottle and sign creators.",
      steps: [
        { day: 0, channel: "DM", label: "Intro — offer a free bottle", body: "" },
        { day: 3, channel: "DM", label: "Friendly bump", body: "" },
        { day: 7, channel: "DM", label: "Share a content idea / value", body: "" },
        { day: 14, channel: "DM", label: "Last touch / break-up", body: "" },
      ],
    }),
    mk({
      name: "B2B Wholesale",
      description: "Email cadence for retailers, distributors, and wholesale leads.",
      steps: [
        { day: 0, channel: "Email", label: "Intro + offer samples", body: "" },
        { day: 4, channel: "Email", label: "Follow-up", body: "" },
        { day: 10, channel: "Email", label: "Value / proof + pricing", body: "" },
        { day: 18, channel: "Email", label: "Break-up email", body: "" },
      ],
    }),
  ];
}

function ensureSeeded(): void {
  if (typeof window === "undefined") return;
  if (window.localStorage.getItem(SEQ_SEEDED_KEY)) return;
  writeLocal(defaultSequences());
  window.localStorage.setItem(SEQ_SEEDED_KEY, "1");
}

export async function listSequences(): Promise<Sequence[]> {
  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb
      .from("sequences")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []) as Sequence[];
  }
  ensureSeeded();
  return readLocal();
}

export async function createSequence(input: NewSequence): Promise<Sequence> {
  const sb = getSupabase();
  const ts = nowISO();
  if (sb) {
    const { data, error } = await sb
      .from("sequences")
      .insert({ ...input, created_at: ts, updated_at: ts })
      .select("*")
      .single();
    if (error) throw error;
    return data as Sequence;
  }
  ensureSeeded();
  const seq: Sequence = { ...input, id: uid(), created_at: ts, updated_at: ts };
  const all = readLocal();
  all.push(seq);
  writeLocal(all);
  return seq;
}

export async function updateSequence(id: string, patch: Partial<Sequence>): Promise<Sequence> {
  const sb = getSupabase();
  const ts = nowISO();
  if (sb) {
    const { data, error } = await sb
      .from("sequences")
      .update({ ...patch, updated_at: ts })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return data as Sequence;
  }
  ensureSeeded();
  const all = readLocal();
  const idx = all.findIndex((s) => s.id === id);
  if (idx === -1) throw new Error("Sequence not found");
  all[idx] = { ...all[idx], ...patch, updated_at: ts };
  writeLocal(all);
  return all[idx];
}

export async function deleteSequence(id: string): Promise<void> {
  const sb = getSupabase();
  if (sb) {
    const { error } = await sb.from("sequences").delete().eq("id", id);
    if (error) throw error;
    return;
  }
  ensureSeeded();
  writeLocal(readLocal().filter((s) => s.id !== id));
}

// Seed the two starter cadences into Supabase (call once if empty).
export async function seedDefaultSequences(): Promise<Sequence[]> {
  const created: Sequence[] = [];
  for (const s of defaultSequences()) {
    created.push(
      await createSequence({ name: s.name, description: s.description, steps: s.steps })
    );
  }
  return created;
}
