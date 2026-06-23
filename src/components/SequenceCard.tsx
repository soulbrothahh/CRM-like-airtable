"use client";

import { useState } from "react";
import { useSequences } from "./SequencesProvider";
import { useData } from "./DataProvider";
import {
  advanceSequence,
  currentStep,
  enrollInSequence,
  findSequence,
  isStepDue,
  stepDueDate,
  stopSequence,
} from "@/lib/sequenceEngine";
import { formatDate } from "@/lib/helpers";
import type { Contact } from "@/lib/types";

export function SequenceCard({
  contact,
  onChange,
}: {
  contact: Contact;
  onChange?: () => void;
}) {
  const { sequences } = useSequences();
  const { update } = useData();
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState(false);

  const seq = findSequence(contact, sequences);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
      onChange?.();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-gold-600/80">
        Sequence
      </h3>

      {!seq ? (
        sequences.length === 0 ? (
          <p className="text-sm text-taupe-500">
            No cadences yet. Create one in Outreach → Sequences, then enroll people here.
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-taupe-500">
              Not in a sequence. Enroll to auto-schedule each follow-up.
            </p>
            <select
              className="input"
              value={pick}
              onChange={(e) => setPick(e.target.value)}
            >
              <option value="">Choose a cadence…</option>
              {sequences.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.steps.length} steps)
                </option>
              ))}
            </select>
            <button
              disabled={!pick || busy}
              onClick={() => run(() => enrollInSequence(update, contact, pick))}
              className="btn-primary w-full text-sm"
            >
              Start sequence
            </button>
          </div>
        )
      ) : (
        <SequenceProgress
          contact={contact}
          seq={seq}
          busy={busy}
          onAdvance={() => run(() => advanceSequence(update, contact, seq))}
          onStop={() => run(() => stopSequence(update, contact.id))}
        />
      )}
    </div>
  );
}

function SequenceProgress({
  contact,
  seq,
  busy,
  onAdvance,
  onStop,
}: {
  contact: Contact;
  seq: ReturnType<typeof findSequence> & {};
  busy: boolean;
  onAdvance: () => void;
  onStop: () => void;
}) {
  if (!seq) return null;
  const step = currentStep(contact, seq);
  const due = stepDueDate(contact, seq);
  const overdueDue = isStepDue(contact, seq);
  const total = seq.steps.length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-semibold">{seq.name}</span>
        <span className="text-xs text-taupe-400">
          Step {Math.min(contact.sequence_step + 1, total)} of {total}
        </span>
      </div>

      {step ? (
        <div className="rounded-xl bg-night-900/[0.03] p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-taupe-500">
            Next: Day {step.day} · {step.channel}
          </div>
          <div className="mt-0.5 text-sm font-medium text-night-900">{step.label}</div>
          {due && (
            <div
              className={`mt-1 text-xs ${
                overdueDue ? "font-medium text-rose-600" : "text-taupe-500"
              }`}
            >
              {overdueDue ? "Due now · " : "Scheduled "}
              {formatDate(due)}
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-sage-600">All steps done 🎉</p>
      )}

      <div className="flex flex-wrap gap-2">
        {step && (
          <button onClick={onAdvance} disabled={busy} className="btn-primary text-sm">
            ✓ Log step &amp; next
          </button>
        )}
        <button onClick={onStop} disabled={busy} className="btn-ghost text-sm">
          Stop
        </button>
      </div>
    </div>
  );
}
