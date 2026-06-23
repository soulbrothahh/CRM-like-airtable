"use client";

import { useMemo, useState } from "react";
import { useData } from "@/components/DataProvider";
import { PageHeader } from "@/components/PageHeader";
import { ContactTable } from "@/components/ContactTable";
import { ContactCard } from "@/components/ContactCard";
import { ContactForm } from "@/components/ContactForm";
import { Modal } from "@/components/Modal";
import { VIEWS, searchContact } from "@/lib/views";
import { CONTACT_TYPES, STATUSES, BOTTLE_PRIORITIES } from "@/lib/constants";
import type { NewContact } from "@/lib/types";

export default function ContactsPage() {
  const { contacts, loading, create } = useData();
  const [view, setView] = useState("all");
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"table" | "card">("card");
  const [adding, setAdding] = useState(false);

  // filter chips
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [priorityFilter, setPriorityFilter] = useState<string>("");
  const [sentFilter, setSentFilter] = useState<string>(""); // "yes" | "no" | ""

  const activeView = VIEWS.find((v) => v.id === view) ?? VIEWS[0];

  const filtered = useMemo(() => {
    return contacts.filter((c) => {
      if (!activeView.predicate(c)) return false;
      if (!searchContact(c, query)) return false;
      if (typeFilter && c.contact_type !== typeFilter) return false;
      if (statusFilter && c.status !== statusFilter) return false;
      if (priorityFilter && c.bottle_priority !== priorityFilter) return false;
      if (sentFilter === "yes" && !["Sent", "Delivered", "Followed up"].includes(c.bottle_status))
        return false;
      if (sentFilter === "no" && ["Sent", "Delivered", "Followed up"].includes(c.bottle_status))
        return false;
      return true;
    });
  }, [contacts, activeView, query, typeFilter, statusFilter, priorityFilter, sentFilter]);

  async function handleCreate(values: NewContact) {
    await create(values);
    setAdding(false);
  }

  const anyFilter = typeFilter || statusFilter || priorityFilter || sentFilter;

  return (
    <div>
      <PageHeader
        title="Contacts"
        subtitle={`${filtered.length} of ${contacts.length} shown`}
        action={
          <button onClick={() => setAdding(true)} className="btn-primary">
            + Add
          </button>
        }
      />

      <div className="space-y-4 px-4 py-4 sm:px-6">
        {/* Search */}
        <input
          className="input"
          placeholder="Search name, handle, city, status, notes…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        {/* Views */}
        <div className="-mx-1 flex gap-1.5 overflow-x-auto pb-1">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition ${
                view === v.id
                  ? "bg-kava-500 text-ink-950 ring-kava-400"
                  : "bg-white/5 text-slate-300 ring-white/10 hover:bg-white/10"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>

        {/* Filters + mode toggle */}
        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect value={typeFilter} onChange={setTypeFilter} placeholder="All types" options={CONTACT_TYPES} />
          <FilterSelect value={statusFilter} onChange={setStatusFilter} placeholder="All statuses" options={STATUSES} />
          <FilterSelect value={priorityFilter} onChange={setPriorityFilter} placeholder="Any priority" options={BOTTLE_PRIORITIES} />
          <FilterSelect value={sentFilter} onChange={setSentFilter} placeholder="Sent?" options={["yes", "no"]} labels={{ yes: "Bottle sent", no: "Not sent" }} />
          {anyFilter && (
            <button
              onClick={() => {
                setTypeFilter("");
                setStatusFilter("");
                setPriorityFilter("");
                setSentFilter("");
              }}
              className="btn-subtle text-xs"
            >
              Clear filters
            </button>
          )}
          <div className="ml-auto flex rounded-xl bg-white/5 p-0.5 ring-1 ring-white/10">
            <button
              onClick={() => setMode("card")}
              className={`rounded-lg px-3 py-1 text-xs font-medium ${
                mode === "card" ? "bg-kava-500 text-ink-950" : "text-slate-300"
              }`}
            >
              Cards
            </button>
            <button
              onClick={() => setMode("table")}
              className={`rounded-lg px-3 py-1 text-xs font-medium ${
                mode === "table" ? "bg-kava-500 text-ink-950" : "text-slate-300"
              }`}
            >
              Table
            </button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="py-20 text-center text-slate-500">Loading…</div>
        ) : mode === "table" ? (
          <ContactTable contacts={filtered} />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((c) => (
              <ContactCard key={c.id} contact={c} />
            ))}
            {filtered.length === 0 && (
              <div className="col-span-full py-20 text-center text-slate-500">
                No contacts match this view.
              </div>
            )}
          </div>
        )}
      </div>

      <Modal open={adding} onClose={() => setAdding(false)} title="Add contact" wide>
        <ContactForm onSubmit={handleCreate} onCancel={() => setAdding(false)} />
      </Modal>
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  placeholder,
  options,
  labels,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: readonly string[];
  labels?: Record<string, string>;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`rounded-xl px-3 py-1.5 text-xs ring-1 ring-white/10 focus:outline-none ${
        value ? "bg-kava-500/15 text-kava-200" : "bg-white/5 text-slate-300"
      }`}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {labels?.[o] ?? o}
        </option>
      ))}
    </select>
  );
}
