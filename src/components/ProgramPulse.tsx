"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import type { Ambassador } from "@/lib/types";

// Program Pulse — the ambassador program at a glance: signup growth,
// activation funnel, leaderboard, and bottle deployment. Reads only what the
// sync + gifting workflows already store; UpPromote stays the source of truth
// for money numbers.

const BOTTLE_ALLOCATION = 1000;

interface PulseData {
  deliveredContacts: Set<string>;
  shippedBottles: number;
  plannedBottles: number;
  contentContacts: Set<string>;
}

export function ProgramPulse({ roster }: { roster: Ambassador[] }) {
  const [extra, setExtra] = useState<PulseData | null>(null);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    let active = true;
    void (async () => {
      const [{ data: ships }, { data: posts }] = await Promise.all([
        sb.from("sample_shipments").select("contact_id, quantity, status"),
        sb.from("content_posts").select("contact_id"),
      ]);
      if (!active) return;
      const deliveredContacts = new Set<string>();
      let shippedBottles = 0;
      let plannedBottles = 0;
      for (const s of ships ?? []) {
        const qty = Number(s.quantity) || 0;
        if (s.status === "Delivered" || s.status === "Followed up") {
          deliveredContacts.add(s.contact_id as string);
          shippedBottles += qty;
        } else if (s.status === "Shipped") {
          shippedBottles += qty;
        } else {
          plannedBottles += qty;
        }
      }
      const contentContacts = new Set<string>((posts ?? []).map((p) => p.contact_id as string));
      setExtra({ deliveredContacts, shippedBottles, plannedBottles, contentContacts });
    })();
    return () => {
      active = false;
    };
  }, []);

  const weeks = useMemo(() => {
    // Last 8 weeks of signups from UpPromote's created date.
    const out: { label: string; count: number }[] = [];
    const now = new Date();
    for (let i = 7; i >= 0; i--) {
      const start = new Date(now);
      start.setDate(start.getDate() - start.getDay() - i * 7);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      const count = roster.filter((a) => {
        if (!a.uppromote_created_at) return false;
        const t = new Date(a.uppromote_created_at);
        return t >= start && t < end;
      }).length;
      out.push({
        label: `${start.getMonth() + 1}/${start.getDate()}`,
        count,
      });
    }
    return out;
  }, [roster]);

  const funnel = useMemo(() => {
    const signed = roster.length;
    const linked = roster.filter((a) => a.contact_id);
    const delivered = extra
      ? linked.filter((a) => extra.deliveredContacts.has(a.contact_id as string)).length
      : 0;
    const content = extra
      ? linked.filter((a) => extra.contentContacts.has(a.contact_id as string)).length
      : 0;
    const firstSale = roster.filter((a) => a.total_referrals > 0).length;
    return [
      { label: "Signed", count: signed },
      { label: "Bottle delivered", count: delivered },
      { label: "Content posted", count: content },
      { label: "First sale", count: firstSale },
    ];
  }, [roster, extra]);

  const leaders = useMemo(
    () =>
      [...roster]
        .sort(
          (a, b) =>
            Number(b.total_revenue) - Number(a.total_revenue) ||
            b.total_referrals - a.total_referrals ||
            Number(b.total_commission) - Number(a.total_commission)
        )
        .slice(0, 5),
    [roster]
  );

  if (roster.length === 0) return null;

  const maxWeek = Math.max(1, ...weeks.map((w) => w.count));
  const signedMax = Math.max(1, funnel[0].count);
  const shipped = extra?.shippedBottles ?? 0;
  const anyRevenue = leaders.some((a) => Number(a.total_revenue) > 0);
  const medals = ["🥇", "🥈", "🥉", "4", "5"];

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {/* Signup growth */}
      <section className="rounded-2xl bg-cream-50 p-4 ring-1 ring-night-900/5">
        <header className="flex items-baseline justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wide text-taupe-500">
            Signups · last 8 weeks
          </h2>
          <span className="text-xs font-semibold text-sage-600">
            {weeks.reduce((s, w) => s + w.count, 0)} joined
          </span>
        </header>
        <div className="mt-3 flex h-24 items-end gap-1.5" role="img" aria-label="Weekly ambassador signups">
          {weeks.map((w, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-[10px] font-semibold tabular-nums text-taupe-500">
                {w.count > 0 ? w.count : ""}
              </span>
              <div
                className={`w-full rounded-t-md ${w.count > 0 ? "bg-gold-400/80" : "bg-night-900/[0.06]"}`}
                style={{ height: `${Math.max(4, (w.count / maxWeek) * 64)}px` }}
              />
              <span className="text-[9px] text-taupe-400">{w.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Activation funnel */}
      <section className="rounded-2xl bg-cream-50 p-4 ring-1 ring-night-900/5">
        <h2 className="text-xs font-bold uppercase tracking-wide text-taupe-500">
          Activation funnel
        </h2>
        <div className="mt-3 space-y-2">
          {funnel.map((step) => (
            <div key={step.label} className="flex items-center gap-2">
              <span className="w-28 shrink-0 text-xs font-semibold text-taupe-600">
                {step.label}
              </span>
              <div className="h-5 flex-1 overflow-hidden rounded-md bg-night-900/[0.05]">
                <div
                  className="flex h-full items-center rounded-md bg-sage-500/70 pl-2"
                  style={{ width: `${Math.max(step.count > 0 ? 12 : 0, (step.count / signedMax) * 100)}%` }}
                >
                  <span className="text-[11px] font-bold text-white">{step.count}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-taupe-400">
          Signed → bottle → content → sale. The gaps are this week&rsquo;s to-do list.
        </p>
      </section>

      {/* Leaderboard */}
      <section className="rounded-2xl bg-cream-50 p-4 ring-1 ring-night-900/5">
        <header className="flex items-baseline justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wide text-taupe-500">Leaderboard</h2>
          <span className="text-[11px] text-taupe-400">monthly · feeds the Founding Circle</span>
        </header>
        <ol className="mt-2 space-y-1.5">
          {leaders.map((a, i) => (
            <li key={a.id} className="flex items-center gap-2.5 text-sm">
              <span className="w-6 text-center text-sm">{medals[i]}</span>
              <span className="min-w-0 flex-1 truncate font-semibold text-night-800">
                {`${a.first_name} ${a.last_name}`.trim() || a.email}
              </span>
              {a.tier !== "Ambassador" && (
                <span className="rounded-full bg-gold-400/15 px-2 py-0.5 text-[10px] font-bold text-gold-700">
                  {a.tier}
                </span>
              )}
              <span className="tabular-nums text-taupe-600">
                {anyRevenue ? `$${Number(a.total_revenue).toFixed(0)}` : `${a.total_referrals} sales`}
              </span>
            </li>
          ))}
        </ol>
        {!anyRevenue && (
          <p className="mt-2 text-[11px] text-taupe-400">
            First tracked sale takes the crown — the board is wide open. 🏆
          </p>
        )}
      </section>

      {/* Bottle deployment */}
      <section className="rounded-2xl bg-cream-50 p-4 ring-1 ring-night-900/5">
        <header className="flex items-baseline justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wide text-taupe-500">
            Bottle deployment
          </h2>
          <span className="text-xs font-semibold tabular-nums text-taupe-600">
            {shipped} / {BOTTLE_ALLOCATION}
          </span>
        </header>
        <div className="mt-3 h-3 overflow-hidden rounded-full bg-night-900/[0.06]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-gold-400 to-sage-500"
            style={{ width: `${Math.min(100, Math.max(shipped > 0 ? 1.5 : 0, (shipped / BOTTLE_ALLOCATION) * 100))}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between text-[11px] text-taupe-500">
          <span>{shipped} shipped or delivered</span>
          <span>{extra?.plannedBottles ?? 0} planned</span>
        </div>
        <p className="mt-2 text-[11px] text-taupe-400">
          Every bottle is logged against an ambassador — this bar is the 1,000-bottle deployment
          becoming attributable revenue.
        </p>
      </section>
    </div>
  );
}
