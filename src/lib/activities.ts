"use client";

import { getSupabase } from "./supabase";
import { SEED_ACTIVITIES } from "./seed";
import type { Activity, NewActivity } from "./types";

const ACTIVITIES_KEY = "nukava_activities_v1";
const ACTIVITIES_SEEDED_KEY = "nukava_activities_seeded_v1";

function uid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "id_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}
function nowISO(): string {
  return new Date().toISOString();
}

function readLocal(): Activity[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(ACTIVITIES_KEY);
    return raw ? (JSON.parse(raw) as Activity[]) : [];
  } catch {
    return [];
  }
}
function writeLocal(value: Activity[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACTIVITIES_KEY, JSON.stringify(value));
}

function ensureSeeded(): void {
  if (typeof window === "undefined") return;
  if (window.localStorage.getItem(ACTIVITIES_SEEDED_KEY)) return;
  writeLocal(SEED_ACTIVITIES);
  window.localStorage.setItem(ACTIVITIES_SEEDED_KEY, "1");
}

export async function listActivities(contactId: string): Promise<Activity[]> {
  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb
      .from("activities")
      .select("*")
      .eq("contact_id", contactId)
      .order("occurred_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as Activity[];
  }
  ensureSeeded();
  return readLocal()
    .filter((a) => a.contact_id === contactId)
    .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
}

// Most recent identified signals across all contacts — powers the dashboard.
export async function listRecentActivities(limit = 30): Promise<Activity[]> {
  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb
      .from("activities")
      .select("*")
      .not("contact_id", "is", null)
      .order("occurred_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as Activity[];
  }
  ensureSeeded();
  return readLocal()
    .filter((a) => a.contact_id)
    .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
    .slice(0, limit);
}

export async function createActivity(input: NewActivity): Promise<Activity> {
  const sb = getSupabase();
  const ts = nowISO();
  if (sb) {
    const { data, error } = await sb
      .from("activities")
      .insert({ ...input, created_at: ts })
      .select("*")
      .single();
    if (error) throw error;
    return data as Activity;
  }
  const activity: Activity = { ...input, id: uid(), created_at: ts };
  const all = readLocal();
  all.unshift(activity);
  writeLocal(all);
  return activity;
}
