"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useData } from "@/components/DataProvider";
import { useEvents } from "@/components/EventsProvider";
import { PageHeader } from "@/components/PageHeader";
import { ContactForm } from "@/components/ContactForm";
import { Modal } from "@/components/Modal";
import { QuickActions } from "@/components/QuickActions";
import { BottleStatusBadge, StatusBadge } from "@/components/Badge";
import { formatDate, isOverdue, isToday, initials, todayISO } from "@/lib/helpers";
import type { Contact, NewContact } from "@/lib/types";

export default function Dashboard() {
  const { contacts, loading, create } = useData();
  const [adding, setAdding] = useState(false);

  const stats = useMemo(() => {
    const recipients = contacts.filter((c) => c.bottle_recipient);
    const approved = contacts.filter(
      (c) => c.status === "Approved for Bottles" || c.bottle_status === "Ready to send"
    );
    const ready = contacts.filter((c) => c.bottle_status === "Ready to send");
    const sent = contacts.filter((c) =>
      ["Sent", "Delivered", "Followed up"].includes(c.bottle_status)
    );
    const missingAddress = recipients.filter(
      (c) =>
        c.shipping_address.trim() === "" &&
        !["Sent", "Delivered", "Followed up"].includes(c.bottle_status)
    );
    const hot = contacts.filter(
      (c) => c.lead_temperature === "Hot" || c.relationship_strength === "Hot"
    );
    const todayFollow = contacts.filter(
      (c) => isToday(c.next_follow_up_date) || isOverdue(c.next_follow_up_date)
    );
    const sales = contacts.reduce((s, c) => s + (c.sales_generated ?? 0), 0);
    const bottlesToShip = ready.reduce((s, c) => s + (c.bottle_quantity ?? 1), 0);
    return {
      total: contacts.length,
      approved: approved.length,
      ready,
      bottlesToShip,
      sent: sent.length,
      missingAddress,
      hot: hot.length,
      todayFollow: todayFollow.sort((a, b) =>
        (a.next_follow_up_date ?? "").localeCompare(b.next_follow_up_date ?? "")
      ),
      sales,
    };
  }, [contacts]);

  async function handleCreate(values: NewContact) {
    await create(values);
    setAdding(false);
  }

  return (
    <div>
      <PageHeader
        title="Better Moments"
        subtitle="Your connections, at a glance"
        action={
          <button onClick={() => setAdding(true)} className="btn-primary">
            + Add connection
          </button>
        }
      />

      <div className="space-y-6 px-4 py-5 sm:px-6">
        <Hero count={contacts.length} onAdd={() => setAdding(true)} />
        {loading ? (
          <div className="py-20 text-center text-taupe-400">Loading…</div>
        ) : (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="Connections" value={stats.total} href="/contacts" />
              <Stat
                label="Approved to gift"
                value={stats.approved}
                href="/bottles"
                accent
              />
              <Stat label="Bottles to send" value={stats.bottlesToShip} href="/bottles" accent />
              <Stat label="Bottles gifted" value={stats.sent} href="/bottles" />
              <Stat label="Warm & hot" value={stats.hot} href="/contacts" />
              <Stat label="Missing address" value={stats.missingAddress.length} href="/bottles" warn={stats.missingAddress.length > 0} />
              <Stat label="Follow-ups due" value={stats.todayFollow.length} warn={stats.todayFollow.length > 0} />
              <Stat label="Sales generated" value={`$${stats.sales.toLocaleString()}`} />
            </div>

            <UpcomingEvents />

            {/* Today's follow-ups */}
            <Panel
              title="People to Follow Up With"
              hint="Overdue and due today"
              empty="🎉 No follow-ups due. You’re all caught up."
              items={stats.todayFollow}
              render={(c) => (
                <Row key={c.id} contact={c}>
                  <span
                    className={`text-xs ${
                      isOverdue(c.next_follow_up_date) ? "text-rose-600" : "text-taupe-500"
                    }`}
                  >
                    {formatDate(c.next_follow_up_date)}
                    {isOverdue(c.next_follow_up_date) ? " · overdue" : " · today"}
                  </span>
                </Row>
              )}
            />

            {/* Ready to ship */}
            <Panel
              title="Ready to Gift"
              hint="Approved with an address"
              empty="Nothing ready to ship right now."
              items={stats.ready}
              render={(c) => (
                <Row key={c.id} contact={c}>
                  <span className="text-xs text-taupe-500">
                    {c.bottle_quantity ?? 1} bottle(s)
                  </span>
                </Row>
              )}
            />

            {/* Missing address */}
            <Panel
              title="Missing Address"
              hint="Recipients with no shipping address"
              empty="Every recipient has an address. Nice."
              items={stats.missingAddress}
              render={(c) => (
                <Row key={c.id} contact={c}>
                  <BottleStatusBadge status={c.bottle_status} />
                </Row>
              )}
            />
          </>
        )}
      </div>

      <Modal open={adding} onClose={() => setAdding(false)} title="Add contact" wide>
        <ContactForm onSubmit={handleCreate} onCancel={() => setAdding(false)} />
      </Modal>
    </div>
  );
}

