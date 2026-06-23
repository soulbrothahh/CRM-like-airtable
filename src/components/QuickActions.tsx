"use client";

import { useState } from "react";
import { useData } from "./DataProvider";
import { createInteraction } from "@/lib/data";
import { todayISO } from "@/lib/helpers";
import type { Contact } from "@/lib/types";

// Compact quick-action buttons for a contact. Used in the table and detail page.
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

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
      onChange?.();
    } finally {
      setBusy(false);
    }
  }

  function plusDays(n: number): string {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
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

  const addFollowUp = () =>
    run(async () => {
      const input = window.prompt(
        "Follow-up date (YYYY-MM-DD):",
        contact.next_follow_up_date || plusDays(7)
      );
      if (!input) return;
      await update(contact.id, {
        next_follow_up_date: input,
        status:
          contact.status === "New Lead" ? "Needs Follow-Up" : contact.status,
      });
    });

  const addNote = () =>
    run(async () => {
      const text = window.prompt("Quick note / interaction:");
      if (!text) return;
      await createInteraction({
        contact_id: contact.id,
        date: todayISO(),
        type: "Texted",
        notes: text,
        next_action: "",
      });
      await update(contact.id, { last_contacted_date: todayISO() });
    });

  const cls = compact ? "btn-subtle px-2 py-1 text-xs" : "btn-ghost text-xs";

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button disabled={busy} onClick={approve} className={cls} title="Approve for bottles">
        ✅ Approve
      </button>
      <button disabled={busy} onClick={markSent} className={cls} title="Mark bottle sent">
        📦 Sent
      </button>
      <button disabled={busy} onClick={addFollowUp} className={cls} title="Add follow-up">
        🔔 Follow-up
      </button>
      <button disabled={busy} onClick={addNote} className={cls} title="Add note">
        📝 Note
      </button>
    </div>
  );
}
