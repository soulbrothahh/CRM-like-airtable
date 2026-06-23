import {
  BOTTLE_STATUS_COLORS,
  PRIORITY_COLORS,
  RELATIONSHIP_COLORS,
  STATUS_COLORS,
} from "@/lib/constants";
import type {
  BottlePriority,
  BottleStatus,
  RelationshipStrength,
  Status,
} from "@/lib/types";

export function StatusBadge({ status }: { status: Status }) {
  return <span className={`badge ${STATUS_COLORS[status]}`}>{status}</span>;
}

export function PriorityBadge({ priority }: { priority: BottlePriority }) {
  return <span className={`badge ${PRIORITY_COLORS[priority]}`}>{priority}</span>;
}

export function BottleStatusBadge({ status }: { status: BottleStatus }) {
  return <span className={`badge ${BOTTLE_STATUS_COLORS[status]}`}>{status}</span>;
}

export function RelationshipBadge({ value }: { value: RelationshipStrength }) {
  return <span className={`badge ${RELATIONSHIP_COLORS[value]}`}>{value}</span>;
}
