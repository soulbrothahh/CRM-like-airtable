"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useData } from "@/components/DataProvider";
import { useDeals } from "@/components/DealsProvider";
import { useSequences } from "@/components/SequencesProvider";
import { PageHeader } from "@/components/PageHeader";
import { OutreachStatusBadge } from "@/components/Badge";
import { SequencesManager } from "@/components/SequencesManager";
import { createInteraction } from "@/lib/data";
import {
  advanceSequence,
  currentStep,
  findSequence,
  isStepDue,
} from "@/lib/sequenceEngine";
import { formatDate, initials, isOverdue, todayISO } from "@/lib/helpers";
import {
  OUTREACH_TEMPLATES,
  fillTemplate,
  type OutreachCategory,
  type OutreachVars,
} from "@/lib/outreach";
import type { Contact, InteractionType } from "@/lib/types";

function plusDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const then = new Date(dateStr + "T00:00:00").getTime();
  const now = new Date(todayISO() + "T00:00:00").getTime();
  return Math.round((now - then) / 86400000);
}

export default function OutreachPage() {
  const { contacts, update } = useData();
  const { deals } = useDeals();
  const [tab, setTab] = useState<"compose" | "pipeline" | "sequences">("compose");

  return (
    <div>
      <PageHeader
        title="Outreach"
        subtitle="Send, track, and follow up — never lose a thread"
        action={
          <div className="flex rounded-full bg-night-900/[0.04] p-0.5 ring-1 ring-night-900/10">
            <button
              onClick={() => setTab("compose")}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${
                tab === "compose" ? "bg-night-900 text-cream-100" : "text-taupe-600"
              }`}
            >
              Compose
            </button>
            <button
              onClick={() => setTab("pipeline")}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${
                tab === "pipeline" ? "bg-night-900 text-cream-100" : "text-taupe-600"
              }`}
            >
              Pipeline
            </button>
            <button
              onClick={() => setTab("sequences")}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${
                tab === "sequences" ? "bg-night-900 text-cream-100" : "text-taupe-600"
              }`}
            >
              Sequences
            </button>
          </div>
        }
      />

      {tab === "compose" ? (
        <Compose contacts={contacts} deals={deals} update={update} />
      ) : tab === "pipeline" ? (
        <Pipeline contacts={contacts} update={update} />
      ) : (
        <SequencesManager />
      )}
    </div>
  );
}

/* ------------------------------- Compose ------------------------------- */

function Compose({
  contacts,
  deals,
  update,
}: {
  contacts: Contact[];
  deals: ReturnType<typeof useDeals>["deals"];
  update: ReturnType<typeof useData>["update"];
}) {
  const [category, setCategory] = useState<OutreachCategory>("B2B");
  const [recipientKey, setRecipientKey] = useState("");
  const [sender, setSender] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [logged, setLogged] = useState("");

  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);
  const [goal, setGoal] = useState("");
  const [generating, setGenerating] = useState(false);
  const [aiError, setAiError] = useState("");

  useEffect(() => {
    fetch("/api/outreach")
      .then((r) => r.json())
      .then((d) => setAiAvailable(Boolean(d.configured)))
      .catch(() => setAiAvailable(false));
  }, []);

  const templates = useMemo(
    () => OUTREACH_TEMPLATES.filter((t) => t.category === category),
    [category]
  );

  // resolve the actual contact this message is going to (for logging)
  const targetContact = useMemo<Contact | null>(() => {
    if (!recipientKey) return null;
    const [kind, id] = recipientKey.split(":");
    if (kind === "contact") return contacts.find((c) => c.id === id) ?? null;
    if (kind === "deal") {
      const d = deals.find((x) => x.id === id);
      return contacts.find((c) => c.id === d?.contact_id) ?? null;
    }
    return null;
  }, [recipientKey, contacts, deals]);

  const vars: OutreachVars = useMemo(() => {
    if (!recipientKey) return { sender };
    const [kind, id] = recipientKey.split(":");
    if (kind === "contact") {
      const c = contacts.find((x) => x.id === id);
      if (c)
        return { name: c.name, company: "", handle: c.instagram || c.tiktok, city: c.city, sender };
    } else if (kind === "deal") {
      const d = deals.find((x) => x.id === id);
      if (d) {
        const linked = contacts.find((c) => c.id === d.contact_id);
        return {
          name: linked?.name || d.company,
          company: d.company,
          handle: linked?.instagram || "",
          city: linked?.city || "",
          sender,
        };
      }
    }
    return { sender };
  }, [recipientKey, contacts, deals, sender]);

  const channel = OUTREACH_TEMPLATES.find((x) => x.id === templateId)?.channel ?? "DM";

  function applyTemplate(id: string) {
    setTemplateId(id);
    const t = OUTREACH_TEMPLATES.find((x) => x.id === id);
    if (!t) return;
    const subject = t.subject ? `Subject: ${fillTemplate(t.subject, vars)}\n\n` : "";
    setMessage(subject + fillTemplate(t.body, vars));
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  async function logSent() {
    if (!targetContact || !message.trim()) return;
    const interactionType: InteractionType =
      channel === "Email" ? "Texted" : channel === "Text" ? "Texted" : "DM'd";
    await createInteraction({
      contact_id: targetContact.id,
      date: todayISO(),
      type: interactionType,
      direction: "outbound",
      notes: message.trim(),
      next_action: "Awaiting reply",
    });
    await update(targetContact.id, {
      last_contacted_date: todayISO(),
      outreach_status: "Awaiting reply",
      next_follow_up_date: plusDays(3),
      status: targetContact.status === "New Lead" ? "Contacted" : targetContact.status,
    });
    setLogged(`Logged to ${targetContact.name} · follow-up set for ${formatDate(plusDays(3))}`);
    setTimeout(() => setLogged(""), 4000);
  }

  async function generateAI() {
    setGenerating(true);
    setAiError("");
    try {
      const t = OUTREACH_TEMPLATES.find((x) => x.id === templateId);
      const recipientKind = recipientKey.split(":")[0];
      const res = await fetch("/api/outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          channel: t?.channel || (category === "Ambassador" ? "DM" : "Email"),
          goal,
          sender: sender || undefined,
          recipient: {
            name: vars.name,
            company: vars.company,
            handle: vars.handle,
            city: vars.city,
            contact_type: recipientKind,
          },
        }),
      });
      const data = await res.json();
      if (data.message) setMessage(data.message);
      else if (data.configured === false)
        setAiError("AI isn't configured yet — add ANTHROPIC_API_KEY to enable it.");
      else setAiError(data.error || "Could not generate.");
    } catch (e) {
      setAiError((e as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 px-4 py-4 sm:px-6 lg:grid-cols-3">
      {/* Left: controls */}
      <div className="space-y-4 lg:col-span-1">
        <div className="card p-4">
          <div className="mb-3 flex rounded-xl bg-night-900/[0.03] p-0.5 ring-1 ring-night-900/10">
            {(["B2B", "Ambassador"] as OutreachCategory[]).map((c) => (
              <button
                key={c}
                onClick={() => {
                  setCategory(c);
                  setTemplateId("");
                }}
                className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium ${
                  category === c ? "bg-gold-400 text-night-900" : "text-taupe-600"
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          <label className="label">Recipient</label>
          <select
            className="input mb-3"
            value={recipientKey}
            onChange={(e) => setRecipientKey(e.target.value)}
          >
            <option value="">— manual / none —</option>
            <optgroup label="Contacts">
              {contacts.map((c) => (
                <option key={c.id} value={`contact:${c.id}`}>
                  {c.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="Deals">
              {deals.map((d) => (
                <option key={d.id} value={`deal:${d.id}`}>
                  {d.title}
                </option>
              ))}
            </optgroup>
          </select>

          <label className="label">Your name / brand</label>
          <input
            className="input"
            placeholder="e.g. Taylor at NuKava"
            value={sender}
            onChange={(e) => setSender(e.target.value)}
          />
        </div>

        <div className="card p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-gold-600/80">
            Templates
          </h3>
          <div className="space-y-1.5">
            {templates.map((t) => (
              <button
                key={t.id}
                onClick={() => applyTemplate(t.id)}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition ${
                  templateId === t.id
                    ? "bg-gold-400/15 text-gold-700 ring-1 ring-gold-400/30"
                    : "bg-night-900/[0.03] text-night-800 hover:bg-night-900/[0.05]"
                }`}
              >
                <span>{t.label}</span>
                <span className="text-[10px] uppercase tracking-wide text-taupe-400">
                  {t.channel}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="card p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-gold-600/80">
            ✨ AI personalize
          </h3>
          <p className="mb-2 text-xs text-taupe-500">
            {aiAvailable === false
              ? "Optional. Add an ANTHROPIC_API_KEY to draft custom messages with AI."
              : "Describe the goal and let AI draft a tailored message."}
          </p>
          <textarea
            className="input mb-2 min-h-[56px]"
            placeholder="e.g. Re-engage after they went quiet; offer a sample box"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
          />
          <button
            onClick={generateAI}
            disabled={generating || aiAvailable === false}
            className="btn-primary w-full"
          >
            {generating ? "Drafting…" : "Generate with AI"}
          </button>
          {aiError && <p className="mt-2 text-xs text-rose-600">{aiError}</p>}
        </div>
      </div>

      {/* Right: editor */}
      <div className="lg:col-span-2">
        <div className="card flex h-full flex-col p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-gold-600/80">
              Message
            </h3>
            <button onClick={copy} disabled={!message} className="btn-ghost text-xs">
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <textarea
            className="input min-h-[360px] flex-1 font-mono text-sm leading-relaxed"
            placeholder="Pick a template or generate with AI — your message appears here, fully editable."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />

          <div className="mt-3 border-t border-night-900/5 pt-3">
            {targetContact ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-taupe-500">
                  Sending to <span className="font-semibold text-night-800">{targetContact.name}</span>.
                  Logging it records the message and sets a 3-day follow-up.
                </p>
                <button onClick={logSent} disabled={!message.trim()} className="btn-primary text-sm">
                  ✓ Mark as sent
                </button>
              </div>
            ) : (
              <p className="text-xs text-taupe-400">
                Pick a contact above to log this message and track the reply.
              </p>
            )}
            {logged && <p className="mt-2 text-sm font-medium text-sage-600">✓ {logged}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- Pipeline ------------------------------- */

function Pipeline({
  contacts,
  update,
}: {
  contacts: Contact[];
  update: ReturnType<typeof useData>["update"];
}) {
  const { sequences } = useSequences();

  const stepsDue = useMemo(() => {
    return contacts
      .map((c) => {
        const seq = findSequence(c, sequences);
        if (!seq || !isStepDue(c, seq)) return null;
        return { contact: c, seq };
      })
      .filter((x): x is { contact: Contact; seq: (typeof sequences)[number] } => x !== null);
  }, [contacts, sequences]);

  const stats = useMemo(() => {
    const today = todayISO();
    const week = plusDays(-7);
    const contacted = contacts.filter((c) => c.outreach_status !== "Not contacted");
    const replied = contacts.filter((c) => c.outreach_status === "Replied");
    return {
      sentWeek: contacts.filter((c) => c.last_contacted_date && c.last_contacted_date >= week).length,
      awaiting: contacts.filter((c) => c.outreach_status === "Awaiting reply").length,
      replied: replied.length,
      replyRate: contacted.length ? Math.round((replied.length / contacted.length) * 100) : 0,
      followUps: contacts.filter(
        (c) =>
          c.outreach_status !== "Closed" &&
          c.next_follow_up_date !== null &&
          c.next_follow_up_date <= today
      ).length,
    };
  }, [contacts]);

  const awaiting = useMemo(
    () =>
      contacts
        .filter((c) => c.outreach_status === "Awaiting reply")
        .sort((a, b) => (a.last_contacted_date ?? "").localeCompare(b.last_contacted_date ?? "")),
    [contacts]
  );
  const followUps = useMemo(() => {
    const today = todayISO();
    return contacts
      .filter(
        (c) =>
          c.outreach_status !== "Closed" &&
          c.next_follow_up_date !== null &&
          c.next_follow_up_date <= today
      )
      .sort((a, b) => (a.next_follow_up_date ?? "").localeCompare(b.next_follow_up_date ?? ""));
  }, [contacts]);
  const replied = useMemo(
    () => contacts.filter((c) => c.outreach_status === "Replied"),
    [contacts]
  );

  return (
    <div className="space-y-6 px-4 py-4 sm:px-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Messaged (7d)" value={stats.sentWeek} />
        <Stat label="Awaiting reply" value={stats.awaiting} accent />
        <Stat label="Replied" value={stats.replied} />
        <Stat label="Reply rate" value={`${stats.replyRate}%`} />
        <Stat label="Follow-ups due" value={stats.followUps} warn={stats.followUps > 0} />
      </div>

      {stepsDue.length > 0 && (
        <section>
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-base font-semibold">📋 Sequence steps due</h2>
            <span className="text-xs text-taupe-400">From your cadences</span>
          </div>
          <div className="card divide-y divide-night-900/10">
            {stepsDue.map(({ contact: c, seq }) => {
              const step = currentStep(c, seq);
              return (
                <div key={c.id} className="p-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-gold-300/80 to-gold-600 text-xs font-bold text-night-900">
                      {initials(c.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/contacts/${c.id}`}
                        className="block truncate font-semibold hover:text-gold-600"
                      >
                        {c.name}
                      </Link>
                      <div className="truncate text-xs text-taupe-400">
                        {seq.name}
                        {step ? ` · Day ${step.day} ${step.channel}: ${step.label}` : ""}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 pl-12">
                    <button
                      onClick={() => advanceSequence(update, c, seq)}
                      className="btn-primary px-2.5 py-1 text-xs"
                    >
                      ✓ Log step &amp; next
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <PipeList
        title="🔔 Follow-ups due"
        hint="Overdue or due today"
        empty="No follow-ups due — you're on top of it."
        rows={followUps}
        update={update}
        meta={(c) => ({
          text: formatDate(c.next_follow_up_date),
          warn: isOverdue(c.next_follow_up_date),
        })}
      />
      <PipeList
        title="⏳ Awaiting reply"
        hint="Longest waiting first"
        empty="Nobody's waiting on a reply."
        rows={awaiting}
        update={update}
        meta={(c) => {
          const d = daysSince(c.last_contacted_date);
          return { text: d === null ? "" : d === 0 ? "today" : `${d}d waiting` };
        }}
      />
      <PipeList
        title="💬 Replied — your move"
        hint="They responded"
        empty="No open replies."
        rows={replied}
        update={update}
        meta={() => ({ text: "" })}
      />
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
  value: number | string;
  accent?: boolean;
  warn?: boolean;
}) {
  return (
    <div className="card p-4">
      <div
        className={`text-2xl font-bold ${
          warn ? "text-rose-600" : accent ? "text-gold-600" : "text-night-900"
        }`}
      >
        {value}
      </div>
      <div className="mt-1 text-xs text-taupe-500">{label}</div>
    </div>
  );
}

function PipeList({
  title,
  hint,
  empty,
  rows,
  meta,
  update,
}: {
  title: string;
  hint: string;
  empty: string;
  rows: Contact[];
  meta: (c: Contact) => { text: string; warn?: boolean };
  update: ReturnType<typeof useData>["update"];
}) {
  function markReplied(c: Contact) {
    update(c.id, { outreach_status: "Replied", next_follow_up_date: null });
  }
  function bump(c: Contact) {
    update(c.id, { outreach_status: "Following up", next_follow_up_date: plusDays(3) });
  }

  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-base font-semibold">{title}</h2>
        <span className="text-xs text-taupe-400">{hint}</span>
      </div>
      <div className="card divide-y divide-night-900/10">
        {rows.length === 0 ? (
          <div className="p-5 text-sm text-taupe-400">{empty}</div>
        ) : (
          rows.map((c) => {
            const m = meta(c);
            return (
              <div key={c.id} className="p-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-gold-300/80 to-gold-600 text-xs font-bold text-night-900">
                    {initials(c.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/contacts/${c.id}`}
                      className="block truncate font-semibold hover:text-gold-600"
                    >
                      {c.name}
                    </Link>
                    <div className="flex items-center gap-2 text-xs text-taupe-400">
                      <OutreachStatusBadge status={c.outreach_status} />
                      {m.text && (
                        <span className={m.warn ? "font-medium text-rose-600" : ""}>{m.text}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5 pl-12">
                  <button onClick={() => markReplied(c)} className="btn-subtle px-2.5 py-1 text-xs">
                    💬 Replied
                  </button>
                  <button onClick={() => bump(c)} className="btn-subtle px-2.5 py-1 text-xs">
                    🔔 Follow up +3d
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
