// Shared bottle-status rules (pure, unit-tested).
import type { SampleShipmentStatus } from "./types";

const ORDER: SampleShipmentStatus[] = ["Planned", "Ready", "Shipped", "Delivered", "Followed up"];

/** Batch jobs may only move a shipment FORWARD — a hand-delivered bottle
 *  marked Delivered is never downgraded by a Shopify lookup. */
export function advances(current: string, next: string): boolean {
  const a = ORDER.indexOf(current as SampleShipmentStatus);
  const b = ORDER.indexOf(next as SampleShipmentStatus);
  return b > a;
}

/** Legacy contacts.bottle_status → sample_shipments status. */
export function legacyBottleStatus(s: string): SampleShipmentStatus {
  switch (s) {
    case "Sent":
      return "Shipped";
    case "Delivered":
      return "Delivered";
    case "Followed up":
      return "Followed up";
    case "Ready to send":
      return "Ready";
    default:
      return "Planned";
  }
}
