"use client";

import { getSupabase } from "./supabase";
import type { NewTask, Task } from "./types";

const TASKS_KEY = "nukava_tasks_v1";

function uid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "id_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}
function nowISO(): string {
  return new Date().toISOString();
}

function readLocal(): Task[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(TASKS_KEY);
    return raw ? (JSON.parse(raw) as Task[]) : [];
  } catch {
    return [];
  }
}
function writeLocal(value: Task[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TASKS_KEY, JSON.stringify(value));
}

export async function listTasks(): Promise<Task[]> {
  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb
      .from("tasks")
      .select("*")
      .order("due_date", { ascending: true, nullsFirst: false });
    if (error) throw error;
    return (data ?? []) as Task[];
  }
  return readLocal().sort((a, b) =>
    (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999")
  );
}

export async function createTask(input: NewTask): Promise<Task> {
  const sb = getSupabase();
  const ts = nowISO();
  if (sb) {
    const { data, error } = await sb
      .from("tasks")
      .insert({ ...input, created_at: ts, updated_at: ts })
      .select("*")
      .single();
    if (error) throw error;
    return data as Task;
  }
  const task: Task = { ...input, id: uid(), created_at: ts, updated_at: ts };
  const all = readLocal();
  all.unshift(task);
  writeLocal(all);
  return task;
}

export async function updateTask(id: string, patch: Partial<Task>): Promise<Task> {
  const sb = getSupabase();
  const ts = nowISO();
  if (sb) {
    const { data, error } = await sb
      .from("tasks")
      .update({ ...patch, updated_at: ts })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return data as Task;
  }
  const all = readLocal();
  const idx = all.findIndex((t) => t.id === id);
  if (idx === -1) throw new Error("Task not found");
  all[idx] = { ...all[idx], ...patch, updated_at: ts };
  writeLocal(all);
  return all[idx];
}

export async function deleteTask(id: string): Promise<void> {
  const sb = getSupabase();
  if (sb) {
    const { error } = await sb.from("tasks").delete().eq("id", id);
    if (error) throw error;
    return;
  }
  writeLocal(readLocal().filter((t) => t.id !== id));
}
