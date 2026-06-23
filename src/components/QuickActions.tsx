"use client";

import { useState } from "react";
import { useData } from "./DataProvider";
import { Modal } from "./Modal";
import { Select } from "./ContactForm";
import { INTERACTION_TYPES } from "@/lib/constants";
import { createInteraction } from "@/lib/data";
import { formatDate, todayISO } from "@/lib/helpers";
import type { Contact, InteractionType } from "@/lib/types";

function plusDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

// Compact quick-action buttons for a contact. Used in the table, cards and detail page.
export function QuickActions({
  contact,
  onChange,
  compact,
}: {
  contact: Contact;
  onChange?: () => void;
  compact?: boolean;
}) {
  const { update } = useData();
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<null | "followup" | "note">(null);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
      onChange?.();
    } finally {
      setBusy(false);
    }
  }

  const approve = () =>
    run(async () => {
      await update(contact.id, {
        bottle_recipient: true,
        status: "Approved for Bottles",
        bottle_status:
          contact.shipping_address.trim() === "" ? "Need address" : "Ready to send",
        bottle_priority:
          contact.bottle_priority === "Low" ? "Medium" : contact.bottle_priority,
      });
    });

  const markSent = () =>
    run(async () => {
      await update(contact.id, {
        bottle_status: "Sent",
        status: "Bottle Sent",
        date_sent: todayISO(),
        bottle_recipient: true,
      });
      await createInteraction({
        contact_id: contact.id,
        date: todayISO(),
        type: "Sent bottle",
        notes: "Marked bottle as sent.",
        next_action: "Follow up after delivery.",
      });
    });

  const cls = compact ? "btn-subtle px-2 py-1 text-xs" : "btn-ghost text-xs";

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        <button disabled={busy} onClick={approve} className={cls} title="Approve for bottles">
          ✅ Approve
        </button>
        <button disabled={busy} onClick={markSent} className={cls} title="Mark bottle sent">
          📦 Sent
        </button>
        <button
          disabled={busy}
          onClick={() => setModal("followup")}
          className={cls}
          title="Add follow-up"
        >
          🔔 Follow-up
        </button>
        <button
          disabled={busy}
          onClick={() => setModal("note")}
          className={cls}
          title="Add note"
        >
          📝 Note
        </button>
      </div>

      <Modal
        open={modal === "followup"}
        onClose={() => setModal(null)}
        title={`Follow-up · ${contact.name}`}
      >
        <FollowUpForm
          contact={contact}
          onDone={() => {
            setModal(null);
            onChange?.();
          }}
        />
      </Modal>

      <Modal
        open={modal === "note"}
        onClose={() => setModal(null)}
        title={`Log interaction · ${contact.name}`}
      >
        <NoteForm
          contact={contact}
          onDone={() => {
            setModal(null);
            onChange?.();
          }}
        />
      </Modal>
    </>
  );
}

const PRESETS: { label: string; days: number }[] = [
  { label: "Today", days: 0 },
  { label: "Tomorrow", days: 1 },
  { label: "In 3 days", days: 3 },
  { label: "Next week", days: 7 },
  { label: "In 2 weeks", days: 14 },
  { label: "In a month", days: 30 },
];

function FollowUpForm({
  contact,
  onDone,
}: {
  contact: Contact;
  onDone: () => void;
}) {
  const { update } = useData();
  const [date, setDate] = useState(contact.next_follow_up_date || plusDays(7));
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await update(contact.id, {
        next_follow_up_date: date,
        status: contact.status === "New Lead" ? "Needs Follow-Up" : contact.status,
      });
      if (note.trim()) {
        await createInteraction({
          contact_id: contact.id,
          date: todayISO(),
          type: "Followed up",
          notes: note.trim(),
          next_action: `Follow up on ${formatDate(date)}`,
        });
      }
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="label">When should you reach out?</label>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => {
            const value = plusDays(p.days);
            const active = value === date;
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => setDate(value)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition ${
                  active
                    ? "bg-gold-400 text-night-900 ring-gold-400"
                    : "bg-night-900/[0.03] text-taupe-600 ring-night-900/10 hover:bg-night-900/[0.05]"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="label">Exact date</label>
        <input
          type="date"
          className="input"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      <div>
        <label className="label">Note (optional)</label>
        <textarea
          className="input min-h-[60px]"
          placeholder="What do you want to follow up about?"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      <div className="flex justify-end gap-2">
        <button onClick={onDone} className="btn-ghost">
          Cancel
        </button>
        <button onClick={save} disabled={saving} className="btn-primary">
          {saving ? "Saving…" : "Set follow-up"}
        </button>
      </div>
    </div>
  );
}

function NoteForm({ contact, onDone }: { contact: Contact; onDone: () => void }) {
  const { update } = useData();
  const [type, setType] = useState<InteractionType>("Texted");
  const [date, setDate] = useState(todayISO());
  const [notes, setNotes] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!notes.trim() && !nextAction.trim()) return;
    setSaving(true);
    try {
      await createInteraction({
        contact_id: contact.id,
        date,
        type,
        notes: notes.trim(),
        next_action: nextAction.trim(),
      });
      await update(contact.id, { last_contacted_date: date });
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label">Type</label>
          <Select
            value={type}
            onChange={(v) => setType(v as InteractionType)}
            options={INTERACTION_TYPES}
          />
        </div>
        <div>
          <label className="label">Date</label>
          <input
            type="date"
            className="input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="label">What happened?</label>
        <textarea
          className="input min-h-[80px]"
          placeholder="e.g. Sent product info and pricing over DM."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          autoFocus
        />
      </div>

      <div>
        <label className="label">Next action (optional)</label>
        <input
          className="input"
          placeholder="e.g. Confirm shipping address"
          value={nextAction}
          onChange={(e) => setNextAction(e.target.value)}
        />
      </div>

      <div className="flex justify-end gap-2">
        <button onClick={onDone} className="btn-ghost">
          Cancel
        </button>
        <button
          onClick={save}
          disabled={saving || (!notes.trim() && !nextAction.trim())}
          className="btn-primary"
        >
          {saving ? "Saving…" : "Log it"}
        </button>
      </div>
    </div>
  );
}
