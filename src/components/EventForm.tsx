"use client";

import { useState } from "react";
import { Select } from "./ContactForm";
import { EVENT_STATUSES, EVENT_TYPES } from "@/lib/constants";
import type { CrmEvent, NewEvent } from "@/lib/types";

function blankEvent(): NewEvent {
  return {
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
  };
}

function toForm(e?: CrmEvent): NewEvent {
  if (!e) return blankEvent();
  const { id, created_at, updated_at, ...rest } = e;
  return rest;
}

export function EventForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: CrmEvent;
  onSubmit: (values: NewEvent) => Promise<void> | void;
  onCancel: () => void;
}) {
  const [v, setV] = useState<NewEvent>(toForm(initial));
  const [saving, setSaving] = useState(false);

  function set<K extends keyof NewEvent>(key: K, value: NewEvent[K]) {
    setV((prev) => ({ ...prev, [key]: value }));
  }
  function numOrNull(s: string): number | null {
    if (s.trim() === "") return null;
    const n = Number(s.replace(/[^0-9.\-]/g, ""));
    return Number.isFinite(n) ? n : null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!v.name.trim()) return;
    setSaving(true);
    try {
      await onSubmit(v);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Event name *" className="sm:col-span-2">
          <input
            className="input"
            value={v.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="e.g. SLC Kalapu Night"
            autoFocus
          />
        </Field>
        <Field label="Type">
          <Select value={v.type} onChange={(x) => set("type", x as any)} options={EVENT_TYPES} />
        </Field>
        <Field label="Status">
          <Select value={v.status} onChange={(x) => set("status", x as any)} options={EVENT_STATUSES} />
        </Field>
        <Field label="Date">
          <input className="input" type="date" value={v.date ?? ""} onChange={(e) => set("date", e.target.value || null)} />
        </Field>
        <Field label="Cost ($)">
          <input className="input" inputMode="numeric" value={v.cost ?? ""} onChange={(e) => set("cost", numOrNull(e.target.value))} />
        </Field>
        <Field label="City">
          <input className="input" value={v.city} onChange={(e) => set("city", e.target.value)} />
        </Field>
        <Field label="State">
          <input className="input" value={v.state} onChange={(e) => set("state", e.target.value)} />
        </Field>
        <Field label="Venue">
          <input className="input" value={v.venue} onChange={(e) => set("venue", e.target.value)} placeholder="Where is it?" />
        </Field>
        <Field label="Host / organizer">
          <input className="input" value={v.host} onChange={(e) => set("host", e.target.value)} />
        </Field>
        <Field label="Goal" className="sm:col-span-2">
          <input className="input" value={v.goal} onChange={(e) => set("goal", e.target.value)} placeholder="e.g. Hand out 20 bottles, sign 2 ambassadors" />
        </Field>
        <Field label="Link" className="sm:col-span-2">
          <input className="input" value={v.url} onChange={(e) => set("url", e.target.value)} placeholder="Event page / RSVP" />
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <textarea className="input min-h-[70px]" value={v.notes} onChange={(e) => set("notes", e.target.value)} />
        </Field>
      </div>

      <div className="sticky bottom-0 -mx-5 flex justify-end gap-2 border-t border-night-900/5 bg-cream-50/95 px-5 py-3 backdrop-blur">
        <button type="button" onClick={onCancel} className="btn-ghost">
          Cancel
        </button>
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? "Saving…" : initial ? "Save changes" : "Add event"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}
