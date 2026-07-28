// DEMO FIXTURES — obviously-fake development data for exercising the sync
// mapper and UI without UpPromote credentials. Only ever used when a sync is
// invoked with demo=1 AND UpPromote is NOT configured; results are labeled
// demo throughout and are never written to the database.

export const FIXTURE_AFFILIATES: Record<string, unknown>[] = [
  {
    id: 900001,
    first_name: "Demo",
    last_name: "Ambassador",
    email: "demo.ambassador@example.com",
    status: "approved",
    program_id: 1,
    program_name: "NuKava Ambassadors (demo)",
    affiliate_link: "https://example.com/?sca_ref=demo1",
    instagram: "demo.ambassador",
    email_verified: "verified",
    created_at: "2026-07-01T12:00:00Z",
  },
  {
    id: 900002,
    first_name: "Sample",
    last_name: "Creator",
    email: "sample.creator@example.com",
    status: "pending",
    program_id: 1,
    program_name: "NuKava Ambassadors (demo)",
    affiliate_link: "https://example.com/?sca_ref=demo2",
    tiktok: "sample.creator",
    email_verified: "unverified",
    created_at: "2026-07-15T12:00:00Z",
  },
];

export const FIXTURE_REFERRALS: Record<string, unknown>[] = [
  {
    id: 910001,
    affiliate_id: 900001,
    order_number: "#DEMO-1001",
    tracking_type: "coupon",
    coupon: "DEMO10",
    status: "approved",
    total_sales: 31.49,
    commission: 4.72,
    created_at: "2026-07-20T18:00:00Z",
  },
];

export const FIXTURE_PAYMENTS: Record<string, unknown>[] = [
  {
    id: 920001,
    affiliate_id: 900001,
    amount: 4.72,
    status: "unpaid",
    method: "paypal",
    created_at: "2026-07-21T00:00:00Z",
  },
];

export const FIXTURE_COUPONS: Record<string, unknown>[] = [
  { id: 930001, affiliate_id: 900001, code: "DEMO10", discount: "10%" },
];