function UpcomingEvents() {
  const { events } = useEvents();
  const today = todayISO();
  const upcoming = events
    .filter(
      (e) =>
        e.status !== "Passed" &&
        e.status !== "Attended" &&
        (e.date === null || e.date >= today)
    )
    .sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999"))
    .slice(0, 3);

  if (upcoming.length === 0) return null;

  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-base font-semibold">🌺 Upcoming Events</h2>
        <Link href="/events" className="text-xs font-medium text-gold-600 hover:underline">
          See all
        </Link>
      </div>
      <div className="card divide-y divide-night-900/10">
        {upcoming.map((e) => (
          <Link
            key={e.id}
            href={`/events/${e.id}`}
            className="flex items-center gap-3 p-3 hover:bg-night-900/[0.03]"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sage-500/15 text-base">
              🌺
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{e.name}</div>
              <div className="truncate text-xs text-taupe-400">
                {e.type}
                {e.city ? ` · ${e.city}` : ""}
              </div>
            </div>
            <span className="shrink-0 text-xs text-taupe-500">
              {e.date ? formatDate(e.date) : "TBD"}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function Hero({ count, onAdd }: { count: number; onAdd: () => void }) {
  return (
    <section className="relative overflow-hidden rounded-3xl bg-night-grad p-6 text-cream-100 shadow-lift sm:p-8">
      <div className="pointer-events-none absolute -right-10 -top-12 h-44 w-44 rounded-full bg-gold-400/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-14 -left-10 h-44 w-44 rounded-full bg-sage-500/20 blur-3xl" />
      <div className="relative">
        <span className="inline-flex items-center gap-2 rounded-full bg-cream-100/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-gold-300 ring-1 ring-cream-100/15">
          <span className="h-1.5 w-1.5 rounded-full bg-gold-400" /> Built for better moments
        </span>
        <h1 className="mt-4 max-w-xl text-2xl font-extrabold leading-tight sm:text-3xl">
          Warm connections, calm follow-ups, kava worth sharing.
        </h1>
        <p className="mt-2 max-w-md text-sm text-cream-200/80">
          {count} {count === 1 ? "person" : "people"} in your circle. Add someone new, or
          see who to reach out to today.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <button onClick={onAdd} className="btn-gold">
            + Add a connection
          </button>
          <Link
            href="/bottles"
            className="inline-flex items-center gap-2 rounded-full bg-cream-100/10 px-4 py-2.5 text-sm font-semibold text-cream-100 ring-1 ring-cream-100/20 transition hover:bg-cream-100/20"
          >
            🌿 Kava Giveaway List
          </Link>
        </div>
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  href,
  accent,
  warn,
}: {
  label: string;
  value: number | string;
  href?: string;
  accent?: boolean;
  warn?: boolean;
}) {
  const body = (
    <div
      className={`card p-4 transition hover:ring-night-900/10 ${
        accent ? "ring-gold-400/20" : ""
      }`}
    >
      <div
        className={`text-2xl font-bold ${
          warn ? "text-rose-600" : accent ? "text-gold-600" : "text-night-900"
        }`}
      >
        {value}
      </div>
      <div className="mt-1 text-xs text-taupe-500">{label}</div>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

function Panel({
  title,
  hint,
  items,
  render,
  empty,
}: {
  title: string;
  hint: string;
  items: Contact[];
  render: (c: Contact) => React.ReactNode;
  empty: string;
}) {
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-base font-semibold">{title}</h2>
        <span className="text-xs text-taupe-400">{hint}</span>
      </div>
      <div className="card divide-y divide-night-900/10">
        {items.length === 0 ? (
          <div className="p-5 text-sm text-taupe-400">{empty}</div>
        ) : (
          items.map((c) => render(c))
        )}
      </div>
    </section>
  );
}

function Row({ contact, children }: { contact: Contact; children?: React.ReactNode }) {
  return (
    <div className="p-3">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-gold-300/80 to-gold-600 text-xs font-bold text-night-900">
          {initials(contact.name)}
        </span>
        <div className="min-w-0 flex-1">
          <Link
            href={`/contacts/${contact.id}`}
            className="block truncate font-semibold hover:text-gold-600"
          >
            {contact.name}
          </Link>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-taupe-400">
            {contact.contact_type}
            {children}
          </div>
        </div>
        <div className="shrink-0">
          <StatusBadge status={contact.status} />
        </div>
      </div>
      <div className="mt-2 pl-12">
        <QuickActions contact={contact} compact />
      </div>
    </div>
  );
}
