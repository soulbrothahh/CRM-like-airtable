"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useData } from "@/components/DataProvider";
import { PageHeader } from "@/components/PageHeader";
import { ContactTable } from "@/components/ContactTable";
import { ContactCard } from "@/components/ContactCard";
import { ContactForm } from "@/components/ContactForm";
import { Modal } from "@/components/Modal";
import { VIEWS, searchContact } from "@/lib/views";
import { CONTACT_TYPES, STATUSES, BOTTLE_PRIORITIES } from "@/lib/constants";
import { initials } from "@/lib/helpers";
import type { Contact, NewContact } from "@/lib/types";

export default function ContactsPage() {
  const { contacts, loading, create } = useData();
  const [view, setView] = useState("all");
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"table" | "card" | "cities">("card");
  const [adding, setAdding] = useState(false);

  // filter chips
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [priorityFilter, setPriorityFilter] = useState<string>("");
  const [sentFilter, setSentFilter] = useState<string>(""); // "yes" | "no" | ""
  const [tagFilter, setTagFilter] = useState<string>("");

  const activeView = VIEWS.find((v) => v.id === view) ?? VIEWS[0];

  const allTags = useMemo(() => {
    const set = new Set<string>();
    contacts.forEach((c) => c.tags?.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [contacts]);

  const filtered = useMemo(() => {
    return contacts.filter((c) => {
      if (!activeView.predicate(c)) return false;
      if (!searchContact(c, query)) return false;
      if (typeFilter && c.contact_type !== typeFilter) return false;
      if (statusFilter && c.status !== statusFilter) return false;
      if (priorityFilter && c.bottle_priority !== priorityFilter) return false;
      if (tagFilter && !(c.tags ?? []).includes(tagFilter)) return false;
      if (sentFilter === "yes" && !["Sent", "Delivered", "Followed up"].includes(c.bottle_status))
        return false;
      if (sentFilter === "no" && ["Sent", "Delivered", "Followed up"].includes(c.bottle_status))
        return false;
      return true;
    });
  }, [contacts, activeView, query, typeFilter, statusFilter, priorityFilter, tagFilter, sentFilter]);

  async function handleCreate(values: NewContact) {
    await create(values);
    setAdding(false);
  }

  const anyFilter = typeFilter || statusFilter || priorityFilter || sentFilter || tagFilter;

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
                  ? "bg-gold-400 text-night-900 ring-gold-400"
                  : "bg-night-900/[0.03] text-taupe-600 ring-night-900/10 hover:bg-night-900/[0.05]"
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
          {allTags.length > 0 && (
            <FilterSelect value={tagFilter} onChange={setTagFilter} placeholder="Any tag" options={allTags} />
          )}
          {anyFilter && (
            <button
              onClick={() => {
                setTypeFilter("");
                setStatusFilter("");
                setPriorityFilter("");
                setSentFilter("");
                setTagFilter("");
              }}
              className="btn-subtle text-xs"
            >
              Clear filters
            </button>
          )}
          <div className="ml-auto flex rounded-xl bg-night-900/[0.03] p-0.5 ring-1 ring-night-900/10">
            <button
              onClick={() => setMode("card")}
              className={`rounded-lg px-3 py-1 text-xs font-medium ${
                mode === "card" ? "bg-gold-400 text-night-900" : "text-taupe-600"
              }`}
            >
              Cards
            </button>
            <button
              onClick={() => setMode("table")}
              className={`rounded-lg px-3 py-1 text-xs font-medium ${
                mode === "table" ? "bg-gold-400 text-night-900" : "text-taupe-600"
              }`}
            >
              Table
            </button>
            <button
              onClick={() => setMode("cities")}
              className={`rounded-lg px-3 py-1 text-xs font-medium ${
                mode === "cities" ? "bg-gold-400 text-night-900" : "text-taupe-600"
              }`}
            >
              Cities
            </button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="py-20 text-center text-taupe-400">Loading…</div>
        ) : mode === "table" ? (
          <ContactTable contacts={filtered} />
        ) : mode === "cities" ? (
          <CitiesView contacts={filtered} />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((c) => (
              <ContactCard key={c.id} contact={c} />
            ))}
            {filtered.length === 0 && (
              <div className="col-span-full py-20 text-center text-taupe-400">
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

function CitiesView({ contacts }: { contacts: Contact[] }) {
  const groups = useMemo(() => {
    const map = new Map<string, Contact[]>();
    for (const c of contacts) {
      const key = [c.city.trim(), c.state.trim()].filter(Boolean).join(", ") || "No city";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [contacts]);

  if (contacts.length === 0) {
    return (
      <div className="py-20 text-center text-taupe-400">No contacts match this view.</div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {groups.map(([city, people]) => (
        <div key={city} className="card p-4">
          <div className="mb-3 flex items-baseline justify-between">
            <h3 className="font-semibold">📍 {city}</h3>
            <span className="text-xs text-taupe-400">
              {people.length} {people.length === 1 ? "person" : "people"}
            </span>
          </div>
          <div className="space-y-1.5">
            {people.map((c) => (
              <Link
                key={c.id}
                href={`/contacts/${c.id}`}
                className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-night-900/[0.04]"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-gold-300/80 to-gold-600 text-[11px] font-bold text-night-900">
                  {initials(c.name)}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.name}</span>
                <span className="shrink-0 text-xs text-taupe-400">{c.contact_type}</span>
              </Link>
            ))}
          </div>
        </div>
      ))}
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
      className={`rounded-xl px-3 py-1.5 text-xs ring-1 ring-night-900/10 focus:outline-none ${
        value ? "bg-gold-400/15 text-gold-700" : "bg-night-900/[0.03] text-taupe-600"
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
