"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { useAuth } from "@/components/AuthProvider";
import { getSupabase } from "@/lib/supabase";
import type { Ambassador, SyncRun } from "@/lib/types";

// The Ambassadors hub: UpPromote-synced roster + sync health. UpPromote owns
// affiliate status, sales, and commission; the CRM owns the relationship
// (lifecycle, tier, notes) via the linked contact.

interface SyncStatus {
  configured: boolean;
  cloud: boolean;
  ambassadors?: number;
  runs: SyncRun[];
}

export default function AmbassadorsPage() {
  const { session, cloudEnabled, ready } = useAuth();
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [roster, setRoster] = useState<Ambassador[]>([]);
  const [busy, setBusy] = useState<"" | "dry" | "sync">("");
  const [message, setMessage] = useState("");

  const token = session?.access_token ?? "";

  const loadAll = useCallback(async () => {
    const sb = getSupabase();
    if (sb) {
      const { data } = await sb
        .from("ambassadors")
        .select("*")
        .order("total_revenue", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(200);
      setRoster((data as Ambassador[]) ?? []);
    }
    if (token) {
      try {
        const res = await fetch("/api/uppromote/sync", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) setStatus((await res.json()) as SyncStatus);
      } catch {
        // status card simply stays hidden
      }
    }
  }, [token]);

  useEffect(() => {
    if (ready) void loadAll();
  }, [ready, loadAll]);

  const runSync = useCallback(
    async (dry: boolean) => {
      if (!token) return;
      setBusy(dry ? "dry" : "sync");
      setMessage("");
      try {
        const demo = status && !status.configured ? "&demo=1" : "";
        const res = await fetch(`/api/uppromote/sync?dry_run=${dry ? "1" : "0"}${demo}`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        const body = (await res.json()) as {
          ok?: boolean;
          demo?: boolean;
          counts?: Record<string, number>;
          errors?: string[];
          error?: string;
        };
        if (!res.ok && body.error) {
          setMessage(body.error);
        } else {
          const c = body.counts ?? {};
          const errs = body.errors ?? [];
          setMessage(
            `${body.demo ? "Demo run (fixtures, nothing written)" : dry ? "Dry run (nothing written)" : "Sync complete"}: ` +
              `${c.affiliates_fetched ?? 0} affiliates, ${c.referrals_fetched ?? 0} referrals, ` +
              `${c.payments_fetched ?? 0} payments${
                errs.length > 0
                  ? ` · ${errs.length} warning${errs.length > 1 ? "s" : ""}: ${errs[0]}${errs.length > 1 ? " (…)" : ""}`
                  : ""
              }`
          );
        }
      } catch {
        setMessage("Sync request failed — check your connection and try again.");
      } finally {
        setBusy("");
        void loadAll();
      }
    },
    [token, status, loadAll]
  );

  const totals = useMemo(() => {
    const revenue = roster.reduce((s, a) => s + (Number(a.total_revenue) || 0), 0);
    const commission = roster.reduce((s, a) => s + (Number(a.total_commission) || 0), 0);
    const approved = roster.filter((a) => a.uppromote_status === "approved").length;
    return { revenue, commission, approved };
  }, [roster]);

  if (!cloudEnabled) {
    return (
      <div className="min-h-dvh">
        <PageHeader title="Ambassadors" subtitle="UpPromote-synced roster" />
        <div className="px-4 py-6 sm:px-6">
          <Card>
            <p className="text-sm text-taupe-600">
              The Ambassadors hub syncs from UpPromote and needs cloud mode. Add your Supabase
              keys to enable sign-in and cross-device sync, then come back here.
            </p>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh pb-24 md:pb-8">
      <PageHeader
        title="Ambassadors"
        subtitle="The program roster — sales and commission synced from UpPromote"
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={() => void runSync(true)}
              disabled={busy !== "" || !token}
              className="rounded-xl px-3 py-2 text-xs font-semibold text-taupe-600 ring-1 ring-night-900/10 transition hover:bg-night-900/[0.04] disabled:opacity-50"
            >
              {busy === "dry" ? "Running…" : "Dry run"}
            </button>
            <button
              onClick={() => void runSync(false)}
              disabled={busy !== "" || !token || !status?.configured}
              className="btn-gold rounded-xl px-3 py-2 text-xs font-semibold disabled:opacity-50"
            >
              {busy === "sync" ? "Syncing…" : "Sync now"}
            </button>
          </div>
        }
      />

      <div className="space-y-4 px-4 py-4 sm:px-6">
        {status && !status.configured && (
          <Card tone="warn">
            <p className="text-sm font-semibold">UpPromote is not connected</p>
            <p className="mt-1 text-sm text-taupe-600">
              Set <code className="font-mono text-xs">UPPROMOTE_API_KEY</code> in Vercel
              (generate it in UpPromote → Settings → Integrations → API &amp; Webhook — API v2
              access requires a plan that includes the API). Until then, &ldquo;Dry run&rdquo;
              exercises the pipeline with clearly-labeled demo fixtures and writes nothing.
            </p>
          </Card>
        )}

        {message && (
          <Card>
            <p className="text-sm text-taupe-600">{message}</p>
          </Card>
        )}

        {/* Stat strip */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Ambassadors" value={String(roster.length)} />
          <Stat label="Approved" value={String(totals.approved)} />
          <Stat label="Attributed revenue" value={`$${totals.revenue.toFixed(2)}`} />
          <Stat label="Commission owed" value={`$${totals.commission.toFixed(2)}`} />
        </div>

        {/* Roster */}
        {roster.length === 0 ? (
          <Card>
            <p className="text-sm font-semibold">No ambassadors synced yet</p>
            <p className="mt-1 text-sm text-taupe-600">
              Once UpPromote is connected, &ldquo;Sync now&rdquo; imports every affiliate with
              their links, coupons, referral sales, and payouts — and links each one to their
              contact record by email. People you sign in the field still get added as{" "}
              <Link href="/contacts" className="font-semibold text-gold-600 hover:underline">
                Connections
              </Link>{" "}
              first; the sync attaches the numbers.
            </p>
          </Card>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="space-y-2 md:hidden">
              {roster.map((a) => (
                <AmbassadorCard key={a.id} a={a} />
              ))}
            </div>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto rounded-2xl bg-cream-50 ring-1 ring-night-900/5 md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-night-900/5 text-left text-xs uppercase tracking-wide text-taupe-500">
                    <th className="px-4 py-3 font-semibold">Name</th>
                    <th className="px-4 py-3 font-semibold">Tier</th>
                    <th className="px-4 py-3 font-semibold">UpPromote</th>
                    <th className="px-4 py-3 font-semibold">Lifecycle</th>
                    <th className="px-4 py-3 text-right font-semibold">Referrals</th>
                    <th className="px-4 py-3 text-right font-semibold">Revenue</th>
                    <th className="px-4 py-3 text-right font-semibold">Commission</th>
                    <th className="px-4 py-3 font-semibold">Last sale</th>
                  </tr>
                </thead>
                <tbody>
                  {roster.map((a) => (
                    <tr key={a.id} className="border-b border-night-900/5 last:border-0">
                      <td className="px-4 py-3">
                        <NameCell a={a} />
                      </td>
                      <td className="px-4 py-3">
                        <TierChip tier={a.tier} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusChip status={a.uppromote_status} />
                      </td>
                      <td className="px-4 py-3 text-taupe-600">{a.lifecycle}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{a.total_referrals}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        ${Number(a.total_revenue).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        ${Number(a.total_commission).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-taupe-500">
                        {a.last_sale_at ? a.last_sale_at.slice(0, 10) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Sync health */}
        {status && status.runs.length > 0 && (
          <Card>
            <p className="text-xs font-bold uppercase tracking-wide text-taupe-500">
              Sync health
            </p>
            <ul className="mt-2 space-y-1.5">
              {status.runs.map((r) => (
                <li key={r.id} className="flex items-center gap-2 text-sm">
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      r.status === "success"
                        ? "bg-sage-500"
                        : r.status === "running"
                          ? "bg-gold-400"
                          : r.status === "partial"
                            ? "bg-gold-400"
                            : "bg-rose-500"
                    }`}
                  />
                  <span className="text-taupe-600">
                    {r.started_at.slice(0, 16).replace("T", " ")} · {r.kind}
                    {r.dry_run ? " (dry run)" : ""} · {r.status}
                    {r.counts && typeof r.counts.affiliates_fetched === "number"
                      ? ` · ${r.counts.affiliates_fetched} affiliates`
                      : ""}
                    {r.errors && r.errors.length > 0 ? (
                      <span className="block text-xs text-rose-500">{r.errors[0]}</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}

function Card({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: "warn";
}) {
  return (
    <div
      className={`rounded-2xl p-4 ring-1 ${
        tone === "warn"
          ? "bg-gold-400/10 ring-gold-400/30"
          : "bg-cream-50 ring-night-900/5"
      }`}
    >
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-cream-50 p-3.5 ring-1 ring-night-900/5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-taupe-500">{label}</p>
      <p className="mt-1 text-lg font-bold tabular-nums">{value}</p>
    </div>
  );
}

function NameCell({ a }: { a: Ambassador }) {
  const name = `${a.first_name} ${a.last_name}`.trim() || a.email || "—";
  return a.contact_id ? (
    <Link
      href={`/contacts/${a.contact_id}`}
      className="font-semibold text-night-800 hover:text-gold-600"
    >
      {name}
    </Link>
  ) : (
    <span className="font-semibold text-night-800">{name}</span>
  );
}

function TierChip({ tier }: { tier: string }) {
  const cls =
    tier === "Founding Circle"
      ? "bg-gold-400/15 text-gold-700 ring-gold-400/20"
      : tier === "Islander"
        ? "bg-sage-500/10 text-sage-600 ring-sage-500/20"
        : "bg-night-900/[0.04] text-taupe-600 ring-night-900/10";
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${cls}`}>
      {tier}
    </span>
  );
}

function StatusChip({ status }: { status: string }) {
  const cls =
    status === "approved"
      ? "bg-sage-500/10 text-sage-600 ring-sage-500/20"
      : status === "pending"
        ? "bg-gold-400/15 text-gold-700 ring-gold-400/20"
        : "bg-night-900/[0.04] text-taupe-600 ring-night-900/10";
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${cls}`}>
      {status || "—"}
    </span>
  );
}

function AmbassadorCard({ a }: { a: Ambassador }) {
  return (
    <div className="rounded-2xl bg-cream-50 p-3.5 ring-1 ring-night-900/5">
      <div className="flex items-center justify-between gap-2">
        <NameCell a={a} />
        <TierChip tier={a.tier} />
      </div>
      <div className="mt-1.5 flex items-center gap-2 text-xs text-taupe-500">
        <StatusChip status={a.uppromote_status} />
        <span>{a.lifecycle}</span>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
        <div>
          <p className="font-bold tabular-nums">{a.total_referrals}</p>
          <p className="text-taupe-500">referrals</p>
        </div>
        <div>
          <p className="font-bold tabular-nums">${Number(a.total_revenue).toFixed(0)}</p>
          <p className="text-taupe-500">revenue</p>
        </div>
        <div>
          <p className="font-bold tabular-nums">${Number(a.total_commission).toFixed(2)}</p>
          <p className="text-taupe-500">commission</p>
        </div>
      </div>
    </div>
  );
}
