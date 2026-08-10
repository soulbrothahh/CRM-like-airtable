import { describe, expect, it } from "vitest";
import { aggregateReferrals } from "../rollups";

// Regression: a pending-only referral must count toward sale totals
// (the Sione bug — pending sales showed 0 referrals / $0 tracked sales
// while commission showed, making the page internally inconsistent).
describe("aggregateReferrals", () => {
  it("counts a pending referral toward totals and pending fields", () => {
    const agg = aggregateReferrals([
      { ambassador_id: "a1", status: "pending", revenue: 29.99, occurred_at: "2026-07-30T18:00:00Z" },
    ]);
    const a = agg.get("a1")!;
    expect(a.total_referrals).toBe(1);
    expect(a.total_revenue).toBeCloseTo(29.99);
    expect(a.pending_referrals).toBe(1);
    expect(a.pending_revenue).toBeCloseTo(29.99);
    expect(a.last_sale_at).toBe("2026-07-30T18:00:00Z");
    expect(a.first_sale_at).toBe("2026-07-30T18:00:00Z");
  });

  it("excludes every voided status from all fields", () => {
    const agg = aggregateReferrals(
      ["denied", "rejected", "cancelled", "canceled", "refunded", "voided", "void"].map((status) => ({
        ambassador_id: "a1",
        status,
        revenue: 10,
        occurred_at: "2026-07-30T00:00:00Z",
      }))
    );
    expect(agg.get("a1")).toBeUndefined();
  });

  it("approved counts toward totals but not pending; statuses are case-insensitive", () => {
    const agg = aggregateReferrals([
      { ambassador_id: "a1", status: "Approved", revenue: 20, occurred_at: "2026-07-01T00:00:00Z" },
      { ambassador_id: "a1", status: "Pending", revenue: 30, occurred_at: "2026-07-30T00:00:00Z" },
    ]);
    const a = agg.get("a1")!;
    expect(a.total_referrals).toBe(2);
    expect(a.total_revenue).toBeCloseTo(50);
    expect(a.pending_referrals).toBe(1);
    expect(a.pending_revenue).toBeCloseTo(30);
    expect(a.first_sale_at).toBe("2026-07-01T00:00:00Z");
    expect(a.last_sale_at).toBe("2026-07-30T00:00:00Z");
  });

  it("ignores rows with no ambassador link", () => {
    const agg = aggregateReferrals([
      { ambassador_id: null, status: "pending", revenue: 29.99, occurred_at: null },
    ]);
    expect(agg.size).toBe(0);
  });
});
