// Defensive mapping from UpPromote v2 rows to CRM rows.
//
// The v2 docs block automated fetching, so exact field names are confirmed at
// runtime: every accessor checks a list of candidate keys and the dry-run
// report surfaces rows that produced no usable id, instead of guessing.

type Row = Record<string, unknown>;

function pick(row: Row, keys: string[]): unknown {
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
}

export function num(row: Row, keys: string[]): number | null {
  const v = pick(row, keys);
  if (v === undefined) return null;
  const n = typeof v === "number" ? v : Number(String(v));
  return Number.isFinite(n) ? n : null;
}

export function str(row: Row, keys: string[]): string {
  const v = pick(row, keys);
  if (v === undefined) return "";
  return typeof v === "string" ? v : String(v);
}

export function bool(row: Row, keys: string[]): boolean | null {
  const v = pick(row, keys);
  if (v === undefined) return null;
  if (typeof v === "boolean") return v;
  const s = String(v).toLowerCase();
  if (["1", "true", "yes", "verified", "active"].includes(s)) return true;
  if (["0", "false", "no", "unverified", "inactive"].includes(s)) return false;
  return null;
}

export function iso(row: Row, keys: string[]): string | null {
  const v = pick(row, keys);
  if (v === undefined) return null;
  // Accept ISO strings and unix seconds/millis.
  if (typeof v === "number") {
    const ms = v > 1e12 ? v : v * 1000;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * UpPromote affiliate row → ambassadors upsert payload (CRM-owned fields
 * excluded). Field names confirmed against the live v2 GET /affiliates schema.
 * The affiliate record carries authoritative money rollups
 * (paid/approved/pending_amount), so commission totals come from here — the
 * referral mirror only derives sale counts/dates.
 */
export function mapAffiliate(row: Row): {
  uppromote_id: number | null;
  email: string;
  first_name: string;
  last_name: string;
  uppromote_status: string;
  program_id: number | null;
  program_name: string;
  referral_link: string;
  facebook: string;
  instagram: string;
  tiktok: string;
  website: string;
  email_verified: boolean | null;
  w9_on_file: boolean;
  upline_uppromote_id: number | null;
  total_commission: number;
  unpaid_commission: number;
  uppromote_created_at: string | null;
} {
  const paid = num(row, ["paid_amount"]) ?? 0;
  const approved = num(row, ["approved_amount"]) ?? 0;
  const pending = num(row, ["pending_amount"]) ?? 0;
  return {
    uppromote_id: num(row, ["id", "affiliate_id"]),
    email: str(row, ["email"]).toLowerCase(),
    first_name: str(row, ["first_name", "firstname"]),
    last_name: str(row, ["last_name", "lastname"]),
    uppromote_status: str(row, ["status", "affiliate_status"]),
    program_id: num(row, ["program_id"]),
    program_name: str(row, ["program_name", "program"]),
    referral_link: str(row, ["default_affiliate_link", "custom_affiliate_link", "affiliate_link", "referral_link"]),
    facebook: str(row, ["facebook"]),
    instagram: str(row, ["instagram"]),
    tiktok: str(row, ["tiktok"]),
    website: str(row, ["website"]),
    email_verified: bool(row, ["email_verified", "is_email_verified"]),
    // Presence only — the W-9 URL itself is sensitive and never stored.
    w9_on_file: str(row, ["w9_form"]) !== "",
    upline_uppromote_id: num(row, ["up_line_affiliate_id", "parent_id", "upline_id"]),
    total_commission: paid + approved + pending,
    unpaid_commission: approved + pending,
    uppromote_created_at: iso(row, ["created_at", "signup_date"]),
  };
}

/** Coupon code strings that ride directly on the affiliate record. */
export function affiliateCoupons(row: Row): string[] {
  const v = row.coupons;
  if (!Array.isArray(v)) return [];
  return v.map((c) => (typeof c === "string" ? c : String(c))).filter((c) => c !== "");
}

/** UpPromote referral row → referrals upsert payload. */
export function mapReferral(row: Row): {
  uppromote_referral_id: number | null;
  uppromote_affiliate_id: number | null;
  order_id: string;
  order_number: string;
  tracking_type: string;
  coupon_code: string;
  status: string;
  revenue: number;
  commission: number;
  occurred_at: string | null;
} {
  return {
    uppromote_referral_id: num(row, ["id", "referral_id"]),
    uppromote_affiliate_id: num(row, ["affiliate_id"]),
    order_id: str(row, ["order_id", "shopify_order_id"]),
    order_number: str(row, ["order_number", "order_name"]),
    tracking_type: str(row, ["tracking_type", "referral_type", "type"]),
    coupon_code: str(row, ["coupon", "coupon_code", "discount_code"]),
    status: str(row, ["status", "referral_status"]).toLowerCase(),
    revenue: num(row, ["total_sales", "revenue", "order_total", "total", "amount"]) ?? 0,
    commission: num(row, ["commission", "commission_amount", "commission_value"]) ?? 0,
    occurred_at: iso(row, ["created_at", "order_date", "conversion_date"]),
  };
}

/**
 * UpPromote paid-payment history row (GET /payments/paid) → payouts upsert.
 * Confirmed fields: payment_id, affiliate_id, status (e.g. SUCCESS),
 * total_processed, payment_method, processed_at.
 */
export function mapPayment(row: Row): {
  uppromote_payment_id: number | null;
  uppromote_affiliate_id: number | null;
  amount: number;
  status: string;
  method: string;
  paid_at: string | null;
} {
  return {
    uppromote_payment_id: num(row, ["payment_id", "id"]),
    uppromote_affiliate_id: num(row, ["affiliate_id"]),
    amount: num(row, ["total_processed", "amount", "total"]) ?? 0,
    status: str(row, ["status", "payment_status"]).toLowerCase(),
    method: str(row, ["payment_method", "method"]),
    paid_at: iso(row, ["processed_at", "paid_at", "created_at"]),
  };
}

/** UpPromote coupon row → per-affiliate coupon payload. */
export function mapCoupon(row: Row): {
  uppromote_coupon_id: number | null;
  uppromote_affiliate_id: number | null;
  code: string;
  discount: string;
} {
  return {
    uppromote_coupon_id: num(row, ["id", "coupon_id"]),
    uppromote_affiliate_id: num(row, ["affiliate_id"]),
    code: str(row, ["code", "coupon", "coupon_code", "name"]),
    discount: str(row, ["discount", "discount_value", "value", "amount"]),
  };
}
