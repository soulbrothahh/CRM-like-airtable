"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useEvents } from "@/components/EventsProvider";
import { useData } from "@/components/DataProvider";
import { PageHeader } from "@/components/PageHeader";
import { EventForm } from "@/components/EventForm";
import { Modal } from "@/components/Modal";
import { EventStatusBadge, EventTypeBadge } from "@/components/Badge";
import { formatDate, todayISO } from "@/lib/helpers";
import type { CrmEvent, NewEvent } from "@/lib/types";

export default function EventsPage() {
  const { events, loading, create } = useEvents();
  const { contacts } = useData();
  const [adding, setAdding] = useState(false);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    contacts.forEach((c) => {
      if (c.event_id) m.set(c.event_id, (m.get(c.event_id) ?? 0) + 1);
    });
    return m;
  }, [contacts]);

  const { upcoming, past } = useMemo(() => {
    const today = todayISO();
    const up: CrmEvent[] = [];
    const pa: CrmEvent[] = [];
    for (const e of events) {
      const isPast =
        e.status === "Attended" ||
        e.status === "Passed" ||
        (e.date !== null && e.date < today);
      (isPast ? pa : up).push(e);
    }
    up.sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999"));
    pa.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
    return { upcoming: up, past: pa };
  }, [events]);

  async function handleCreate(values: NewEvent) {
    await create(values);
    setAdding(false);
  }

  return (
    <div>
      <PageHeader
        title="Events"
        subtitle="Kalapus, circles & mixers to show up to"
        action={
          <button onClick={() => setAdding(true)} className="btn-primary">
            + Add event
          </button>
        }
      />

      <div className="space-y-6 px-4 py-5 sm:px-6">
        {loading ? (
          <div className="py-20 text-center text-taupe-400">Loading…</div>
        ) : events.length === 0 ? (
          <div className="card p-10 text-center">
            <p className="text-sm text-taupe-500">
              No events yet. Add a kalapu, circle, mixer, or pop-up you want to be at.
            </p>
            <button onClick={() => setAdding(true)} className="btn-primary mt-4">
              + Add your first event
            </button>
          </div>
        ) : (
          <>
            <Section title="Upcoming" hint="Where to show up next" list={upcoming} counts={counts} emptyText="Nothing upcoming — add an event." />
            {past.length > 0 && (
              <Section title="Past & attended" hint="Recently happened" list={past} counts={counts} emptyText="" />
            )}
          </>
        )}
      </div>

      <Modal open={adding} onClose={() => setAdding(false)} title="Add event" wide>
        <EventForm onSubmit={handleCreate} onCancel={() => setAdding(false)} />
      </Modal>
    </div>
  );
}

function Section({
  title,
  hint,
  list,
  counts,
  emptyText,
}: {
  title: string;
  hint: string;
  list: CrmEvent[];
  counts: Map<string, number>;
  emptyText: string;
}) {
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-base font-semibold">{title}</h2>
        <span className="text-xs text-taupe-400">{hint}</span>
      </div>
      {list.length === 0 ? (
        emptyText ? <div className="card p-5 text-sm text-taupe-400">{emptyText}</div> : null
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((e) => (
            <EventCard key={e.id} event={e} metCount={counts.get(e.id) ?? 0} />
          ))}
        </div>
      )}
    </section>
  );
}

function EventCard({ event: e, metCount }: { event: CrmEvent; metCount: number }) {
  return (
    <Link href={`/events/${e.id}`} className="card card-hover flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 flex-1 font-semibold leading-snug">{e.name}</h3>
        <EventStatusBadge status={e.status} />
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <EventTypeBadge type={e.type} />
        {e.date && <span className="text-xs text-taupe-500">📅 {formatDate(e.date)}</span>}
      </div>
      {(e.city || e.venue) && (
        <div className="truncate text-xs text-taupe-500">
          📍 {[e.venue, [e.city, e.state].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}
        </div>
      )}
      {e.goal && <p className="line-clamp-2 text-xs text-taupe-600">🎯 {e.goal}</p>}
      {metCount > 0 && (
        <div className="mt-auto border-t border-night-900/5 pt-2 text-xs font-medium text-sage-600">
          👋 {metCount} {metCount === 1 ? "person" : "people"} met here
        </div>
      )}
    </Link>
  );
}
