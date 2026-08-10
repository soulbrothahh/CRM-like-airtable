// Pure referral-rollup math, centralized so the counted/excluded status
// rules can't drift between fields (and so it's unit-testable).
//
// Rule: every referral counts toward sale totals — pending included —
// EXCEPT explicitly voided ones. Pending is additionally tracked on its
// own so the UI can mark not-yet-banked sales.

export const VOIDED_STATUSES = new Set([
  "denied",
  "rejected",
  "cancelled",
  "canceled",
  "refunded",
  "voided",
  "void",
]);

export interface ReferralRow {
  ambassador_id: string | null;
  status: string;
  revenue: number;
  occurred_at: string | null;
}

export interface Rollup {
  total_referrals: number;
  total_revenue: number;
  pending_referrals: number;
  pending_revenue: number;
  first_sale_at: string | null;
  last_sale_at: string | null;
}

export function emptyRollup(): Rollup {
  return {
    total_referrals: 0,
    total_revenue: 0,
    pending_referrals: 0,
    pending_revenue: 0,
    first_sale_at: null,
    last_sale_at: null,
  };
}

/** Aggregate referral rows per ambassador id. Voided statuses are excluded
 *  from everything; pending rows count toward totals AND pending fields. */
export function aggregateReferrals(rows: ReferralRow[]): Map<string, Rollup> {
  const agg = new Map<string, Rollup>();
  for (const r of rows) {
    if (!r.ambassador_id) continue;
    const status = String(r.status || "").toLowerCase();
    if (VOIDED_STATUSES.has(status)) continue;
    const a = agg.get(r.ambassador_id) ?? emptyRollup();
    const revenue = Number(r.revenue) || 0;
    a.total_referrals += 1;
    a.total_revenue += revenue;
    if (status === "pending") {
      a.pending_referrals += 1;
      a.pending_revenue += revenue;
    }
    const at = r.occurred_at ? String(r.occurred_at) : null;
    if (at) {
      if (!a.first_sale_at || at < a.first_sale_at) a.first_sale_at = at;
      if (!a.last_sale_at || at > a.last_sale_at) a.last_sale_at = at;
    }
    agg.set(r.ambassador_id, a);
  }
  return agg;
}
