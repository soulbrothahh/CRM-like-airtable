"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useDeals } from "@/components/DealsProvider";
import { useData } from "@/components/DataProvider";
import { DealForm } from "@/components/DealForm";
import { Modal } from "@/components/Modal";
import { Select } from "@/components/ContactForm";
import { DealTypeBadge, StageBadge } from "@/components/Badge";
import { DEAL_ACTIVITY_TYPES, DEAL_STAGES, STAGE_PROBABILITY } from "@/lib/constants";
import {
  createDealActivity,
  deleteDealActivity,
  getDeal,
  listDealActivities,
} from "@/lib/deals";
import { formatDate, formatMoney, isOverdue, todayISO } from "@/lib/helpers";
import type { Deal, DealActivity, DealActivityType, DealStage, NewDeal } from "@/lib/types";

export default function DealDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { update, remove } = useDeals();
  const { contacts } = useData();
  const [deal, setDeal] = useState<Deal | null>(null);
  const [activities, setActivities] = useState<DealActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  async function load() {
    setLoading(true);
    const [d, a] = await Promise.all([getDeal(id), listDealActivities(id)]);
    setDeal(d);
    setActivities(a);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleSave(values: NewDeal) {
    const updated = await update(id, values);
    setDeal(updated);
    setEditing(false);
  }

  async function moveStage(stage: DealStage) {
    const updated = await update(id, { stage });
    setDeal(updated);
  }

  async function handleDelete() {
    if (!confirm("Delete this deal and its activity log?")) return;
    await remove(id);
    router.push("/deals");
  }

  if (loading) return <div className="p-10 text-center text-taupe-400">Loading…</div>;
  if (!deal)
    return (
      <div className="p-10 text-center text-taupe-400">
        Deal not found.{" "}
        <Link href="/deals" className="text-gold-600">
          Back to deals
        </Link>
      </div>
    );

  const d = deal;
  const linked = contacts.find((c) => c.id === d.contact_id);
  const probability = d.probability ?? STAGE_PROBABILITY[d.stage];
  const weighted = ((d.value ?? 0) * probability) / 100;

  return (
    <div className="px-4 py-5 sm:px-6">
      <div className="mb-4 flex items-center justify-between">
        <Link href="/deals" className="btn-subtle text-sm">
          ← Deals
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
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{d.title}</h1>
            <p className="text-sm text-taupe-500">
              {d.company}
              {linked ? (
                <>
                  {" · "}
                  <Link href={`/contacts/${linked.id}`} className="text-gold-600 hover:underline">
                    {linked.name}
                  </Link>
                </>
              ) : null}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <StageBadge stage={d.stage} />
              <DealTypeBadge type={d.deal_type} />
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-gold-600">{formatMoney(d.value)}</div>
            <div className="text-xs text-taupe-500">
              {probability}% · weighted {formatMoney(weighted)}
            </div>
          </div>
        </div>

        <div className="mt-4 border-t border-night-900/5 pt-4">
          <label className="label">Move stage</label>
          <div className="-mx-0.5 flex flex-wrap gap-1.5">
            {DEAL_STAGES.map((s) => (
              <button
                key={s}
                onClick={() => moveStage(s)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition ${
                  s === d.stage
                    ? "bg-gold-400 text-night-900 ring-gold-400"
                    : "bg-night-900/[0.03] text-taupe-600 ring-night-900/10 hover:bg-night-900/[0.05]"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-1">
          <div className="card p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-gold-600/80">
              Deal info
            </h3>
            <div className="space-y-2.5">
              <Info label="Expected close" value={formatDate(d.expected_close_date)} />
              <Info label="Owner" value={d.owner} />
              <Info label="Source" value={d.source} />
              <div>
                <div className="label">Next step</div>
                <div
                  className={`text-sm ${
                    isOverdue(d.next_step_date) ? "text-rose-600" : "text-night-800"
                  }`}
                >
                  {d.next_step || "—"}
                  {d.next_step_date ? ` · ${formatDate(d.next_step_date)}` : ""}
                  {isOverdue(d.next_step_date) ? " (overdue)" : ""}
                </div>
              </div>
            </div>
          </div>

          {d.notes && (
            <div className="card p-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-gold-600/80">
                Notes
              </h3>
              <p className="whitespace-pre-wrap text-sm text-taupe-600">{d.notes}</p>
            </div>
          )}
        </div>

        <div className="lg:col-span-2">
          <ActivityLog dealId={d.id} activities={activities} onChange={load} onTouch={(patch) => update(d.id, patch).then(setDeal)} />
        </div>
      </div>

      <Modal open={editing} onClose={() => setEditing(false)} title="Edit deal" wide>
        <DealForm initial={d} onSubmit={handleSave} onCancel={() => setEditing(false)} />
      </Modal>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  if (!value || value === "—") return (
    <div>
      <div className="label">{label}</div>
      <div className="text-sm text-taupe-400">—</div>
    </div>
  );
  return (
    <div>
      <div className="label">{label}</div>
      <div className="text-sm text-night-800">{value}</div>
    </div>
  );
}

function ActivityLog({
  dealId,
  activities,
  onChange,
  onTouch,
}: {
  dealId: string;
  activities: DealActivity[];
  onChange: () => void;
  onTouch: (patch: Partial<Deal>) => void;
}) {
  const [type, setType] = useState<DealActivityType>("Call");
  const [date, setDate] = useState(todayISO());
  const [notes, setNotes] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [saving, setSaving] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!notes.trim() && !nextAction.trim()) return;
    setSaving(true);
    try {
      await createDealActivity({ deal_id: dealId, date, type, notes, next_action: nextAction });
      // keep the deal's "next step" in sync when one is provided
      if (nextAction.trim()) onTouch({ next_step: nextAction.trim() });
      setNotes("");
      setNextAction("");
      onChange();
    } finally {
      setSaving(false);
    }
  }

  async function removeActivity(id: string) {
    await deleteDealActivity(id);
    onChange();
  }

  return (
    <div className="card p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-gold-600/80">
        Activity & progress
      </h3>

      <form onSubmit={add} className="mb-4 space-y-2 rounded-xl bg-cream-50/60 p-3">
        <div className="grid grid-cols-2 gap-2">
          <Select value={type} onChange={(v) => setType(v as DealActivityType)} options={DEAL_ACTIVITY_TYPES} />
          <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <textarea
          className="input min-h-[60px]"
          placeholder="What happened on this deal?"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <input
          className="input"
          placeholder="Next step (updates the deal's next step)"
          value={nextAction}
          onChange={(e) => setNextAction(e.target.value)}
        />
        <div className="flex justify-end">
          <button disabled={saving} className="btn-primary text-sm">
            {saving ? "Logging…" : "Log activity"}
          </button>
        </div>
      </form>

      {activities.length === 0 ? (
        <p className="text-sm text-taupe-400">No activity logged yet.</p>
      ) : (
        <ol className="relative space-y-4 border-l border-night-900/10 pl-5">
          {activities.map((a) => (
            <li key={a.id} className="relative">
              <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full bg-gold-400 ring-4 ring-cream-50" />
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-night-900">{a.type}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-taupe-400">{formatDate(a.date)}</span>
                  <button onClick={() => removeActivity(a.id)} className="text-xs text-taupe-400 hover:text-rose-600">
                    ✕
                  </button>
                </div>
              </div>
              {a.notes && <p className="text-sm text-taupe-600">{a.notes}</p>}
              {a.next_action && <p className="mt-0.5 text-xs text-gold-600">→ {a.next_action}</p>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
