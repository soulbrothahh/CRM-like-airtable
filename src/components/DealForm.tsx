"use client";

import { useState } from "react";
import { useData } from "./DataProvider";
import { Select } from "./ContactForm";
import { DEAL_STAGES, DEAL_TYPES } from "@/lib/constants";
import type { Deal, NewDeal } from "@/lib/types";

function blankDeal(): NewDeal {
  return {
    title: "",
    company: "",
    contact_id: null,
    deal_type: "Wholesale",
    stage: "Lead",
    value: null,
    probability: null,
    expected_close_date: null,
    owner: "",
    source: "",
    next_step: "",
    next_step_date: null,
    notes: "",
  };
}

function toForm(d?: Deal): NewDeal {
  if (!d) return blankDeal();
  const { id, created_at, updated_at, ...rest } = d;
  return rest;
}

export function DealForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: Deal;
  onSubmit: (values: NewDeal) => Promise<void> | void;
  onCancel: () => void;
}) {
  const { contacts } = useData();
  const [v, setV] = useState<NewDeal>(toForm(initial));
  const [saving, setSaving] = useState(false);

  function set<K extends keyof NewDeal>(key: K, value: NewDeal[K]) {
    setV((prev) => ({ ...prev, [key]: value }));
  }
  function numOrNull(s: string): number | null {
    if (s.trim() === "") return null;
    const n = Number(s.replace(/[^0-9.\-]/g, ""));
    return Number.isFinite(n) ? n : null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!v.title.trim() && !v.company.trim()) return;
    setSaving(true);
    try {
      await onSubmit({ ...v, title: v.title.trim() || v.company.trim() });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Deal title *" className="sm:col-span-2">
          <input
            className="input"
            value={v.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="e.g. Coastal Health Market — wholesale"
            autoFocus
          />
        </Field>
        <Field label="Company">
          <input
            className="input"
            value={v.company}
            onChange={(e) => set("company", e.target.value)}
            placeholder="Company name"
          />
        </Field>
        <Field label="Linked contact">
          <select
            className="input"
            value={v.contact_id ?? ""}
            onChange={(e) => set("contact_id", e.target.value || null)}
          >
            <option value="">— none —</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Deal type">
          <Select value={v.deal_type} onChange={(x) => set("deal_type", x as any)} options={DEAL_TYPES} />
        </Field>
        <Field label="Stage">
          <Select value={v.stage} onChange={(x) => set("stage", x as any)} options={DEAL_STAGES} />
        </Field>
        <Field label="Value ($)">
          <input className="input" inputMode="numeric" value={v.value ?? ""} onChange={(e) => set("value", numOrNull(e.target.value))} placeholder="5000" />
        </Field>
        <Field label="Probability (%)">
          <input className="input" inputMode="numeric" value={v.probability ?? ""} onChange={(e) => set("probability", numOrNull(e.target.value))} placeholder="blank = auto by stage" />
        </Field>
        <Field label="Expected close">
          <input className="input" type="date" value={v.expected_close_date ?? ""} onChange={(e) => set("expected_close_date", e.target.value || null)} />
        </Field>
        <Field label="Owner">
          <input className="input" value={v.owner} onChange={(e) => set("owner", e.target.value)} />
        </Field>
        <Field label="Source">
          <input className="input" value={v.source} onChange={(e) => set("source", e.target.value)} placeholder="Cold outreach, referral, event…" />
        </Field>
        <Field label="Next step">
          <input className="input" value={v.next_step} onChange={(e) => set("next_step", e.target.value)} placeholder="e.g. Send pricing" />
        </Field>
        <Field label="Next step date">
          <input className="input" type="date" value={v.next_step_date ?? ""} onChange={(e) => set("next_step_date", e.target.value || null)} />
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <textarea className="input min-h-[70px]" value={v.notes} onChange={(e) => set("notes", e.target.value)} />
        </Field>
      </div>

      <div className="sticky bottom-0 -mx-5 flex justify-end gap-2 border-t border-white/5 bg-ink-850/95 px-5 py-3 backdrop-blur">
        <button type="button" onClick={onCancel} className="btn-ghost">
          Cancel
        </button>
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? "Saving…" : initial ? "Save changes" : "Add deal"}
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
