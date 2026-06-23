"use client";

import { createInteraction } from "./data";
import { addDays, todayISO } from "./helpers";
import type {
  Contact,
  InteractionType,
  Sequence,
  SequenceChannel,
  SequenceStep,
} from "./types";

type Updater = (id: string, patch: Partial<Contact>) => Promise<Contact>;

export function findSequence(
  contact: Contact,
  sequences: Sequence[]
): Sequence | null {
  if (!contact.sequence_id) return null;
  return sequences.find((s) => s.id === contact.sequence_id) ?? null;
}

export function currentStep(contact: Contact, seq: Sequence): SequenceStep | null {
  return seq.steps[contact.sequence_step] ?? null;
}

export function stepDueDate(contact: Contact, seq: Sequence): string | null {
  if (!contact.sequence_started) return null;
  const step = seq.steps[contact.sequence_step];
  if (!step) return null;
  return addDays(contact.sequence_started, step.day);
}

export function isStepDue(contact: Contact, seq: Sequence): boolean {
  const d = stepDueDate(contact, seq);
  return d !== null && d <= todayISO();
}

function channelToType(channel: SequenceChannel): InteractionType {
  if (channel === "Call") return "Called";
  if (channel === "DM") return "DM'd";
  return "Texted"; // Email / Text
}

export async function enrollInSequence(
  update: Updater,
  contact: Contact,
  sequenceId: string
): Promise<void> {
  await update(contact.id, {
    sequence_id: sequenceId,
    sequence_step: 0,
    sequence_started: todayISO(),
    outreach_status:
      contact.outreach_status === "Not contacted"
        ? "Messaged"
        : contact.outreach_status,
  });
}

export async function stopSequence(update: Updater, contactId: string): Promise<void> {
  await update(contactId, { sequence_id: null });
}

// Logs the current step as a sent message and advances to the next one,
// scheduling the next step's due date as the follow-up. Completes when done.
export async function advanceSequence(
  update: Updater,
  contact: Contact,
  seq: Sequence
): Promise<void> {
  const step = seq.steps[contact.sequence_step];
  if (step) {
    await createInteraction({
      contact_id: contact.id,
      date: todayISO(),
      type: channelToType(step.channel),
      direction: "outbound",
      notes: step.body?.trim() || `Sequence step: ${step.label}`,
      next_action: "Awaiting reply",
    });
  }
  const nextIdx = contact.sequence_step + 1;
  const started = contact.sequence_started ?? todayISO();
  if (nextIdx < seq.steps.length) {
    await update(contact.id, {
      sequence_step: nextIdx,
      last_contacted_date: todayISO(),
      outreach_status: "Awaiting reply",
      next_follow_up_date: addDays(started, seq.steps[nextIdx].day),
    });
  } else {
    // finished the cadence
    await update(contact.id, {
      sequence_id: null,
      last_contacted_date: todayISO(),
      outreach_status: "Awaiting reply",
    });
  }
}
