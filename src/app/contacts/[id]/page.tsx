"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useData } from "@/components/DataProvider";
import { ContactForm } from "@/components/ContactForm";
import { Modal } from "@/components/Modal";
import { QuickActions } from "@/components/QuickActions";
import { Select } from "@/components/ContactForm";
import {
  BottleStatusBadge,
  PriorityBadge,
  RelationshipBadge,
  StatusBadge,
} from "@/components/Badge";
import { INTERACTION_TYPES } from "@/lib/constants";
import {
  createInteraction,
  deleteInteraction,
  getContact,
  listInteractions,
} from "@/lib/data";
import {
  formatDate,
  initials,
  instagramUrl,
  isOverdue,
  tiktokUrl,
  todayISO,
} from "@/lib/helpers";
import type { Contact, Interaction, InteractionType, NewContact } from "@/lib/types";

export default function ContactDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { update, remove } = useData();
  const [contact, setContact] = useState<Contact | null>(null);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  async function load() {
    setLoading(true);
    const [c, ix] = await Promise.all([getContact(id), listInteractions(id)]);
    setContact(c);
    setInteractions(ix);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleSave(values: NewContact) {
    const updated = await update(id, values);
    setContact(updated);
    setEditing(false);
  }

  async function handleDelete() {
    if (!confirm("Delete this contact and all its interactions?")) return;
    await remove(id);
    router.push("/contacts");
  }

  if (loading) return <div className="p-10 text-center text-slate-500">Loading…</div>;
  if (!contact)
    return (
      <div className="p-10 text-center text-slate-500">
        Contact not found.{" "}
        <Link href="/contacts" className="text-kava-300">
          Back to contacts
        </Link>
      </div>
    );

  const c = contact;

  return (
    <div className="px-4 py-5 sm:px-6">
      <div className="mb-4 flex items-center justify-between">
        <Link href="/contacts" className="btn-subtle text-sm">
          ← Contacts
        </Link>
        <div className="flex gap-2">
          <button onClick={() => setEditing(true)} className="btn-ghost text-sm">
            Edit
          </button>
          <button onClick={handleDelete} className="btn-subtle text-sm text-rose-300">
            Delete
          </button>
        </div>
      </div>

      {/* Header */}
      <div className="card mb-4 p-5">
        <div className="flex flex-wrap items-start gap-4">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-kava-400 to-kava-700 text-xl font-bold text-ink-950">
            {initials(c.name)}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold tracking-tight">{c.name}</h1>
            <p className="text-sm text-slate-400">
              {c.contact_type}
              {c.city ? ` · ${c.city}${c.state ? ", " + c.state : ""}` : ""}
              {c.follower_count ? ` · ${c.follower_count.toLocaleString()} followers` : ""}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <StatusBadge status={c.status} />
              <RelationshipBadge value={c.relationship_strength} />
              {c.bottle_recipient && <PriorityBadge priority={c.bottle_priority} />}
              {c.bottle_recipient && <BottleStatusBadge status={c.bottle_status} />}
            </div>
          </div>
        </div>
        <div className="mt-4 border-t border-white/5 pt-4">
          <QuickActions contact={c} onChange={load} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Left: info */}
        <div className="space-y-4 lg:col-span-1">
          <InfoCard title="Contact info">
            <Info label="Phone" value={c.phone} />
            <Info label="Email" value={c.email} />
            <Info
              label="Instagram"
              value={c.instagram}
              href={instagramUrl(c.instagram)}
            />
            <Info label="TikTok" value={c.tiktok} href={tiktokUrl(c.tiktok)} />
            <Info label="Source" value={c.source} />
            <Info label="Audience" value={c.audience_type} />
            <Info label="Owner" value={c.owner} />
          </InfoCard>

          <InfoCard title="Follow-up">
            <Info label="Last contacted" value={formatDate(c.last_contacted_date)} />
            <div>
              <div className="label">Next follow-up</div>
              <div
                className={`text-sm ${
                  isOverdue(c.next_follow_up_date) ? "text-rose-300" : "text-slate-200"
                }`}
              >
                {formatDate(c.next_follow_up_date)}
                {isOverdue(c.next_follow_up_date) ? " (overdue)" : ""}
              </div>
            </div>
          </InfoCard>

          <InfoCard title="Bottle & shipping">
            <Info label="Recipient?" value={c.bottle_recipient ? "Yes" : "No"} />
            <Info label="Quantity" value={c.bottle_quantity?.toString() ?? ""} />
            <Info label="Shipping name" value={c.shipping_name} />
            <Info label="Address" value={c.shipping_address} />
            <Info label="Tracking #" value={c.tracking_number} />
            <Info label="Date sent" value={formatDate(c.date_sent)} />
            <Info label="Date delivered" value={formatDate(c.date_delivered)} />
          </InfoCard>

          <InfoCard title="Outcomes">
            <Info label="Posted content" value={c.posted_content ? "Yes" : "No"} />
            <Info label="Ambassador" value={c.ambassador_signup ? "Yes" : "No"} />
            <Info label="Discount code" value={c.discount_code} />
            <Info
              label="Sales generated"
              value={c.sales_generated ? `$${c.sales_generated.toLocaleString()}` : ""}
            />
          </InfoCard>
        </div>

        {/* Right: notes + timeline */}
        <div className="space-y-4 lg:col-span-2">
          {c.notes && (
            <InfoCard title="Notes">
              <p className="whitespace-pre-wrap text-sm text-slate-300">{c.notes}</p>
            </InfoCard>
          )}

          <InteractionLog
            contactId={c.id}
            interactions={interactions}
            onChange={load}
          />
        </div>
      </div>

      <Modal open={editing} onClose={() => setEditing(false)} title="Edit contact" wide>
        <ContactForm
          initial={c}
          onSubmit={handleSave}
          onCancel={() => setEditing(false)}
        />
      </Modal>
    </div>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-kava-300/80">
        {title}
      </h3>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

function Info({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href?: string | null;
}) {
  if (!value) return null;
  return (
    <div>
      <div className="label">{label}</div>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-kava-300 hover:underline"
        >
          {value}
        </a>
      ) : (
        <div className="whitespace-pre-wrap text-sm text-slate-200">{value}</div>
      )}
    </div>
  );
}

