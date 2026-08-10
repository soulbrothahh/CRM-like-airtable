// Ambassador intake payload validation (pure — unit-tested).

interface IntakePayload {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  instagram?: string;
  tiktok?: string;
  wantsSample?: boolean;
  agreeTerms?: boolean;
  affiliateId?: number | string;
}

/** Validate + normalize the raw signup body. Passwords are already stripped
 *  by the route before this runs. */
export function parseIntake(raw: Record<string, unknown>): { ok: true; data: Required<Omit<IntakePayload, "affiliateId">> & { affiliateId: number | null } } | { ok: false; error: string } {
  const s = (k: string) => String(raw[k] ?? "").trim();
  const email = s("email").toLowerCase();
  if (!email || !email.includes("@")) return { ok: false, error: "A valid email is required." };
  const affRaw = raw.affiliateId ?? raw.affiliate_id;
  const affiliateId = affRaw !== undefined && affRaw !== null && String(affRaw) !== "" ? Number(affRaw) : null;
  return {
    ok: true,
    data: {
      firstName: s("firstName") || s("first_name"),
      lastName: s("lastName") || s("last_name"),
      email,
      phone: s("phone"),
      address: s("address"),
      city: s("city"),
      state: s("state"),
      zip: s("zip"),
      instagram: s("instagram").replace(/^@/, ""),
      tiktok: s("tiktok").replace(/^@/, ""),
      wantsSample: raw.wantsSample === true || raw.wants_sample === true,
      agreeTerms: raw.agreeTerms === true || raw.agree_terms === true,
      affiliateId: affiliateId !== null && Number.isFinite(affiliateId) ? affiliateId : null,
    },
  };
}

