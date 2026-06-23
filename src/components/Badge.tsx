import {
  BOTTLE_STATUS_COLORS,
  DEAL_TYPE_COLORS,
  EVENT_STATUS_COLORS,
  EVENT_TYPE_COLORS,
  OUTREACH_STATUS_COLORS,
  PRIORITY_COLORS,
  RELATIONSHIP_COLORS,
  SCORE_BAND_COLORS,
  STAGE_COLORS,
  STATUS_COLORS,
} from "@/lib/constants";
import { scoreBand } from "@/lib/scoring";
import type {
  BottlePriority,
  BottleStatus,
  DealStage,
  DealType,
  EventStatus,
  EventType,
  OutreachStatus,
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

export function StageBadge({ stage }: { stage: DealStage }) {
  return <span className={`badge ${STAGE_COLORS[stage]}`}>{stage}</span>;
}

export function DealTypeBadge({ type }: { type: DealType }) {
  return <span className={`badge ${DEAL_TYPE_COLORS[type]}`}>{type}</span>;
}

export function EventStatusBadge({ status }: { status: EventStatus }) {
  return <span className={`badge ${EVENT_STATUS_COLORS[status]}`}>{status}</span>;
}

export function EventTypeBadge({ type }: { type: EventType }) {
  return <span className={`badge ${EVENT_TYPE_COLORS[type]}`}>{type}</span>;
}

export function OutreachStatusBadge({ status }: { status: OutreachStatus }) {
  return <span className={`badge ${OUTREACH_STATUS_COLORS[status]}`}>{status}</span>;
}

// Signal-driven engagement score → "🔥 Hot 62", "Warm 28", "Cold 5"
export function ScoreBadge({ score }: { score: number }) {
  const band = scoreBand(score);
  const flame = band === "Hot" ? "🔥 " : "";
  return (
    <span className={`badge ${SCORE_BAND_COLORS[band]}`}>
      {flame}
      {band} {score}
    </span>
  );
}
