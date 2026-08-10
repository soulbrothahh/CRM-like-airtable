import { describe, expect, it } from "vitest";
import { parseIntake } from "../intake";

describe("parseIntake", () => {
  it("rejects missing email", () => {
    expect(parseIntake({ firstName: "A" }).ok).toBe(false);
  });
  it("normalizes fields and strips @ from handles", () => {
    const r = parseIntake({
      firstName: " Sione ", lastName: "Lapuaho", email: "SIONE@Example.com",
      instagram: "@sione", wantsSample: true, agreeTerms: true, affiliateId: "11989107",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.email).toBe("sione@example.com");
      expect(r.data.instagram).toBe("sione");
      expect(r.data.affiliateId).toBe(11989107);
      expect(r.data.wantsSample).toBe(true);
    }
  });
  it("treats absent wantsSample as false and bad affiliate ids as null", () => {
    const r = parseIntake({ email: "a@b.co", affiliateId: "abc" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.wantsSample).toBe(false);
      expect(r.data.affiliateId).toBeNull();
    }
  });
});
