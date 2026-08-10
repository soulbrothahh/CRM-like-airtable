"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useData } from "@/components/DataProvider";
import { PageHeader } from "@/components/PageHeader";
import { QuickActions } from "@/components/QuickActions";
import { PriorityBadge } from "@/components/Badge";
import { getSupabase } from "@/lib/supabase";
import { formatDate, initials } from "@/lib/helpers";
import type { Contact, SampleShipment } from "@/lib/types";

// Kava Giveaways — single source of truth: sample_shipments (the same table
// the Ambassadors hub uses), joined to contacts. The legacy contacts.bottle_*
// fields are deprecated: backfilled by 2026-08-04-bottle-single-source.sql
// and no longer written anywhere.

const PRIORITY_ORDER: Record<string, number> = { VIP: 0, High: 1, Medium: 2, Low: 3 };
const PRE_SHIP = ["Planned", "Ready"];
const SENT = ["Shipped", "Delivered", "Followed up"];

interface Row {
  shipment: SampleShipment;
  contact: Contact;
}

export default function BottlesPage() {
  const { contacts, loading } = useData();
  const [shipments, setShipments] = useState<SampleShipment[] | null>(null);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) {
      setShipments([]); // on-device mode: shipments are cloud-only
      return;
    }
    void (async () => {
      const { data } = await sb
        .from("sample_shipments")
        .select("*")
        .order("created_at", { ascending: false });
      setShipments((data as SampleShipment[]) ?? []);
    })();
  }, []);

  const data = useMemo(() => {
    const byId = new Map(contacts.map((c) => [c.id, c]));
    const rows: Row[] = (shipments ?? [])
      .map((s) => ({ shipment: s, contact: byId.get(s.contact_id) }))
      .filter((r): r is Row => Boolean(r.contact));

    const addressOf = (r: Row) =>
      (r.shipment.shipping_address || r.contact.shipping_address || "").trim();

    const queue = rows.filter((r) => PRE_SHIP.includes(r.shipment.status));
    const ready = queue.filter((r) => r.shipment.status === "Ready");
    const needAddress = queue.filter((r) => addressOf(r) === "");
    const sent = rows.filter((r) => SENT.includes(r.shipment.status));

    const byPriority = (a: Row, b: Row) =>
      (PRIORITY_ORDER[a.contact.bottle_priority] ?? 9) -
      (PRIORITY_ORDER[b.contact.bottle_priority] ?? 9);

    return {
      queueCount: queue.length,
      toShip: queue.reduce((s, r) => s + (r.shipment.quantity || 1), 0),
      shipped: sent.reduce((s, r) => s + (r.shipment.quantity || 1), 0),
      ready: [...ready].sort(byPriority),
      needAddress: [...needAddress].sort(byPriority),
      queue: [...queue].sort(byPriority),
      sent: [...sent].sort((a, b) =>
        (b.shipment.shipped_at ?? "").localeCompare(a.shipment.shipped_at ?? "")
      ),
    };
  }, [contacts, shipments]);

  const cloud = Boolean(getSupabase());

  return (
    <div>
      <PageHeader title="Kava Giveaways" subtitle="Every bottle, one pipeline — shared with the Ambassadors hub" />

      <div className="space-y-6 px-4 py-5 sm:px-6">
        {loading || shipments === null ? (
          <div className="py-20 text-center text-taupe-400">Loading…</div>
        ) : !cloud ? (
          <div className="card p-5 text-sm text-taupe-500">
            The bottle pipeline lives in the cloud (shared with the Ambassadors hub). Add your
            Supabase keys to see it here.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="In the queue" value={data.queueCount} accent />
              <Stat label="Bottles to ship" value={data.toShip} accent />
              <Stat label="Bottles sent" value={data.shipped} />
              <Stat label="Missing address" value={data.needAddress.length} warn={data.needAddress.length > 0} />
            </div>

            <Section title="🚀 Ready to ship" subtitle="High priority first" list={data.ready} empty="Nothing marked Ready yet." />
            <Section title="📍 Missing address" subtitle="Collect these before shipping" list={data.needAddress} empty="Everyone in the queue has an address." />
            <Section title="🍶 Full giveaway queue" subtitle="Planned and Ready shipments" list={data.queue} empty="No bottles in the queue — plan one from an ambassador or contact." />
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

function ShipmentBadge({ status }: { status: string }) {
  const cls =
    status === "Delivered" || status === "Followed up"
      ? "bg-sage-500/10 text-sage-600 ring-sage-500/20"
      : status === "Shipped"
        ? "bg-gold-400/15 text-gold-700 ring-gold-400/20"
        : "bg-night-900/[0.04] text-taupe-600 ring-night-900/10";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${cls}`}>
      {status}
    </span>
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
  list: Row[];
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
          list.map(({ shipment: s, contact: c }) => (
            <div key={s.id} className="p-3">
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
                    {s.quantity || 1} bottle(s)
                    {showSent && s.shipped_at ? ` · sent ${formatDate(s.shipped_at)}` : ""}
                    {showSent && s.tracking_number ? ` · ${s.tracking_number}` : ""}
                    {!showSent
                      ? (s.shipping_address || c.shipping_address).trim()
                        ? ` · ${(s.shipping_address || c.shipping_address).trim()}`
                        : " · no address"
                      : ""}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <PriorityBadge priority={c.bottle_priority} />
                  <ShipmentBadge status={s.status} />
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