function InteractionLog({
  contactId,
  interactions,
  onChange,
}: {
  contactId: string;
  interactions: Interaction[];
  onChange: () => void;
}) {
  const { update } = useData();
  const [type, setType] = useState<InteractionType>("Texted");
  const [date, setDate] = useState(todayISO());
  const [notes, setNotes] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [saving, setSaving] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!notes.trim() && !nextAction.trim()) return;
    setSaving(true);
    try {
      await createInteraction({
        contact_id: contactId,
        date,
        type,
        notes,
        next_action: nextAction,
      });
      await update(contactId, { last_contacted_date: date });
      setNotes("");
      setNextAction("");
      onChange();
    } finally {
      setSaving(false);
    }
  }

  async function removeIx(id: string) {
    await deleteInteraction(id);
    onChange();
  }

  return (
    <div className="card p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-kava-300/80">
        Interaction history
      </h3>

      <form onSubmit={add} className="mb-4 space-y-2 rounded-xl bg-ink-900/60 p-3">
        <div className="grid grid-cols-2 gap-2">
          <Select value={type} onChange={(v) => setType(v as InteractionType)} options={INTERACTION_TYPES} />
          <input
            type="date"
            className="input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <textarea
          className="input min-h-[60px]"
          placeholder="What happened?"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <input
          className="input"
          placeholder="Next action (optional)"
          value={nextAction}
          onChange={(e) => setNextAction(e.target.value)}
        />
        <div className="flex justify-end">
          <button disabled={saving} className="btn-primary text-sm">
            {saving ? "Logging…" : "Log interaction"}
          </button>
        </div>
      </form>

      {interactions.length === 0 ? (
        <p className="text-sm text-slate-500">No interactions logged yet.</p>
      ) : (
        <ol className="relative space-y-4 border-l border-white/10 pl-5">
          {interactions.map((ix) => (
            <li key={ix.id} className="relative">
              <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full bg-kava-500 ring-4 ring-ink-850" />
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-100">{ix.type}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">{formatDate(ix.date)}</span>
                  <button
                    onClick={() => removeIx(ix.id)}
                    className="text-xs text-slate-500 hover:text-rose-300"
                  >
                    ✕
                  </button>
                </div>
              </div>
              {ix.notes && <p className="text-sm text-slate-300">{ix.notes}</p>}
              {ix.next_action && (
                <p className="mt-0.5 text-xs text-kava-300">→ {ix.next_action}</p>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
