"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useData } from "@/components/DataProvider";
import { PageHeader } from "@/components/PageHeader";
import { ContactForm } from "@/components/ContactForm";
import { Modal } from "@/components/Modal";
import { QuickActions } from "@/components/QuickActions";
import { BottleStatusBadge, StatusBadge } from "@/components/Badge";
import { formatDate, isOverdue, isToday, initials } from "@/lib/helpers";
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
        title="Dashboard"
        subtitle="Who needs attention today"
        action={
          <button onClick={() => setAdding(true)} className="btn-primary">
            + Add contact
          </button>
        }
      />

      <div className="space-y-6 px-4 py-5 sm:px-6">
        {loading ? (
          <div className="py-20 text-center text-slate-500">Loading…</div>
        ) : (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="Total contacts" value={stats.total} href="/contacts" />
              <Stat
                label="Approved for bottles"
                value={stats.approved}
                href="/bottles"
                accent
              />
              <Stat label="Bottles to ship" value={stats.bottlesToShip} href="/bottles" accent />
              <Stat label="Bottles sent" value={stats.sent} href="/bottles" />
              <Stat label="Hot leads" value={stats.hot} href="/contacts" />
              <Stat label="Missing address" value={stats.missingAddress.length} href="/bottles" warn={stats.missingAddress.length > 0} />
              <Stat label="Follow-ups due" value={stats.todayFollow.length} warn={stats.todayFollow.length > 0} />
              <Stat label="Sales generated" value={`$${stats.sales.toLocaleString()}`} />
            </div>

            {/* Today's follow-ups */}
            <Panel
              title="Today’s Follow-Ups"
              hint="Overdue and due today"
              empty="🎉 No follow-ups due. You’re all caught up."
              items={stats.todayFollow}
              render={(c) => (
                <Row key={c.id} contact={c}>
                  <span
                    className={`text-xs ${
                      isOverdue(c.next_follow_up_date) ? "text-rose-300" : "text-slate-400"
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
              title="Ready to Ship"
              hint="Approved with an address"
              empty="Nothing ready to ship right now."
              items={stats.ready}
              render={(c) => (
                <Row key={c.id} contact={c}>
                  <span className="text-xs text-slate-400">
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
      className={`card p-4 transition hover:ring-white/10 ${
        accent ? "ring-kava-400/20" : ""
      }`}
    >
      <div
        className={`text-2xl font-bold ${
          warn ? "text-rose-300" : accent ? "text-kava-300" : "text-slate-100"
        }`}
      >
        {value}
      </div>
      <div className="mt-1 text-xs text-slate-400">{label}</div>
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
        <span className="text-xs text-slate-500">{hint}</span>
      </div>
      <div className="card divide-y divide-white/5">
        {items.length === 0 ? (
          <div className="p-5 text-sm text-slate-500">{empty}</div>
        ) : (
          items.map((c) => render(c))
        )}
      </div>
    </section>
  );
}

function Row({ contact, children }: { contact: Contact; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3 p-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-kava-400/80 to-kava-700 text-xs font-bold text-ink-950">
        {initials(contact.name)}
      </span>
      <div className="min-w-0 flex-1">
        <Link href={`/contacts/${contact.id}`} className="font-medium hover:text-kava-300">
          {contact.name}
        </Link>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          {contact.contact_type}
          {children}
        </div>
      </div>
      <div className="hidden sm:block">
        <StatusBadge status={contact.status} />
      </div>
      <QuickActions contact={contact} compact />
    </div>
  );
}
