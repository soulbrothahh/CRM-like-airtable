"use client";

import { useState } from "react";
import Link from "next/link";
import { useData } from "./DataProvider";
import {
  BottleStatusBadge,
  PriorityBadge,
  RelationshipBadge,
  StatusBadge,
} from "./Badge";
import { QuickActions } from "./QuickActions";
import {
  BOTTLE_PRIORITIES,
  BOTTLE_STATUSES,
  RELATIONSHIP_STRENGTHS,
  STATUSES,
} from "@/lib/constants";
import { formatDate, isOverdue } from "@/lib/helpers";
import type { Contact } from "@/lib/types";

type SortKey =
  | "name"
  | "contact_type"
  | "status"
  | "relationship_strength"
  | "bottle_priority"
  | "bottle_status"
  | "follower_count"
  | "next_follow_up_date"
  | "city";

export function ContactTable({ contacts }: { contacts: Contact[] }) {
  const { update } = useData();
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [asc, setAsc] = useState(true);
  const [editing, setEditing] = useState<{ id: string; field: keyof Contact } | null>(
    null
  );

  const sorted = [...contacts].sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    if (av === null || av === undefined) return 1;
    if (bv === null || bv === undefined) return -1;
    if (typeof av === "number" && typeof bv === "number") return asc ? av - bv : bv - av;
    return asc
      ? String(av).localeCompare(String(bv))
      : String(bv).localeCompare(String(av));
  });

  function toggleSort(key: SortKey) {
    if (sortKey === key) setAsc(!asc);
    else {
      setSortKey(key);
      setAsc(true);
    }
  }

  const arrow = (key: SortKey) => (sortKey === key ? (asc ? " ▲" : " ▼") : "");

  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[1100px] text-sm">
        <thead>
          <tr className="border-b border-white/5 text-left text-xs uppercase tracking-wide text-slate-400">
            <Th onClick={() => toggleSort("name")}>Name{arrow("name")}</Th>
            <Th onClick={() => toggleSort("contact_type")}>Type{arrow("contact_type")}</Th>
            <Th onClick={() => toggleSort("status")}>Status{arrow("status")}</Th>
            <Th onClick={() => toggleSort("relationship_strength")}>
              Relationship{arrow("relationship_strength")}
            </Th>
            <Th onClick={() => toggleSort("bottle_priority")}>
              Priority{arrow("bottle_priority")}
            </Th>
            <Th onClick={() => toggleSort("bottle_status")}>
              Bottle{arrow("bottle_status")}
            </Th>
            <Th onClick={() => toggleSort("follower_count")}>
              Followers{arrow("follower_count")}
            </Th>
            <Th onClick={() => toggleSort("next_follow_up_date")}>
              Follow-up{arrow("next_follow_up_date")}
            </Th>
            <th className="px-3 py-2.5">Quick actions</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((c) => (
            <tr
              key={c.id}
              className="border-b border-white/5 align-middle hover:bg-white/[0.02]"
            >
              <td className="px-3 py-2.5">
                <Link
                  href={`/contacts/${c.id}`}
                  className="font-medium text-slate-100 hover:text-kava-300"
                >
                  {c.name || "Untitled"}
                </Link>
                <div className="text-xs text-slate-500">
                  {c.instagram || c.city || ""}
                </div>
              </td>
              <td className="px-3 py-2.5 text-slate-300">{c.contact_type}</td>

              <EditCell
                editing={editing}
                id={c.id}
                field="status"
                onEdit={setEditing}
                display={<StatusBadge status={c.status} />}
              >
                <InlineSelect
                  value={c.status}
                  options={STATUSES}
                  onSave={(v) => {
                    update(c.id, { status: v as Contact["status"] });
                    setEditing(null);
                  }}
                />
              </EditCell>

              <EditCell
                editing={editing}
                id={c.id}
                field="relationship_strength"
                onEdit={setEditing}
                display={<RelationshipBadge value={c.relationship_strength} />}
              >
                <InlineSelect
                  value={c.relationship_strength}
                  options={RELATIONSHIP_STRENGTHS}
                  onSave={(v) => {
                    update(c.id, {
                      relationship_strength: v as Contact["relationship_strength"],
                    });
                    setEditing(null);
                  }}
                />
              </EditCell>

              <EditCell
                editing={editing}
                id={c.id}
                field="bottle_priority"
                onEdit={setEditing}
                display={<PriorityBadge priority={c.bottle_priority} />}
              >
                <InlineSelect
                  value={c.bottle_priority}
                  options={BOTTLE_PRIORITIES}
                  onSave={(v) => {
                    update(c.id, { bottle_priority: v as Contact["bottle_priority"] });
                    setEditing(null);
                  }}
                />
              </EditCell>

              <EditCell
                editing={editing}
                id={c.id}
                field="bottle_status"
                onEdit={setEditing}
                display={<BottleStatusBadge status={c.bottle_status} />}
              >
                <InlineSelect
                  value={c.bottle_status}
                  options={BOTTLE_STATUSES}
                  onSave={(v) => {
                    update(c.id, { bottle_status: v as Contact["bottle_status"] });
                    setEditing(null);
                  }}
                />
              </EditCell>

              <td className="px-3 py-2.5 text-slate-300">
                {c.follower_count ? c.follower_count.toLocaleString() : "—"}
              </td>

              <td className="px-3 py-2.5">
                <span
                  className={
                    isOverdue(c.next_follow_up_date)
                      ? "font-medium text-rose-300"
                      : "text-slate-300"
                  }
                >
                  {formatDate(c.next_follow_up_date)}
                </span>
              </td>

              <td className="px-3 py-2.5">
                <QuickActions contact={c} compact />
              </td>
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={9} className="px-3 py-10 text-center text-slate-500">
                No contacts match this view.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <th
      onClick={onClick}
      className="cursor-pointer select-none px-3 py-2.5 font-semibold hover:text-slate-200"
    >
      {children}
    </th>
  );
}

function EditCell({
  editing,
  id,
  field,
  onEdit,
  display,
  children,
}: {
  editing: { id: string; field: keyof Contact } | null;
  id: string;
  field: keyof Contact;
  onEdit: (e: { id: string; field: keyof Contact } | null) => void;
  display: React.ReactNode;
  children: React.ReactNode;
}) {
  const active = editing?.id === id && editing.field === field;
  return (
    <td className="px-3 py-2.5">
      {active ? (
        children
      ) : (
        <button
          onClick={() => onEdit({ id, field })}
          className="rounded-lg px-1 py-0.5 hover:ring-1 hover:ring-white/10"
          title="Click to edit"
        >
          {display}
        </button>
      )}
    </td>
  );
}

function InlineSelect({
  value,
  options,
  onSave,
}: {
  value: string;
  options: readonly string[];
  onSave: (v: string) => void;
}) {
  return (
    <select
      autoFocus
      className="input py-1 text-xs"
      defaultValue={value}
      onChange={(e) => onSave(e.target.value)}
      onBlur={(e) => onSave(e.target.value)}
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}
