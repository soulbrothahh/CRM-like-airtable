"use client";

import { useEffect, useMemo, useState } from "react";
import { useData } from "@/components/DataProvider";
import { useDeals } from "@/components/DealsProvider";
import { PageHeader } from "@/components/PageHeader";
import {
  OUTREACH_TEMPLATES,
  fillTemplate,
  type OutreachCategory,
  type OutreachVars,
} from "@/lib/outreach";

export default function OutreachPage() {
  const { contacts } = useData();
  const { deals } = useDeals();
  const [category, setCategory] = useState<OutreachCategory>("B2B");
  const [recipientKey, setRecipientKey] = useState("");
  const [sender, setSender] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);

  // AI
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

  const vars: OutreachVars = useMemo(() => {
    if (!recipientKey) return { sender };
    const [kind, id] = recipientKey.split(":");
    if (kind === "contact") {
      const c = contacts.find((x) => x.id === id);
      if (c)
        return {
          name: c.name,
          company: "",
          handle: c.instagram || c.tiktok,
          city: c.city,
          sender,
        };
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
    <div>
      <PageHeader title="Outreach" subtitle="B2B & ambassador messages, ready to send" />

      <div className="grid grid-cols-1 gap-4 px-4 py-4 sm:px-6 lg:grid-cols-3">
        {/* Left: controls */}
        <div className="space-y-4 lg:col-span-1">
          <div className="card p-4">
            <div className="mb-3 flex rounded-xl bg-white/5 p-0.5 ring-1 ring-white/10">
              {(["B2B", "Ambassador"] as OutreachCategory[]).map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    setCategory(c);
                    setTemplateId("");
                  }}
                  className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium ${
                    category === c ? "bg-kava-500 text-ink-950" : "text-slate-300"
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
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-kava-300/80">
              Templates
            </h3>
            <div className="space-y-1.5">
              {templates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => applyTemplate(t.id)}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition ${
                    templateId === t.id
                      ? "bg-kava-500/15 text-kava-200 ring-1 ring-kava-400/30"
                      : "bg-white/5 text-slate-200 hover:bg-white/10"
                  }`}
                >
                  <span>{t.label}</span>
                  <span className="text-[10px] uppercase tracking-wide text-slate-500">
                    {t.channel}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="card p-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-kava-300/80">
              ✨ AI personalize
            </h3>
            <p className="mb-2 text-xs text-slate-400">
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
            {aiError && <p className="mt-2 text-xs text-rose-300">{aiError}</p>}
          </div>
        </div>

        {/* Right: editor */}
        <div className="lg:col-span-2">
          <div className="card flex h-full flex-col p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-kava-300/80">
                Message
              </h3>
              <button onClick={copy} disabled={!message} className="btn-ghost text-xs">
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <textarea
              className="input min-h-[420px] flex-1 font-mono text-sm leading-relaxed"
              placeholder="Pick a template or generate with AI — your message appears here, fully editable."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
