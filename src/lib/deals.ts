"use client";

import { getSupabase } from "./supabase";
import type { Deal, DealActivity, NewDeal, NewDealActivity } from "./types";

const DEALS_KEY = "nukava_deals_v1";
const DEAL_ACTIVITIES_KEY = "nukava_deal_activities_v1";
const DEALS_SEEDED_KEY = "nukava_deals_seeded_v1";

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

function seedDeals(): Deal[] {
  const ts = nowISO();
  const base = (d: Partial<Deal>): Deal => ({
    id: uid(),
    title: "",
    company: "",
    contact_id: null,
    deal_type: "Wholesale",
    stage: "Lead",
    value: null,
    probability: null,
    expected_close_date: null,
    owner: "Taylor",
    source: "",
    next_step: "",
    next_step_date: null,
    notes: "",
    created_at: ts,
    updated_at: ts,
    ...d,
  });
  return [
    base({
      title: "Coastal Health Market — wholesale",
      company: "Coastal Health Market",
      deal_type: "Wholesale",
      stage: "Qualified",
      value: 4800,
      expected_close_date: daysFromNow(21),
      source: "Cold outreach",
      next_step: "Send wholesale pricing + sample box",
      next_step_date: daysFromNow(2),
      notes: "Independent market, 1 location. Wants to trial 2 SKUs.",
    }),
    base({
      title: "Greenleaf Distributors — PNW distribution",
      company: "Greenleaf Distributors",
      deal_type: "Distribution",
      stage: "Meeting",
      value: 22000,
      expected_close_date: daysFromNow(40),
      source: "Trade show",
      next_step: "Discovery call with buying team",
      next_step_date: daysFromNow(-1),
      notes: "Covers 40+ stores in the PNW. Asked for distributor terms.",
    }),
    base({
      title: "BrightReach Agency — creator bundle",
      company: "BrightReach Agency",
      deal_type: "Partnership",
      stage: "Proposal",
      value: 9000,
      expected_close_date: daysFromNow(14),
      source: "Referral",
      next_step: "Follow up on proposal",
      next_step_date: daysFromNow(1),
      notes: "Seeding + wholesale combo across their roster.",
    }),
    base({
      title: "Devin Carter — ambassador renewal",
      company: "Devin Carter",
      deal_type: "Ambassador",
      stage: "Negotiation",
      value: 1500,
      expected_close_date: daysFromNow(7),
      source: "Existing ambassador",
      next_step: "Agree on monthly content + commission",
      next_step_date: daysFromNow(3),
      notes: "Renewing for another quarter, wants higher commission.",
    }),
    base({
      title: "Summit Gyms — sponsorship",
      company: "Summit Gyms",
      deal_type: "Sponsorship",
      stage: "Won",
      value: 6000,
      probability: 100,
      expected_close_date: daysFromNow(-5),
      source: "Event contact",
      next_step: "Deliver first shipment",
      next_step_date: daysFromNow(4),
      notes: "Closed — 3-location gym chain, branded cooler placement.",
    }),
  ];
}

function ensureSeeded(): void {
  if (typeof window === "undefined") return;
  if (window.localStorage.getItem(DEALS_SEEDED_KEY)) return;
  writeLocal(DEALS_KEY, seedDeals());
  writeLocal(DEAL_ACTIVITIES_KEY, []);
  window.localStorage.setItem(DEALS_SEEDED_KEY, "1");
}

// ---------------- Deals ----------------

export async function listDeals(): Promise<Deal[]> {
  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb
      .from("deals")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as Deal[];
  }
  ensureSeeded();
  return readLocal<Deal>(DEALS_KEY).sort((a, b) =>
    b.updated_at.localeCompare(a.updated_at)
  );
}

export async function getDeal(id: string): Promise<Deal | null> {
  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb.from("deals").select("*").eq("id", id).single();
    if (error) return null;
    return data as Deal;
  }
  ensureSeeded();
  return readLocal<Deal>(DEALS_KEY).find((d) => d.id === id) ?? null;
}

export async function createDeal(input: NewDeal): Promise<Deal> {
  const sb = getSupabase();
  const ts = nowISO();
  if (sb) {
    const { data, error } = await sb
      .from("deals")
      .insert({ ...input, created_at: ts, updated_at: ts })
      .select("*")
      .single();
    if (error) throw error;
    return data as Deal;
  }
  ensureSeeded();
  const deal: Deal = { ...input, id: uid(), created_at: ts, updated_at: ts };
  const all = readLocal<Deal>(DEALS_KEY);
  all.unshift(deal);
  writeLocal(DEALS_KEY, all);
  return deal;
}

export async function updateDeal(id: string, patch: Partial<Deal>): Promise<Deal> {
  const sb = getSupabase();
  const ts = nowISO();
  if (sb) {
    const { data, error } = await sb
      .from("deals")
      .update({ ...patch, updated_at: ts })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return data as Deal;
  }
  ensureSeeded();
  const all = readLocal<Deal>(DEALS_KEY);
  const idx = all.findIndex((d) => d.id === id);
  if (idx === -1) throw new Error("Deal not found");
  all[idx] = { ...all[idx], ...patch, updated_at: ts };
  writeLocal(DEALS_KEY, all);
  return all[idx];
}

export async function deleteDeal(id: string): Promise<void> {
  const sb = getSupabase();
  if (sb) {
    await sb.from("deal_activities").delete().eq("deal_id", id);
    const { error } = await sb.from("deals").delete().eq("id", id);
    if (error) throw error;
    return;
  }
  ensureSeeded();
  writeLocal(DEALS_KEY, readLocal<Deal>(DEALS_KEY).filter((d) => d.id !== id));
  writeLocal(
    DEAL_ACTIVITIES_KEY,
    readLocal<DealActivity>(DEAL_ACTIVITIES_KEY).filter((a) => a.deal_id !== id)
  );
}

// ---------------- Deal activities ----------------

export async function listDealActivities(dealId: string): Promise<DealActivity[]> {
  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb
      .from("deal_activities")
      .select("*")
      .eq("deal_id", dealId)
      .order("date", { ascending: false });
    if (error) throw error;
    return (data ?? []) as DealActivity[];
  }
  ensureSeeded();
  return readLocal<DealActivity>(DEAL_ACTIVITIES_KEY)
    .filter((a) => a.deal_id === dealId)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export async function createDealActivity(
  input: NewDealActivity
): Promise<DealActivity> {
  const sb = getSupabase();
  const ts = nowISO();
  if (sb) {
    const { data, error } = await sb
      .from("deal_activities")
      .insert({ ...input, created_at: ts })
      .select("*")
      .single();
    if (error) throw error;
    return data as DealActivity;
  }
  ensureSeeded();
  const activity: DealActivity = { ...input, id: uid(), created_at: ts };
  const all = readLocal<DealActivity>(DEAL_ACTIVITIES_KEY);
  all.unshift(activity);
  writeLocal(DEAL_ACTIVITIES_KEY, all);
  return activity;
}

export async function deleteDealActivity(id: string): Promise<void> {
  const sb = getSupabase();
  if (sb) {
    const { error } = await sb.from("deal_activities").delete().eq("id", id);
    if (error) throw error;
    return;
  }
  ensureSeeded();
  writeLocal(
    DEAL_ACTIVITIES_KEY,
    readLocal<DealActivity>(DEAL_ACTIVITIES_KEY).filter((a) => a.id !== id)
  );
}
