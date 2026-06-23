"use client";

import { ACTIVITY_ICONS, ACTIVITY_LABELS } from "@/lib/constants";
import { computeScore, scoreBand, type ScoreBand } from "@/lib/scoring";
import { formatDate } from "@/lib/helpers";
import type { Activity } from "@/lib/types";

const BAND_RING: Record<ScoreBand, string> = {
  Cold: "from-taupe-300 to-taupe-500",
  Warm: "from-amber-300 to-amber-500",
  Hot: "from-clay-400 to-clay-600",
};

// Compact lead-score card for the contact profile. Computes live from the
// activity timeline so it always reflects the latest signals.
export function SignalsCard({ activities }: { activities: Activity[] }) {
  const { score, band } = computeScore(activities);

  // Top contributing signal types, for a quick "why" breakdown.
  const counts = new Map<string, number>();
  for (const a of activities) counts.set(a.type, (counts.get(a.type) ?? 0) + 1);
  const top = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  return (
    <div className="card p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-gold-600/80">
        Engagement score
      </h3>
      <div className="flex items-center gap-4">
        <span
          className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${BAND_RING[band]} text-2xl font-bold text-night-900`}
        >
          {score}
        </span>
        <div className="min-w-0">
          <div className="text-base font-semibold">
            {band === "Hot" ? "🔥 " : ""}
            {band}
          </div>
          <p className="text-xs text-taupe-500">
            {activities.length === 0
              ? "No signals yet. Add the tracking snippet to start capturing visits."
              : `${activities.length} signal${activities.length === 1 ? "" : "s"} tracked`}
          </p>
        </div>
      </div>
      {top.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {top.map(([type, n]) => (
            <span
              key={type}
              className="rounded-full bg-night-900/[0.04] px-2.5 py-0.5 text-xs text-taupe-600"
            >
              {ACTIVITY_ICONS[type as Activity["type"]]}{" "}
              {ACTIVITY_LABELS[type as Activity["type"]]} · {n}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// Web/email/social signal timeline (distinct from the manual interaction log).
export function ActivityTimeline({ activities }: { activities: Activity[] }) {
  return (
    <div className="card p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-gold-600/80">
        Activity & signals
      </h3>
      {activities.length === 0 ? (
        <p className="text-sm text-taupe-400">
          No tracked activity yet. Once the website snippet is live, visits, form
          fills, and email engagement land here automatically.
        </p>
      ) : (
        <ol className="relative space-y-4 border-l border-night-900/10 pl-5">
          {activities.map((a) => (
            <li key={a.id} className="relative">
              <span className="absolute -left-[30px] top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-cream-50 text-[11px] ring-4 ring-cream-50">
                {ACTIVITY_ICONS[a.type]}
              </span>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-night-900">{a.title}</span>
                <span className="shrink-0 text-xs text-taupe-400">
                  {formatDate(a.occurred_at.slice(0, 10))}
                </span>
              </div>
              <div className="text-xs text-taupe-400">
                {ACTIVITY_LABELS[a.type]}
                {a.url ? (
                  <>
                    {" · "}
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-gold-600 hover:underline"
                    >
                      {prettyUrl(a.url)}
                    </a>
                  </>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function prettyUrl(url: string): string {
  try {
    const u = new URL(url);
    return (u.pathname === "/" ? u.hostname : u.pathname).slice(0, 40);
  } catch {
    return url.slice(0, 40);
  }
}
