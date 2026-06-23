"use client";

import { useState } from "react";
import { useEvents } from "./EventsProvider";
import {
  BOTTLE_PRIORITIES,
  BOTTLE_STATUSES,
  CONTACT_TYPES,
  LEAD_TEMPERATURES,
  RELATIONSHIP_STRENGTHS,
  STATUSES,
} from "@/lib/constants";
import { blankContact } from "@/lib/helpers";
import type { Contact, NewContact } from "@/lib/types";

type FormValues = NewContact;

function toForm(c?: Contact): FormValues {
  if (!c) return blankContact();
  const { id, created_at, updated_at, ...rest } = c;
  return rest as FormValues;
}

export function ContactForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: Contact;
  onSubmit: (values: FormValues) => Promise<void> | void;
  onCancel: () => void;
}) {
  const { events } = useEvents();
  const [v, setV] = useState<FormValues>(toForm(initial));
  const [saving, setSaving] = useState(false);

  function set<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setV((prev) => ({ ...prev, [key]: value }));
  }

  function numberOrNull(s: string): number | null {
    if (s.trim() === "") return null;
    const n = Number(s);
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
    <form onSubmit={handleSubmit} className="space-y-5">
      <Section title="Who">
        <Field label="Name *" className="sm:col-span-2">
          <input
            className="input"
            value={v.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Maya Reyes"
            required
            autoFocus
          />
        </Field>
        <Field label="Instagram">
          <input
            className="input"
            value={v.instagram}
            onChange={(e) => set("instagram", e.target.value)}
            placeholder="@handle"
          />
        </Field>
        <Field label="TikTok">
          <input
            className="input"
            value={v.tiktok}
            onChange={(e) => set("tiktok", e.target.value)}
            placeholder="@handle"
          />
        </Field>
        <Field label="Phone">
          <input
            className="input"
            value={v.phone}
            onChange={(e) => set("phone", e.target.value)}
          />
        </Field>
        <Field label="Email">
          <input
            className="input"
            type="email"
            value={v.email}
            onChange={(e) => set("email", e.target.value)}
          />
        </Field>
        <Field label="City">
          <input
            className="input"
            value={v.city}
            onChange={(e) => set("city", e.target.value)}
          />
        </Field>
        <Field label="State">
          <input
            className="input"
            value={v.state}
            onChange={(e) => set("state", e.target.value)}
          />
        </Field>
      </Section>

      <Section title="Relationship">
        <Field label="Contact type">
          <Select value={v.contact_type} onChange={(x) => set("contact_type", x as any)} options={CONTACT_TYPES} />
        </Field>
        <Field label="Status">
          <Select value={v.status} onChange={(x) => set("status", x as any)} options={STATUSES} />
        </Field>
        <Field label="Relationship strength">
          <Select value={v.relationship_strength} onChange={(x) => set("relationship_strength", x as any)} options={RELATIONSHIP_STRENGTHS} />
        </Field>
        <Field label="Lead temperature">
          <Select value={v.lead_temperature} onChange={(x) => set("lead_temperature", x as any)} options={LEAD_TEMPERATURES} />
        </Field>
        <Field label="Source / where you met">
          <input className="input" value={v.source} onChange={(e) => set("source", e.target.value)} placeholder="DM, event, referral…" />
        </Field>
        <Field label="Met at (event)">
          <select
            className="input"
            value={v.event_id ?? ""}
            onChange={(e) => set("event_id", e.target.value || null)}
          >
            <option value="">— none —</option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Owner / assigned to">
          <input className="input" value={v.owner} onChange={(e) => set("owner", e.target.value)} />
        </Field>
        <Field label="Follower count">
          <input className="input" inputMode="numeric" value={v.follower_count ?? ""} onChange={(e) => set("follower_count", numberOrNull(e.target.value))} />
        </Field>
        <Field label="Audience type">
          <input className="input" value={v.audience_type} onChange={(e) => set("audience_type", e.target.value)} placeholder="Fitness, beauty…" />
        </Field>
        <Field label="Last contacted">
          <input className="input" type="date" value={v.last_contacted_date ?? ""} onChange={(e) => set("last_contacted_date", e.target.value || null)} />
        </Field>
        <Field label="Next follow-up">
          <input className="input" type="date" value={v.next_follow_up_date ?? ""} onChange={(e) => set("next_follow_up_date", e.target.value || null)} />
        </Field>
      </Section>

      <Section title="Bottle gifting">
        <Field label="Bottle recipient?">
          <Toggle value={v.bottle_recipient} onChange={(b) => set("bottle_recipient", b)} />
        </Field>
        <Field label="Bottle priority">
          <Select value={v.bottle_priority} onChange={(x) => set("bottle_priority", x as any)} options={BOTTLE_PRIORITIES} />
        </Field>
        <Field label="Bottle status">
          <Select value={v.bottle_status} onChange={(x) => set("bottle_status", x as any)} options={BOTTLE_STATUSES} />
        </Field>
        <Field label="Quantity">
          <input className="input" inputMode="numeric" value={v.bottle_quantity ?? ""} onChange={(e) => set("bottle_quantity", numberOrNull(e.target.value))} />
        </Field>
        <Field label="Shipping name">
          <input className="input" value={v.shipping_name} onChange={(e) => set("shipping_name", e.target.value)} />
        </Field>
        <Field label="Tracking number">
          <input className="input" value={v.tracking_number} onChange={(e) => set("tracking_number", e.target.value)} />
        </Field>
        <Field label="Shipping address" className="sm:col-span-2">
          <textarea className="input min-h-[64px]" value={v.shipping_address} onChange={(e) => set("shipping_address", e.target.value)} />
        </Field>
        <Field label="Date sent">
          <input className="input" type="date" value={v.date_sent ?? ""} onChange={(e) => set("date_sent", e.target.value || null)} />
        </Field>
        <Field label="Date delivered">
          <input className="input" type="date" value={v.date_delivered ?? ""} onChange={(e) => set("date_delivered", e.target.value || null)} />
        </Field>
      </Section>

      <Section title="Outcomes & notes">
        <Field label="Posted content?">
          <Toggle value={v.posted_content} onChange={(b) => set("posted_content", b)} />
        </Field>
        <Field label="Ambassador signup?">
          <Toggle value={v.ambassador_signup} onChange={(b) => set("ambassador_signup", b)} />
        </Field>
        <Field label="Discount code">
          <input className="input" value={v.discount_code} onChange={(e) => set("discount_code", e.target.value)} />
        </Field>
        <Field label="Sales generated ($)">
          <input className="input" inputMode="numeric" value={v.sales_generated ?? ""} onChange={(e) => set("sales_generated", numberOrNull(e.target.value))} />
        </Field>
        <Field label="Tags (comma separated)" className="sm:col-span-2">
          <input
            className="input"
            value={(v.tags ?? []).join(", ")}
            onChange={(e) =>
              set(
                "tags",
                e.target.value
                  .split(",")
                  .map((t) => t.trim())
                  .filter(Boolean)
              )
            }
            placeholder="e.g. Utah, gym owner, VIP"
          />
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <textarea className="input min-h-[80px]" value={v.notes} onChange={(e) => set("notes", e.target.value)} />
        </Field>
      </Section>

      <div className="sticky bottom-0 -mx-5 flex justify-end gap-2 border-t border-night-900/5 bg-cream-50/95 px-5 py-3 backdrop-blur">
        <button type="button" onClick={onCancel} className="btn-ghost">
          Cancel
        </button>
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? "Saving…" : initial ? "Save changes" : "Add contact"}
        </button>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-gold-600/80">
        {title}
      </h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
    </div>
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

export function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
}) {
  return (
    <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (b: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${
        value ? "bg-sage-500" : "bg-sand-300"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
          value ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}
