"use client";

import { useState } from "react";
import { useSequences } from "./SequencesProvider";
import { Modal } from "./Modal";
import { Select } from "./ContactForm";
import { SEQUENCE_CHANNELS } from "@/lib/constants";
import { seedDefaultSequences } from "@/lib/sequences";
import { storageMode } from "@/lib/data";
import type { NewSequence, Sequence, SequenceStep } from "@/lib/types";

export function SequencesManager() {
  const { sequences, loading, create, update, remove, reload } = useSequences();
  const [editing, setEditing] = useState<Sequence | "new" | null>(null);
  const [seeding, setSeeding] = useState(false);

  async function addStarters() {
    setSeeding(true);
    try {
      await seedDefaultSequences();
      await reload();
    } finally {
      setSeeding(false);
    }
  }

  async function save(values: NewSequence) {
    if (editing && editing !== "new") await update(editing.id, values);
    else await create(values);
    setEditing(null);
  }

  return (
    <div className="space-y-4 px-4 py-4 sm:px-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-taupe-500">
          Multi-step cadences. Enroll people from their profile and the steps schedule
          themselves.
        </p>
        <button onClick={() => setEditing("new")} className="btn-primary text-sm">
          + New
        </button>
      </div>

      {loading ? (
        <div className="py-16 text-center text-taupe-400">Loading…</div>
      ) : sequences.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-sm text-taupe-500">No cadences yet.</p>
          {storageMode === "cloud" && (
            <button onClick={addStarters} disabled={seeding} className="btn-ghost mt-3 text-sm">
              {seeding ? "Adding…" : "Add 2 starter cadences"}
            </button>
          )}
          <button onClick={() => setEditing("new")} className="btn-primary mt-3 text-sm sm:ml-2">
            + Build one
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {sequences.map((s) => (
            <div key={s.id} className="card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-semibold">{s.name}</h3>
                  {s.description && (
                    <p className="text-xs text-taupe-500">{s.description}</p>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <button onClick={() => setEditing(s)} className="btn-subtle px-2 py-1 text-xs">
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete "${s.name}"?`)) remove(s.id);
                    }}
                    className="btn-subtle px-2 py-1 text-xs text-rose-600"
                  >
                    Delete
                  </button>
                </div>
              </div>
              <ol className="mt-3 space-y-1.5">
                {s.steps.map((st, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <span className="flex h-6 w-12 shrink-0 items-center justify-center rounded-full bg-night-900/[0.04] text-[11px] font-semibold text-taupe-600">
                      Day {st.day}
                    </span>
                    <span className="text-xs font-medium text-gold-700">{st.channel}</span>
                    <span className="min-w-0 truncate text-taupe-600">{st.label}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing && editing !== "new" ? "Edit sequence" : "New sequence"}
        wide
      >
        {editing !== null && (
          <SequenceEditor
            initial={editing === "new" ? undefined : editing}
            onSubmit={save}
            onCancel={() => setEditing(null)}
          />
        )}
      </Modal>
    </div>
  );
}

function blankSeq(): NewSequence {
  return {
    name: "",
    description: "",
    steps: [{ day: 0, channel: "DM", label: "", body: "" }],
  };
}

function SequenceEditor({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: Sequence;
  onSubmit: (v: NewSequence) => Promise<void> | void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [steps, setSteps] = useState<SequenceStep[]>(
    initial?.steps?.length ? initial.steps : blankSeq().steps
  );
  const [saving, setSaving] = useState(false);

  function setStep(i: number, patch: Partial<SequenceStep>) {
    setSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }
  function addStep() {
    const lastDay = steps.length ? steps[steps.length - 1].day : 0;
    setSteps((prev) => [
      ...prev,
      { day: lastDay + 3, channel: "DM", label: "", body: "" },
    ]);
  }
  function removeStep(i: number) {
    setSteps((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || steps.length === 0) return;
    setSaving(true);
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim(),
        steps: [...steps].sort((a, b) => a.day - b.day),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label">Name *</label>
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Creator outreach"
          autoFocus
        />
      </div>
      <div>
        <label className="label">Description</label>
        <input
          className="input"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What this cadence is for"
        />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="label mb-0">Steps</label>
          <button type="button" onClick={addStep} className="btn-subtle px-2 py-1 text-xs">
            + Add step
          </button>
        </div>
        <div className="space-y-2">
          {steps.map((st, i) => (
            <div key={i} className="rounded-2xl bg-night-900/[0.03] p-3">
              <div className="flex items-center gap-2">
                <div className="w-20">
                  <label className="label">Day</label>
                  <input
                    className="input"
                    inputMode="numeric"
                    value={st.day}
                    onChange={(e) => setStep(i, { day: Number(e.target.value) || 0 })}
                  />
                </div>
                <div className="w-28">
                  <label className="label">Channel</label>
                  <Select
                    value={st.channel}
                    onChange={(v) => setStep(i, { channel: v as SequenceStep["channel"] })}
                    options={SEQUENCE_CHANNELS}
                  />
                </div>
                <div className="flex-1">
                  <label className="label">Step</label>
                  <input
                    className="input"
                    value={st.label}
                    onChange={(e) => setStep(i, { label: e.target.value })}
                    placeholder="e.g. Friendly bump"
                  />
                </div>
                {steps.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeStep(i)}
                    className="mt-5 shrink-0 px-1 text-taupe-400 hover:text-rose-600"
                    aria-label="Remove step"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="sticky bottom-0 -mx-5 flex justify-end gap-2 border-t border-night-900/5 bg-cream-50/95 px-5 py-3">
        <button type="button" onClick={onCancel} className="btn-ghost">
          Cancel
        </button>
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? "Saving…" : initial ? "Save changes" : "Create sequence"}
        </button>
      </div>
    </form>
  );
}
