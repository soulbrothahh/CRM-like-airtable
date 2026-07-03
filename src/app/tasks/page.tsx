"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useData } from "@/components/DataProvider";
import { useDeals } from "@/components/DealsProvider";
import { useSequences } from "@/components/SequencesProvider";
import { useTasks } from "@/components/TasksProvider";
import { PageHeader } from "@/components/PageHeader";
import {
  advanceSequence,
  currentStep,
  findSequence,
  isStepDue,
} from "@/lib/sequenceEngine";
import { addDays, formatDate, initials, isOverdue, todayISO } from "@/lib/helpers";
import type { Contact, Task } from "@/lib/types";

export default function TasksPage() {
  const { tasks, loading, create, update: updateTask, remove } = useTasks();
  const { contacts, update: updateContact } = useData();
  const { deals, update: updateDeal } = useDeals();
  const { sequences } = useSequences();
  const [showDone, setShowDone] = useState(false);

  const today = todayISO();
  const weekOut = addDays(today, 7);

  const open = useMemo(
    () =>
      tasks
        .filter((t) => !t.done)
        .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999")),
    [tasks]
  );
  const dueNow = open.filter((t) => t.due_date && t.due_date <= today);
  const upcoming = open.filter((t) => !t.due_date || (t.due_date > today && t.due_date <= weekOut));
  const later = open.filter((t) => t.due_date && t.due_date > weekOut);
  const done = useMemo(
    () => tasks.filter((t) => t.done).sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
    [tasks]
  );

  const followUpsDue = useMemo(
    () =>
      contacts
        .filter(
          (c) =>
            c.outreach_status !== "Closed" &&
            c.next_follow_up_date !== null &&
            c.next_follow_up_date <= today
        )
        .sort((a, b) => (a.next_follow_up_date ?? "").localeCompare(b.next_follow_up_date ?? "")),
    [contacts, today]
  );

  const stepsDue = useMemo(
    () =>
      contacts
        .map((c) => {
          const seq = findSequence(c, sequences);
          if (!seq || !isStepDue(c, seq)) return null;
          return { contact: c, seq };
        })
        .filter((x): x is { contact: Contact; seq: (typeof sequences)[number] } => x !== null),
    [contacts, sequences]
  );

  const dealStepsDue = useMemo(
    () =>
      deals
        .filter(
          (d) =>
            d.stage !== "Won" &&
            d.stage !== "Lost" &&
            d.next_step_date !== null &&
            d.next_step_date <= today
        )
        .sort((a, b) => (a.next_step_date ?? "").localeCompare(b.next_step_date ?? "")),
    [deals, today]
  );

  const totalDue = dueNow.length + followUpsDue.length + stepsDue.length + dealStepsDue.length;

  return (
    <div>
      <PageHeader
        title="Today"
        subtitle={
          totalDue === 0
            ? "Nothing due — enjoy the calm 🌴"
            : `${totalDue} thing${totalDue === 1 ? "" : "s"} need${totalDue === 1 ? "s" : ""} you today`
        }
      />

      <div className="mx-auto max-w-3xl space-y-6 px-4 py-5 sm:px-6">
        <QuickAddTask contacts={contacts} onAdd={create} />

        {loading ? (
          <div className="py-16 text-center text-taupe-400">Loading…</div>
        ) : (
          <>
            <TaskSection
              title="📌 Tasks due"
              hint="Overdue and due today"
              empty="No tasks due. Add one above."
              tasks={dueNow}
              contacts={contacts}
              onToggle={(t) => updateTask(t.id, { done: !t.done })}
              onDelete={(t) => remove(t.id)}
            />

            {followUpsDue.length > 0 && (
              <section>
                <SectionHead title="🔔 Follow-ups due" hint="From your outreach loop" />
                <div className="card divide-y divide-night-900/10">
                  {followUpsDue.map((c) => (
                    <div key={c.id} className="flex items-center gap-3 p-3">
                      <Avatar name={c.name} />
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/contacts/${c.id}`}
                          className="block truncate font-semibold hover:text-gold-600"
                        >
                          {c.name}
                        </Link>
                        <span
                          className={`text-xs ${
                            isOverdue(c.next_follow_up_date)
                              ? "font-medium text-rose-600"
                              : "text-taupe-400"
                          }`}
                        >
                          {formatDate(c.next_follow_up_date)}
                          {isOverdue(c.next_follow_up_date) ? " · overdue" : ""}
                        </span>
                      </div>
                      <div className="flex shrink-0 gap-1.5">
                        <button
                          onClick={() =>
                            updateContact(c.id, { next_follow_up_date: addDays(today, 3) })
                          }
                          className="btn-subtle px-2 py-1 text-xs"
                        >
                          +3d
                        </button>
                        <button
                          onClick={() => updateContact(c.id, { next_follow_up_date: null })}
                          className="btn-subtle px-2 py-1 text-xs"
                        >
                          ✓ Done
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {stepsDue.length > 0 && (
              <section>
                <SectionHead title="📋 Sequence steps due" hint="From your cadences" />
                <div className="card divide-y divide-night-900/10">
                  {stepsDue.map(({ contact: c, seq }) => {
                    const step = currentStep(c, seq);
                    return (
                      <div key={c.id} className="flex items-center gap-3 p-3">
                        <Avatar name={c.name} />
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/contacts/${c.id}`}
                            className="block truncate font-semibold hover:text-gold-600"
                          >
                            {c.name}
                          </Link>
                          <span className="block truncate text-xs text-taupe-400">
                            {seq.name}
                            {step ? ` · Day ${step.day} ${step.channel}: ${step.label}` : ""}
                          </span>
                        </div>
                        <button
                          onClick={() => advanceSequence(updateContact, c, seq)}
                          className="btn-primary shrink-0 px-2.5 py-1 text-xs"
                        >
                          ✓ Log &amp; next
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {dealStepsDue.length > 0 && (
              <section>
                <SectionHead title="🤝 Deal next steps due" hint="From your pipeline" />
                <div className="card divide-y divide-night-900/10">
                  {dealStepsDue.map((d) => (
                    <div key={d.id} className="flex items-center gap-3 p-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sage-500/15 text-base">
                        🤝
                      </span>
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/deals/${d.id}`}
                          className="block truncate font-semibold hover:text-gold-600"
                        >
                          {d.title}
                        </Link>
                        <span className="block truncate text-xs text-taupe-400">
                          {d.next_step || "Next step"} ·{" "}
                          <span
                            className={
                              isOverdue(d.next_step_date) ? "font-medium text-rose-600" : ""
                            }
                          >
                            {formatDate(d.next_step_date)}
                          </span>
                        </span>
                      </div>
                      <button
                        onClick={() => updateDeal(d.id, { next_step: "", next_step_date: null })}
                        className="btn-subtle shrink-0 px-2 py-1 text-xs"
                      >
                        ✓ Done
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <TaskSection
              title="🗓️ Coming up"
              hint="Next 7 days + undated"
              empty="Nothing scheduled ahead."
              tasks={upcoming}
              contacts={contacts}
              onToggle={(t) => updateTask(t.id, { done: !t.done })}
              onDelete={(t) => remove(t.id)}
            />

            {later.length > 0 && (
              <TaskSection
                title="🌅 Later"
                hint="Beyond next week"
                empty=""
                tasks={later}
                contacts={contacts}
                onToggle={(t) => updateTask(t.id, { done: !t.done })}
                onDelete={(t) => remove(t.id)}
              />
            )}

            {done.length > 0 && (
              <section>
                <button
                  onClick={() => setShowDone((s) => !s)}
                  className="btn-subtle text-xs"
                >
                  {showDone ? "Hide" : "Show"} completed ({done.length})
                </button>
                {showDone && (
                  <div className="card mt-2 divide-y divide-night-900/10">
                    {done.slice(0, 20).map((t) => (
                      <TaskRow
                        key={t.id}
                        task={t}
                        contacts={contacts}
                        onToggle={() => updateTask(t.id, { done: false })}
                        onDelete={() => remove(t.id)}
                      />
                    ))}
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------ pieces ------------------------------ */

function SectionHead({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="mb-2 flex items-baseline justify-between">
      <h2 className="text-base font-semibold">{title}</h2>
      <span className="text-xs text-taupe-400">{hint}</span>
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-gold-300/80 to-gold-600 text-xs font-bold text-night-900">
      {initials(name)}
    </span>
  );
}

function QuickAddTask({
  contacts,
  onAdd,
}: {
  contacts: Contact[];
  onAdd: (t: {
    title: string;
    notes: string;
    due_date: string | null;
    done: boolean;
    contact_id: string | null;
    deal_id: string | null;
  }) => Promise<unknown>;
}) {
  const [title, setTitle] = useState("");
  const [due, setDue] = useState(todayISO());
  const [contactId, setContactId] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onAdd({
        title: title.trim(),
        notes: "",
        due_date: due || null,
        done: false,
        contact_id: contactId || null,
        deal_id: null,
      });
      setTitle("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-2 p-3">
      <input
        className="input"
        placeholder="Add a task… e.g. Drop bottles at the kalapu"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <div className="flex gap-2">
        <input
          type="date"
          className="input"
          value={due}
          onChange={(e) => setDue(e.target.value)}
        />
        <select
          className="input"
          value={contactId}
          onChange={(e) => setContactId(e.target.value)}
        >
          <option value="">No contact</option>
          {contacts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button disabled={saving || !title.trim()} className="btn-primary shrink-0">
          {saving ? "…" : "+ Add"}
        </button>
      </div>
    </form>
  );
}

function TaskSection({
  title,
  hint,
  empty,
  tasks,
  contacts,
  onToggle,
  onDelete,
}: {
  title: string;
  hint: string;
  empty: string;
  tasks: Task[];
  contacts: Contact[];
  onToggle: (t: Task) => void;
  onDelete: (t: Task) => void;
}) {
  if (tasks.length === 0 && !empty) return null;
  return (
    <section>
      <SectionHead title={title} hint={hint} />
      <div className="card divide-y divide-night-900/10">
        {tasks.length === 0 ? (
          <div className="p-5 text-sm text-taupe-400">{empty}</div>
        ) : (
          tasks.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              contacts={contacts}
              onToggle={() => onToggle(t)}
              onDelete={() => onDelete(t)}
            />
          ))
        )}
      </div>
    </section>
  );
}

function TaskRow({
  task,
  contacts,
  onToggle,
  onDelete,
}: {
  task: Task;
  contacts: Contact[];
  onToggle: () => void;
  onDelete: () => void;
}) {
  const contact = task.contact_id
    ? contacts.find((c) => c.id === task.contact_id)
    : null;
  const overdue = !task.done && isOverdue(task.due_date);

  return (
    <div className="flex items-center gap-3 p-3">
      <button
        onClick={onToggle}
        aria-label={task.done ? "Mark as not done" : "Mark as done"}
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ring-1 transition ${
          task.done
            ? "bg-sage-500 text-cream-100 ring-sage-500"
            : "ring-night-900/20 hover:ring-gold-500"
        }`}
      >
        {task.done ? "✓" : ""}
      </button>
      <div className="min-w-0 flex-1">
        <div
          className={`truncate text-sm font-medium ${
            task.done ? "text-taupe-400 line-through" : "text-night-900"
          }`}
        >
          {task.title}
        </div>
        <div className="flex flex-wrap items-center gap-x-2 text-xs text-taupe-400">
          {task.due_date && (
            <span className={overdue ? "font-medium text-rose-600" : ""}>
              {formatDate(task.due_date)}
              {overdue ? " · overdue" : ""}
            </span>
          )}
          {contact && (
            <Link href={`/contacts/${contact.id}`} className="text-gold-600 hover:underline">
              {contact.name}
            </Link>
          )}
        </div>
      </div>
      <button
        onClick={onDelete}
        aria-label="Delete task"
        className="shrink-0 px-1 text-taupe-400 hover:text-rose-600"
      >
        ✕
      </button>
    </div>
  );
}
