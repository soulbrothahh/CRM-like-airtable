"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useData } from "@/components/DataProvider";
import { useEvents } from "@/components/EventsProvider";
import { ContactForm } from "@/components/ContactForm";
import { Modal } from "@/components/Modal";
import { QuickActions } from "@/components/QuickActions";
import { Select } from "@/components/ContactForm";
import { SequenceCard } from "@/components/SequenceCard";
import {
  BottleStatusBadge,
  OutreachStatusBadge,
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
  const { events } = useEvents();
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

  if (loading) return <div className="p-10 text-center text-taupe-400">Loading…</div>;
  if (!contact)
    return (
      <div className="p-10 text-center text-taupe-400">
        Contact not found.{" "}
        <Link href="/contacts" className="text-gold-600">
          Back to contacts
        </Link>
      </div>
    );

  const c = contact;
  const metAtEvent = c.event_id ? events.find((e) => e.id === c.event_id) : null;

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
          <button onClick={handleDelete} className="btn-subtle text-sm text-rose-600">
            Delete
          </button>
        </div>
      </div>

      {/* Header */}
      <div className="card mb-4 p-5">
        <div className="flex flex-wrap items-start gap-4">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-gold-300 to-gold-600 text-xl font-bold text-night-900">
            {initials(c.name)}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold tracking-tight">{c.name}</h1>
            <p className="text-sm text-taupe-500">
              {c.contact_type}
              {c.city ? ` · ${c.city}${c.state ? ", " + c.state : ""}` : ""}
              {c.follower_count ? ` · ${c.follower_count.toLocaleString()} followers` : ""}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <StatusBadge status={c.status} />
              <OutreachStatusBadge status={c.outreach_status} />
              <RelationshipBadge value={c.relationship_strength} />
              {c.bottle_recipient && <PriorityBadge priority={c.bottle_priority} />}
              {c.bottle_recipient && <BottleStatusBadge status={c.bottle_status} />}
            </div>
            {c.tags && c.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {c.tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-full bg-clay-500/10 px-2.5 py-0.5 text-xs font-medium text-clay-600"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="mt-4 border-t border-night-900/5 pt-4">
          <QuickActions contact={c} onChange={load} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Left: info */}
        <div className="space-y-4 lg:col-span-1">
          <SequenceCard contact={c} onChange={load} />
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
            {metAtEvent && (
              <div>
                <div className="label">Met at</div>
                <Link
                  href={`/events/${metAtEvent.id}`}
                  className="text-sm text-gold-600 hover:underline"
                >
                  🌺 {metAtEvent.name}
                </Link>
              </div>
            )}
            <Info label="Audience" value={c.audience_type} />
            <Info label="Owner" value={c.owner} />
          </InfoCard>

          <InfoCard title="Follow-up">
            <Info label="Last contacted" value={formatDate(c.last_contacted_date)} />
            <div>
              <div className="label">Next follow-up</div>
              <div
                className={`text-sm ${
                  isOverdue(c.next_follow_up_date) ? "text-rose-600" : "text-night-800"
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
              <p className="whitespace-pre-wrap text-sm text-taupe-600">{c.notes}</p>
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
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-gold-600/80">
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
          className="text-sm text-gold-600 hover:underline"
        >
          {value}
        </a>
      ) : (
        <div className="whitespace-pre-wrap text-sm text-night-800">{value}</div>
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
  const [direction, setDirection] = useState<"outbound" | "inbound">("outbound");
  const [date, setDate] = useState(todayISO());
  const [notes, setNotes] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [saving, setSaving] = useState(false);

  function plusDays(n: number): string {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!notes.trim() && !nextAction.trim()) return;
    setSaving(true);
    try {
      await createInteraction({
        contact_id: contactId,
        date,
        type,
        direction,
        notes,
        next_action: nextAction,
      });
      // keep the outreach loop in sync: a sent message → awaiting reply +
      // 3-day nudge; a received message → they replied, your move.
      if (direction === "inbound") {
        await update(contactId, {
          outreach_status: "Replied",
          next_follow_up_date: null,
        });
      } else {
        await update(contactId, {
          last_contacted_date: date,
          outreach_status: "Awaiting reply",
          next_follow_up_date: plusDays(3),
        });
      }
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
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-gold-600/80">
        Interaction history
      </h3>

      <form onSubmit={add} className="mb-4 space-y-2 rounded-xl bg-cream-50/60 p-3">
        <div className="flex rounded-xl bg-night-900/[0.03] p-0.5 ring-1 ring-night-900/10">
          <button
            type="button"
            onClick={() => setDirection("outbound")}
            className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold ${
              direction === "outbound" ? "bg-night-900 text-cream-100" : "text-taupe-600"
            }`}
          >
            → Sent
          </button>
          <button
            type="button"
            onClick={() => setDirection("inbound")}
            className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold ${
              direction === "inbound" ? "bg-sage-500 text-cream-100" : "text-taupe-600"
            }`}
          >
            ← Received
          </button>
        </div>
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
        <p className="text-sm text-taupe-400">No interactions logged yet.</p>
      ) : (
        <ol className="relative space-y-4 border-l border-night-900/10 pl-5">
          {interactions.map((ix) => (
            <li key={ix.id} className="relative">
              <span
                className={`absolute -left-[27px] top-1 h-3 w-3 rounded-full ring-4 ring-cream-50 ${
                  ix.direction === "inbound" ? "bg-sage-500" : "bg-gold-400"
                }`}
              />
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-night-900">
                  {ix.direction === "inbound" ? "← " : "→ "}
                  {ix.type}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-taupe-400">{formatDate(ix.date)}</span>
                  <button
                    onClick={() => removeIx(ix.id)}
                    className="text-xs text-taupe-400 hover:text-rose-600"
                  >
                    ✕
                  </button>
                </div>
              </div>
              {ix.notes && <p className="text-sm text-taupe-600">{ix.notes}</p>}
              {ix.next_action && (
                <p className="mt-0.5 text-xs text-gold-600">→ {ix.next_action}</p>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
