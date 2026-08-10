import { describe, expect, it } from "vitest";
import { advances, legacyBottleStatus } from "../bottleStatus";

describe("advances (forward-only batch rule)", () => {
  it("moves forward", () => {
    expect(advances("Planned", "Shipped")).toBe(true);
    expect(advances("Shipped", "Delivered")).toBe(true);
  });
  it("never downgrades or repeats — protects hand-delivered bottles", () => {
    expect(advances("Delivered", "Shipped")).toBe(false);
    expect(advances("Delivered", "Delivered")).toBe(false);
    expect(advances("Followed up", "Delivered")).toBe(false);
  });
});

describe("legacyBottleStatus", () => {
  it("maps the old contact vocabulary onto the shipment ladder", () => {
    expect(legacyBottleStatus("Sent")).toBe("Shipped");
    expect(legacyBottleStatus("Ready to send")).toBe("Ready");
    expect(legacyBottleStatus("Want to send")).toBe("Planned");
    expect(legacyBottleStatus("Delivered")).toBe("Delivered");
  });
});
