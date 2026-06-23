"use client";

import Link from "next/link";
import { BottleStatusBadge, PriorityBadge, StatusBadge } from "./Badge";
import { QuickActions } from "./QuickActions";
import { formatDate, initials, isOverdue } from "@/lib/helpers";
import type { Contact } from "@/lib/types";

export function ContactCard({ contact }: { contact: Contact }) {
  const c = contact;
  return (
    <div className="card flex flex-col gap-3 p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-gold-300/80 to-gold-600 text-sm font-bold text-night-900">
          {initials(c.name)}
        </span>
        <div className="min-w-0 flex-1">
          <Link
            href={`/contacts/${c.id}`}
            className="block truncate font-semibold hover:text-gold-600"
          >
            {c.name || "Untitled"}
          </Link>
          <div className="truncate text-xs text-taupe-400">
            {c.contact_type}
            {c.city ? ` · ${c.city}${c.state ? ", " + c.state : ""}` : ""}
            {c.follower_count ? ` · ${c.follower_count.toLocaleString()} followers` : ""}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <StatusBadge status={c.status} />
        {c.bottle_recipient && <PriorityBadge priority={c.bottle_priority} />}
        {c.bottle_recipient && <BottleStatusBadge status={c.bottle_status} />}
      </div>

      {c.next_follow_up_date && (
        <div
          className={`text-xs ${
            isOverdue(c.next_follow_up_date) ? "text-rose-600" : "text-taupe-500"
          }`}
        >
          🔔 Follow-up: {formatDate(c.next_follow_up_date)}
          {isOverdue(c.next_follow_up_date) ? " (overdue)" : ""}
        </div>
      )}

      {c.notes && (
        <p className="line-clamp-2 text-xs text-taupe-500">{c.notes}</p>
      )}

      <div className="mt-auto border-t border-night-900/5 pt-3">
        <QuickActions contact={c} compact />
      </div>
    </div>
  );
}
