// Lead scoring engine.
// Reads a contact's activity timeline and rolls it up into a single
// engagement score + a hot/warm/cold band. This is what turns passive signal
// collection into "who should I reach out to right now."

import type { Activity, ActivityType } from "./types";

export type ScoreBand = "Cold" | "Warm" | "Hot";

// Points awarded per signal. Tuned so a form fill alone lands you in "Warm",
// and sustained engagement (opens, clicks, replies, visits) pushes to "Hot".
export const SCORE_POINTS: Record<ActivityType, number> = {
  page_view: 3,
  session: 5,
  form_submit: 25,
  email_sent: 0, // your outbound — doesn't raise their score
  email_open: 5,
  email_click: 10,
  email_reply: 20,
  social_follow: 4,
  social_mention: 6,
  social_dm: 8,
  note: 0,
};

// Recent signals matter more than old ones (recency weighting / decay).
function recencyWeight(occurredAt: string): number {
  const ms = Date.now() - new Date(occurredAt).getTime();
  if (Number.isNaN(ms)) return 1;
  const days = ms / 86_400_000;
  if (days <= 14) return 1;
  if (days <= 60) return 0.5;
  return 0.25;
}

// Don't let a flood of one cheap signal (e.g. page views) dominate the score.
const PER_TYPE_CAP: Partial<Record<ActivityType, number>> = {
  page_view: 30,
  session: 30,
  social_follow: 8,
};

export interface ScoreResult {
  score: number;
  band: ScoreBand;
}

export function scoreBand(score: number): ScoreBand {
  if (score >= 50) return "Hot";
  if (score >= 20) return "Warm";
  return "Cold";
}

export function computeScore(activities: Activity[]): ScoreResult {
  const perType: Partial<Record<ActivityType, number>> = {};
  for (const a of activities) {
    const pts = (SCORE_POINTS[a.type] ?? 0) * recencyWeight(a.occurred_at);
    perType[a.type] = (perType[a.type] ?? 0) + pts;
  }
  let raw = 0;
  for (const [type, pts] of Object.entries(perType)) {
    const cap = PER_TYPE_CAP[type as ActivityType];
    raw += cap !== undefined ? Math.min(pts as number, cap) : (pts as number);
  }
  const score = Math.max(0, Math.round(raw));
  return { score, band: scoreBand(score) };
}
