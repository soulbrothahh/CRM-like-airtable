"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useEvents } from "@/components/EventsProvider";
import { useData } from "@/components/DataProvider";
import { EventForm } from "@/components/EventForm";
import { Modal } from "@/components/Modal";
import {
  BottleStatusBadge,
  EventStatusBadge,
  EventTypeBadge,
  StatusBadge,
} from "@/components/Badge";
import { EVENT_STATUSES } from "@/lib/constants";
import { getEvent } from "@/lib/events";
import { formatDate, formatMoney, initials } from "@/lib/helpers";
import type { CrmEvent, EventStatus, NewEvent } from "@/lib/types";

export default function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { update, remove } = useEvents();
  const { contacts } = useData();
  const [event, setEvent] = useState<CrmEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  async function load() {
    setLoading(true);
    setEvent(await getEvent(id));
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleSave(values: NewEvent) {
    setEvent(await update(id, values));
    setEditing(false);
  }
  async function setStatus(status: EventStatus) {
    setEvent(await update(id, { status }));
  }
  async function handleDelete() {
    if (!confirm("Delete this event? (People you met there stay in your contacts.)")) return;
    await remove(id);
    router.push("/events");
  }

  if (loading) return <div className="p-10 text-center text-taupe-400">Loading…</div>;
  if (!event)
    return (
      <div className="p-10 text-center text-taupe-400">
        Event not found.{" "}
        <Link href="/events" className="text-gold-600">
          Back to events
        </Link>
      </div>
    );

  const e = event;
  const people = contacts.filter((c) => c.event_id === e.id);
  const gifted = people.filter((c) =>
    ["Sent", "Delivered", "Followed up"].includes(c.bottle_status)
  ).length;
  const ambassadors = people.filter(
    (c) => c.ambassador_signup || c.contact_type === "Ambassador"
  ).length;

  return (
    <div className="px-4 py-5 sm:px-6">
      <div className="mb-4 flex items-center justify-between">
        <Link href="/events" className="btn-subtle text-sm">
          ← Events
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

      <div className="card mb-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight">{e.name}</h1>
            <div className="mt-1 text-sm text-taupe-500">
              {e.date ? `📅 ${formatDate(e.date)}` : "No date yet"}
              {e.venue || e.city
                ? ` · 📍 ${[e.venue, [e.city, e.state].filter(Boolean).join(", ")]
                    .filter(Boolean)
                    .join(" · ")}`
                : ""}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <EventTypeBadge type={e.type} />
              <EventStatusBadge status={e.status} />
              {e.cost ? (
                <span className="text-xs text-taupe-500">{formatMoney(e.cost)}</span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-4 border-t border-night-900/5 pt-4">
          <label className="label">Status</label>
          <div className="flex flex-wrap gap-1.5">
            {EVENT_STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={
                  s === e.status
                    ? "chip-on"
                    : "chip-off"
                }
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Outcome summary */}
      <div className="mb-4 grid grid-cols-3 gap-3">
        <Stat label="People met" value={people.length} />
        <Stat label="Bottles gifted" value={gifted} />
        <Stat label="Ambassadors" value={ambassadors} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-1">
          {e.goal && (
            <InfoCard title="Goal">
              <p className="text-sm text-night-800">{e.goal}</p>
            </InfoCard>
          )}
          <InfoCard title="Details">
            <Info label="Host / organizer" value={e.host} />
            {e.url ? (
              <div>
                <div className="label">Link</div>
                <a href={e.url} target="_blank" rel="noreferrer" className="text-sm text-gold-600 hover:underline">
                  {e.url}
                </a>
              </div>
            ) : null}
          </InfoCard>
          {e.notes && (
            <InfoCard title="Notes">
              <p className="whitespace-pre-wrap text-sm text-taupe-600">{e.notes}</p>
            </InfoCard>
          )}
        </div>

        <div className="lg:col-span-2">
          <div className="card p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-gold-600/80">
              People you met here
            </h3>
            {people.length === 0 ? (
              <p className="text-sm text-taupe-500">
                Nobody linked yet. Add a contact and set their “Met at” to this event —
                or use the quick-add ＋ while you’re here.
              </p>
            ) : (
              <div className="divide-y divide-night-900/10">
                {people.map((c) => (
                  <div key={c.id} className="flex flex-wrap items-center gap-3 py-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-gold-300/80 to-gold-600 text-[11px] font-bold text-night-900">
                      {initials(c.name)}
                    </span>
                    <Link
                      href={`/contacts/${c.id}`}
                      className="min-w-0 flex-1 truncate text-sm font-medium hover:text-gold-600"
                    >
                      {c.name}
                    </Link>
                    <StatusBadge status={c.status} />
                    {c.bottle_recipient && <BottleStatusBadge status={c.bottle_status} />}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal open={editing} onClose={() => setEditing(false)} title="Edit event" wide>
        <EventForm initial={e} onSubmit={handleSave} onCancel={() => setEditing(false)} />
      </Modal>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-4 text-center">
      <div className="text-2xl font-bold text-night-900">{value}</div>
      <div className="mt-1 text-xs text-taupe-500">{label}</div>
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

function Info({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <div className="label">{label}</div>
      <div className="text-sm text-night-800">{value}</div>
    </div>
  );
}
