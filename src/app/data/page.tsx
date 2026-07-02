"use client";

import { useRef, useState } from "react";
import { useData } from "@/components/DataProvider";
import { PageHeader } from "@/components/PageHeader";
import { importContacts, getAllForBackup } from "@/lib/data";
import {
  backupJson,
  contactsToCsv,
  csvToContacts,
  download,
} from "@/lib/csv";
import { todayISO } from "@/lib/helpers";

export default function DataPage() {
  const { contacts, storageMode, reload } = useData();
  const [message, setMessage] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function exportCsv() {
    download(`nukava-contacts-${todayISO()}.csv`, contactsToCsv(contacts), "text/csv");
  }

  async function exportJson() {
    const all = await getAllForBackup();
    download(
      `nukava-backup-${todayISO()}.json`,
      backupJson(all.contacts, all.interactions),
      "application/json"
    );
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      let imported = 0;
      if (file.name.endsWith(".json")) {
        const parsed = JSON.parse(text);
        const list = Array.isArray(parsed) ? parsed : parsed.contacts ?? [];
        await importContacts(list);
        imported = list.length;
      } else {
        const parsed = csvToContacts(text);
        await importContacts(parsed);
        imported = parsed.length;
      }
      await reload();
      setMessage(`✅ Imported ${imported} contact(s).`);
    } catch (err) {
      setMessage(`⚠️ Could not import: ${(err as Error).message}`);
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div>
      <PageHeader title="Import / Export" subtitle="Move your data in and out" />

      <div className="max-w-2xl space-y-4 px-4 py-5 sm:px-6">
        <div
          className={`card p-4 text-sm ${
            storageMode === "cloud" ? "ring-sage-500/20" : "ring-gold-400/20"
          }`}
        >
          <div className="font-semibold">
            {storageMode === "cloud" ? "☁️ Cloud sync is ON" : "📱 On-device mode"}
          </div>
          <p className="mt-1 text-taupe-500">
            {storageMode === "cloud"
              ? "Your data lives in Supabase and syncs across every device you log in from."
              : "Your data is stored privately in this browser. Add Supabase keys (see README) to sync across devices. Use Export below to back up or move your data."}
          </p>
        </div>

        <Card title="Export">
          <p className="mb-3 text-sm text-taupe-500">
            Download your contacts as a spreadsheet, or a full JSON backup
            (contacts + interactions).
          </p>
          <div className="flex flex-wrap gap-2">
            <button onClick={exportCsv} className="btn-primary">
              ⬇ Export CSV
            </button>
            <button onClick={exportJson} className="btn-ghost">
              ⬇ Full JSON backup
            </button>
          </div>
        </Card>

        <Card title="Import">
          <p className="mb-3 text-sm text-taupe-500">
            Upload a CSV (e.g. a creator list) or a JSON backup. CSV headers like
            <span className="text-night-800"> name, email, instagram, phone, city, followers </span>
            are matched automatically. Existing contacts with the same ID are updated.
          </p>
          <button onClick={() => fileRef.current?.click()} className="btn-ghost">
            ⬆ Choose CSV or JSON file
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.json"
            onChange={onFile}
            className="hidden"
          />
          {message && <p className="mt-3 text-sm text-taupe-600">{message}</p>}
        </Card>

        <Card title="🤖 Agent access (MCP)">
          <p className="mb-2 text-sm text-taupe-500">
            AI agents (Claude Code, claude.ai) can work this CRM directly — triage
            hot leads, log outreach, advance sequences, update deals — via the
            built-in MCP server.
          </p>
          <ol className="mb-3 space-y-1 text-sm text-taupe-600">
            <li>
              1. In Vercel, set <code className="rounded bg-night-900/[0.05] px-1">MCP_API_KEY</code>{" "}
              to a long random string (this is the agent password — keep it secret).
            </li>
            <li>2. Connect from Claude Code:</li>
          </ol>
          <pre className="overflow-x-auto rounded-xl bg-night-900 p-3 text-xs leading-relaxed text-cream-100">
{`claude mcp add --transport http nukava \\
  ${typeof window !== "undefined" ? window.location.origin : "https://nukava.vercel.app"}/api/mcp \\
  --header "Authorization: Bearer YOUR_MCP_API_KEY"`}
          </pre>
          <p className="mt-2 text-xs text-taupe-400">
            12 tools: overview, search/get/create/update contacts, log interactions
            &amp; signals, follow-ups due, deals, sequences &amp; enrollment.
          </p>
        </Card>

        <Card title="CSV template">
          <p className="mb-2 text-sm text-taupe-500">
            A minimal CSV just needs a <span className="text-night-800">name</span> column.
            Common extras:
          </p>
          <pre className="overflow-x-auto rounded-xl bg-cream-50 p-3 text-xs text-taupe-600">
{`name,instagram,phone,email,city,state,contact_type,followers,notes
Jane Doe,@janedoe,555-0100,jane@x.com,Austin,TX,Creator,42000,Met at expo`}
          </pre>
        </Card>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-4">
      <h2 className="mb-1 text-base font-semibold">{title}</h2>
      {children}
    </div>
  );
}
