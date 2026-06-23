"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useDeals } from "@/components/DealsProvider";
import { PageHeader } from "@/components/PageHeader";
import { DealForm } from "@/components/DealForm";
import { Modal } from "@/components/Modal";
import { DealTypeBadge, StageBadge } from "@/components/Badge";
import {
  DEAL_STAGES,
  DEAL_TYPES,
  OPEN_STAGES,
  STAGE_PROBABILITY,
} from "@/lib/constants";
import { formatDate, formatMoney, isOverdue, todayISO } from "@/lib/helpers";
import type { Deal, DealStage, NewDeal } from "@/lib/types";

function prob(d: Deal): number {
  return d.probability ?? STAGE_PROBABILITY[d.stage];
}
function weighted(d: Deal): number {
  return ((d.value ?? 0) * prob(d)) / 100;
}
const isOpen = (d: Deal) => d.stage !== "Won" && d.stage !== "Lost";

export default function DealsPage() {
  const { deals, loading, create, update } = useDeals();
  const [mode, setMode] = useState<"board" | "list">("board");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [adding, setAdding] = useState(false);

  const filtered = useMemo(() => {
    return deals.filter((d) => {
      if (typeFilter && d.deal_type !== typeFilter) return false;
      if (query.trim()) {
        const hay = `${d.title} ${d.company} ${d.notes} ${d.source} ${d.next_step}`.toLowerCase();
        if (!query.toLowerCase().split(/\s+/).every((t) => hay.includes(t))) return false;
      }
      return true;
    });
  }, [deals, query, typeFilter]);

  const stats = useMemo(() => {
    const open = deals.filter(isOpen);
    const won = deals.filter((d) => d.stage === "Won");
    const lost = deals.filter((d) => d.stage === "Lost");
    const thisMonth = todayISO().slice(0, 7);
    return {
      openCount: open.length,
      openValue: open.reduce((s, d) => s + (d.value ?? 0), 0),
      weighted: open.reduce((s, d) => s + weighted(d), 0),
      wonValue: won.reduce((s, d) => s + (d.value ?? 0), 0),
      winRate:
        won.length + lost.length > 0
          ? Math.round((won.length / (won.length + lost.length)) * 100)
          : 0,
      closingThisMonth: open
        .filter((d) => (d.expected_close_date ?? "").slice(0, 7) === thisMonth)
        .reduce((s, d) => s + (d.value ?? 0), 0),
      overdue: open.filter((d) => isOverdue(d.next_step_date)).length,
    };
  }, [deals]);

  async function handleCreate(values: NewDeal) {
    await create(values);
    setAdding(false);
  }

  return (
    <div>
      <PageHeader
        title="Deals"
        subtitle="Your B2B & partnership pipeline"
        action={
          <button onClick={() => setAdding(true)} className="btn-primary">
            + Add deal
          </button>
        }
      />

      <div className="space-y-5 px-4 py-4 sm:px-6">
        {loading ? (
          <div className="py-20 text-center text-slate-500">Loading…</div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="Open deals" value={String(stats.openCount)} />
              <Stat label="Pipeline value" value={formatMoney(stats.openValue)} accent />
              <Stat label="Weighted forecast" value={formatMoney(stats.weighted)} accent />
              <Stat label="Won (all-time)" value={formatMoney(stats.wonValue)} />
              <Stat label="Win rate" value={`${stats.winRate}%`} />
              <Stat label="Closing this month" value={formatMoney(stats.closingThisMonth)} />
              <Stat label="Overdue steps" value={String(stats.overdue)} warn={stats.overdue > 0} />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                className="input max-w-xs"
                placeholder="Search deals…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className={`rounded-xl px-3 py-1.5 text-xs ring-1 ring-white/10 ${
                  typeFilter ? "bg-kava-500/15 text-kava-200" : "bg-white/5 text-slate-300"
                }`}
              >
                <option value="">All types</option>
                {DEAL_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <div className="ml-auto flex rounded-xl bg-white/5 p-0.5 ring-1 ring-white/10">
                <button
                  onClick={() => setMode("board")}
                  className={`rounded-lg px-3 py-1 text-xs font-medium ${
                    mode === "board" ? "bg-kava-500 text-ink-950" : "text-slate-300"
                  }`}
                >
                  Board
                </button>
                <button
                  onClick={() => setMode("list")}
                  className={`rounded-lg px-3 py-1 text-xs font-medium ${
                    mode === "list" ? "bg-kava-500 text-ink-950" : "text-slate-300"
                  }`}
                >
                  List
                </button>
              </div>
            </div>

            {mode === "board" ? (
              <Board deals={filtered} onMove={(id, stage) => update(id, { stage })} />
            ) : (
              <DealList deals={filtered} onMove={(id, stage) => update(id, { stage })} />
            )}
          </>
        )}
      </div>

      <Modal open={adding} onClose={() => setAdding(false)} title="Add deal" wide>
        <DealForm onSubmit={handleCreate} onCancel={() => setAdding(false)} />
      </Modal>
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
  value: string;
  accent?: boolean;
  warn?: boolean;
}) {
  return (
    <div className="card p-4">
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
}

function Board({
  deals,
  onMove,
}: {
  deals: Deal[];
  onMove: (id: string, stage: DealStage) => void;
}) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {DEAL_STAGES.map((stage) => {
        const col = deals.filter((d) => d.stage === stage);
        const total = col.reduce((s, d) => s + (d.value ?? 0), 0);
        return (
          <div key={stage} className="w-72 shrink-0">
            <div className="mb-2 flex items-center justify-between px-1">
              <StageBadge stage={stage} />
              <span className="text-xs text-slate-500">
                {col.length} · {formatMoney(total)}
              </span>
            </div>
            <div className="space-y-2">
              {col.map((d) => (
                <DealCard key={d.id} deal={d} onMove={onMove} />
              ))}
              {col.length === 0 && (
                <div className="rounded-xl border border-dashed border-white/10 p-4 text-center text-xs text-slate-600">
                  Empty
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DealCard({
  deal,
  onMove,
}: {
  deal: Deal;
  onMove: (id: string, stage: DealStage) => void;
}) {
  const overdue = isOverdue(deal.next_step_date);
  return (
    <div className="card p-3">
      <Link href={`/deals/${deal.id}`} className="block font-medium hover:text-kava-300">
        {deal.title}
      </Link>
      {deal.company && deal.company !== deal.title && (
        <div className="truncate text-xs text-slate-500">{deal.company}</div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <DealTypeBadge type={deal.deal_type} />
        <span className="text-sm font-semibold text-kava-300">
          {formatMoney(deal.value)}
        </span>
      </div>
      {deal.next_step && (
        <div className={`mt-2 text-xs ${overdue ? "text-rose-300" : "text-slate-400"}`}>
          → {deal.next_step}
          {deal.next_step_date ? ` · ${formatDate(deal.next_step_date)}` : ""}
          {overdue ? " (overdue)" : ""}
        </div>
      )}
      <select
        value={deal.stage}
        onChange={(e) => onMove(deal.id, e.target.value as DealStage)}
        className="input mt-2 py-1 text-xs"
        title="Move stage"
      >
        {DEAL_STAGES.map((s) => (
          <option key={s} value={s}>
            Move to: {s}
          </option>
        ))}
      </select>
    </div>
  );
}

function DealList({
  deals,
  onMove,
}: {
  deals: Deal[];
  onMove: (id: string, stage: DealStage) => void;
}) {
  const sorted = [...deals].sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  return (
    <div className="card divide-y divide-white/5">
      {sorted.map((d) => (
        <div key={d.id} className="flex flex-wrap items-center gap-3 p-3">
          <div className="min-w-0 flex-1">
            <Link href={`/deals/${d.id}`} className="font-medium hover:text-kava-300">
              {d.title}
            </Link>
            <div className="truncate text-xs text-slate-500">
              {d.company}
              {d.expected_close_date ? ` · close ${formatDate(d.expected_close_date)}` : ""}
            </div>
          </div>
          <DealTypeBadge type={d.deal_type} />
          <span className="w-20 text-right text-sm font-semibold text-kava-300">
            {formatMoney(d.value)}
          </span>
          <select
            value={d.stage}
            onChange={(e) => onMove(d.id, e.target.value as DealStage)}
            className="input w-36 py-1 text-xs"
          >
            {DEAL_STAGES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      ))}
      {sorted.length === 0 && (
        <div className="p-10 text-center text-slate-500">No deals yet.</div>
      )}
    </div>
  );
}
