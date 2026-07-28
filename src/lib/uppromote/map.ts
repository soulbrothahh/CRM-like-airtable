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

/** UpPromote affiliate row → ambassadors upsert payload (CRM-owned fields excluded). */
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
  upline_uppromote_id: number | null;
  uppromote_created_at: string | null;
} {
  return {
    uppromote_id: num(row, ["id", "affiliate_id"]),
    email: str(row, ["email"]).toLowerCase(),
    first_name: str(row, ["first_name", "firstname"]),
    last_name: str(row, ["last_name", "lastname"]),
    uppromote_status: str(row, ["status", "affiliate_status", "state"]),
    program_id: num(row, ["program_id"]),
    program_name: str(row, ["program_name", "program"]),
    referral_link: str(row, ["affiliate_link", "referral_link", "default_link", "link"]),
    facebook: str(row, ["facebook"]),
    instagram: str(row, ["instagram"]),
    tiktok: str(row, ["tiktok"]),
    website: str(row, ["website"]),
    email_verified: bool(row, ["email_verified", "is_email_verified"]),
    upline_uppromote_id: num(row, ["parent_id", "upline_id", "referred_by"]),
    uppromote_created_at: iso(row, ["created_at", "created_at_timestamp", "signup_date"]),
  };
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

/** UpPromote payment row → payouts upsert payload. */
export function mapPayment(row: Row): {
  uppromote_payment_id: number | null;
  uppromote_affiliate_id: number | null;
  amount: number;
  status: string;
  method: string;
  paid_at: string | null;
} {
  return {
    uppromote_payment_id: num(row, ["id", "payment_id"]),
    uppromote_affiliate_id: num(row, ["affiliate_id"]),
    amount: num(row, ["amount", "total", "value"]) ?? 0,
    status: str(row, ["status", "payment_status"]).toLowerCase(),
    method: str(row, ["method", "payment_method"]),
    paid_at: iso(row, ["paid_at", "payment_date", "created_at"]),
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
