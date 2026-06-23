"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useData } from "@/components/DataProvider";
import { PageHeader } from "@/components/PageHeader";
import { QuickActions } from "@/components/QuickActions";
import { BottleStatusBadge, PriorityBadge } from "@/components/Badge";
import { formatDate, initials } from "@/lib/helpers";
import type { Contact } from "@/lib/types";

const PRIORITY_ORDER: Record<string, number> = { VIP: 0, High: 1, Medium: 2, Low: 3 };

export default function BottlesPage() {
  const { contacts, loading } = useData();

  const data = useMemo(() => {
    const recipients = contacts.filter((c) => c.bottle_recipient);
    const approved = recipients.filter((c) =>
      ["Want to send", "Need address", "Ready to send"].includes(c.bottle_status)
    );
    const ready = recipients.filter((c) => c.bottle_status === "Ready to send");
    const needAddress = recipients.filter(
      (c) =>
        c.shipping_address.trim() === "" &&
        !["Sent", "Delivered", "Followed up"].includes(c.bottle_status)
    );
    const sent = recipients.filter((c) =>
      ["Sent", "Delivered", "Followed up"].includes(c.bottle_status)
    );

    const byPriority = (a: Contact, b: Contact) =>
      (PRIORITY_ORDER[a.bottle_priority] ?? 9) - (PRIORITY_ORDER[b.bottle_priority] ?? 9);

    const toShip = approved.reduce((s, c) => s + (c.bottle_quantity ?? 1), 0);
    const shipped = sent.reduce((s, c) => s + (c.bottle_quantity ?? 1), 0);

    return {
      approvedCount: approved.length,
      toShip,
      shipped,
      ready: [...ready].sort(byPriority),
      needAddress: [...needAddress].sort(byPriority),
      queue: [...approved].sort(byPriority),
      sent: [...sent].sort((a, b) =>
        (b.date_sent ?? "").localeCompare(a.date_sent ?? "")
      ),
    };
  }, [contacts]);

  return (
    <div>
      <PageHeader title="Bottle Sending" subtitle="Gifting pipeline at a glance" />

      <div className="space-y-6 px-4 py-5 sm:px-6">
        {loading ? (
          <div className="py-20 text-center text-taupe-400">Loading…</div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="Approved for bottles" value={data.approvedCount} accent />
              <Stat label="Bottles to ship" value={data.toShip} accent />
              <Stat label="Bottles sent" value={data.shipped} />
              <Stat label="Missing address" value={data.needAddress.length} warn={data.needAddress.length > 0} />
            </div>

            <Section title="🚀 Ready to ship" subtitle="High priority first" list={data.ready} empty="Nothing ready to ship." />
            <Section title="📍 Missing address" subtitle="Collect these before shipping" list={data.needAddress} empty="All recipients have an address." />
            <Section title="🍶 Full giveaway queue" subtitle="Everyone in the pipeline" list={data.queue} empty="No one is in the bottle pipeline yet." />
            <Section title="✅ Already sent" subtitle="Most recent first" list={data.sent} empty="No bottles sent yet." showSent />
          </>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
  warn,
}: {
  label: string;
  value: number;
  accent?: boolean;
  warn?: boolean;
}) {
  return (
    <div className="card p-4">
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
}

function Section({
  title,
  subtitle,
  list,
  empty,
  showSent,
}: {
  title: string;
  subtitle: string;
  list: Contact[];
  empty: string;
  showSent?: boolean;
}) {
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-base font-semibold">{title}</h2>
        <span className="text-xs text-taupe-400">{subtitle}</span>
      </div>
      <div className="card divide-y divide-night-900/10">
        {list.length === 0 ? (
          <div className="p-5 text-sm text-taupe-400">{empty}</div>
        ) : (
          list.map((c) => (
            <div key={c.id} className="p-3">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-gold-300/80 to-gold-600 text-xs font-bold text-night-900">
                  {initials(c.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/contacts/${c.id}`}
                    className="block truncate font-semibold hover:text-gold-600"
                  >
                    {c.name}
                  </Link>
                  <div className="truncate text-xs text-taupe-400">
                    {c.bottle_quantity ?? 1} bottle(s)
                    {showSent && c.date_sent ? ` · sent ${formatDate(c.date_sent)}` : ""}
                    {showSent && c.tracking_number ? ` · ${c.tracking_number}` : ""}
                    {!showSent && c.shipping_address
                      ? ` · ${c.shipping_address}`
                      : !showSent
                      ? " · no address"
                      : ""}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <PriorityBadge priority={c.bottle_priority} />
                  <BottleStatusBadge status={c.bottle_status} />
                </div>
              </div>
              <div className="mt-2 pl-12">
                <QuickActions contact={c} compact />
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
