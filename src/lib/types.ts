// Core data model for NuKava CRM

export type ContactType =
  | "Creator"
  | "Ambassador"
  | "Agency"
  | "Friend"
  | "Retailer"
  | "Event Contact"
  | "Wholesale"
  | "Other";

export type RelationshipStrength = "Cold" | "Warm" | "Hot" | "Close Friend";

export type LeadTemperature = "Cold" | "Warm" | "Hot";

export type Status =
  | "New Lead"
  | "Contacted"
  | "Interested"
  | "Needs Follow-Up"
  | "Approved for Bottles"
  | "Bottle Sent"
  | "Posted Content"
  | "Ambassador Signed Up"
  | "Not Interested";

export type BottlePriority = "Low" | "Medium" | "High" | "VIP";

// Where someone is in the messaging/outreach loop.
export type OutreachStatus =
  | "Not contacted"
  | "Messaged"
  | "Awaiting reply"
  | "Replied"
  | "Following up"
  | "Closed";

export type BottleStatus =
  | "Not planned"
  | "Want to send"
  | "Need address"
  | "Ready to send"
  | "Sent"
  | "Delivered"
  | "Followed up";

export type InteractionType =
  | "Texted"
  | "Called"
  | "Emailed"
  | "DM'd"
  | "Met in person"
  | "Sent bottle"
  | "Followed up"
  | "Posted content"
  | "Signed up as ambassador";

export interface Contact {
  id: string;
  name: string;
  phone: string;
  email: string;
  instagram: string;
  tiktok: string;
  city: string;
  state: string;
  contact_type: ContactType;
  relationship_strength: RelationshipStrength;
  lead_temperature: LeadTemperature;
  status: Status;
  source: string;
  follower_count: number | null;
  audience_type: string;
  owner: string;
  tags: string[];
  event_id: string | null; // "Met at" — links to a CrmEvent
  outreach_status: OutreachStatus;
  // sequence enrollment (cadence engine)
  sequence_id: string | null;
  sequence_step: number; // current step index (0-based)
  sequence_started: string | null; // YYYY-MM-DD
  notes: string;
  last_contacted_date: string | null; // YYYY-MM-DD
  next_follow_up_date: string | null; // YYYY-MM-DD
  // bottle gifting
  bottle_recipient: boolean;
  bottle_priority: BottlePriority;
  bottle_status: BottleStatus;
  bottle_quantity: number | null;
  shipping_name: string;
  shipping_address: string;
  tracking_number: string;
  date_sent: string | null;
  date_delivered: string | null;
  // outcomes
  posted_content: boolean;
  ambassador_signup: boolean;
  discount_code: string;
  sales_generated: number | null;
  // engagement / web analytics
  visitor_id: string | null; // stitched anonymous device id
  lead_score: number; // signal-driven engagement score
  lead_score_updated_at: string | null;
  created_at: string;
  updated_at: string;
}

export type InteractionDirection = "outbound" | "inbound";

export interface Interaction {
  id: string;
  contact_id: string;
  date: string; // YYYY-MM-DD
  type: InteractionType;
  direction?: InteractionDirection; // sent (outbound) vs received (inbound)
  notes: string;
  next_action: string;
  created_at: string;
}

export type NewContact = Omit<Contact, "id" | "created_at" | "updated_at">;
export type NewInteraction = Omit<Interaction, "id" | "created_at">;

// ---------------- Deal flow (B2B pipeline) ----------------

export type DealType =
  | "Wholesale"
  | "Distribution"
  | "Retail"
  | "Partnership"
  | "Ambassador"
  | "Sponsorship"
  | "Other";

export type DealStage =
  | "Lead"
  | "Contacted"
  | "Qualified"
  | "Meeting"
  | "Proposal"
  | "Negotiation"
  | "Won"
  | "Lost";

export type DealActivityType =
  | "Call"
  | "Email"
  | "DM"
  | "Meeting"
  | "Sample sent"
  | "Proposal sent"
  | "Follow-up"
  | "Contract"
  | "Note";

export interface Deal {
  id: string;
  title: string;
  company: string;
  contact_id: string | null; // optional link to a person contact
  deal_type: DealType;
  stage: DealStage;
  value: number | null; // deal size in $
  probability: number | null; // 0-100; blank = use stage default
  expected_close_date: string | null;
  owner: string;
  source: string;
  next_step: string;
  next_step_date: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface DealActivity {
  id: string;
  deal_id: string;
  date: string; // YYYY-MM-DD
  type: DealActivityType;
  notes: string;
  next_action: string;
  created_at: string;
}

export type NewDeal = Omit<Deal, "id" | "created_at" | "updated_at">;
export type NewDealActivity = Omit<DealActivity, "id" | "created_at">;

// ---------------- Events (kalapus, circles, mixers, pop-ups) ----------------

export type EventType =
  | "Kalapu"
  | "Kava circle"
  | "Mixer"
  | "Pop-up"
  | "Farmers market"
  | "Community"
  | "Conference"
  | "Other";

export type EventStatus =
  | "Idea"
  | "Researching"
  | "Reaching out"
  | "Going"
  | "Attended"
  | "Passed";

export interface CrmEvent {
  id: string;
  name: string;
  type: EventType;
  status: EventStatus;
  date: string | null; // YYYY-MM-DD
  time: string; // free-form, e.g. "7:00 PM" or "7–10pm"
  city: string;
  state: string;
  venue: string;
  host: string;
  goal: string;
  cost: number | null;
  url: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export type NewEvent = Omit<CrmEvent, "id" | "created_at" | "updated_at">;

// ---------------- Sequences / cadences ----------------

export type SequenceChannel = "DM" | "Email" | "Text" | "Call";

export interface SequenceStep {
  day: number; // days after enrollment this step is due
  channel: SequenceChannel;
  label: string; // short description of the touch
  body: string; // optional message template
}

export interface Sequence {
  id: string;
  name: string;
  description: string;
  steps: SequenceStep[];
  created_at: string;
  updated_at: string;
}

export type NewSequence = Omit<Sequence, "id" | "created_at" | "updated_at">;

// ---------------- Tasks ----------------
// Lightweight to-dos, optionally linked to a contact or deal. The Today view
// unifies these with follow-ups, sequence steps, and deal next-steps.

export interface Task {
  id: string;
  title: string;
  notes: string;
  due_date: string | null; // YYYY-MM-DD
  done: boolean;
  contact_id: string | null;
  deal_id: string | null;
  created_at: string;
  updated_at: string;
}

export type NewTask = Omit<Task, "id" | "created_at" | "updated_at">;

// ---------------- Activities / signals (the unified timeline) ----------------
// Every signal — web session, email open, form fill, social touch — becomes a
// typed activity. Activities can be anonymous (visitor_id only) until a form
// fill stitches them onto a contact.

export type ActivitySource = "web" | "email" | "social" | "form" | "manual" | "system";

export type ActivityType =
  | "page_view"
  | "session" // a visit / session start
  | "form_submit"
  | "email_sent"
  | "email_open"
  | "email_click"
  | "email_reply"
  | "social_follow"
  | "social_mention"
  | "social_dm"
  | "note";

export interface Activity {
  id: string;
  contact_id: string | null; // null = anonymous, not yet identified
  visitor_id: string | null; // device id, used to stitch on form fill
  source: ActivitySource;
  type: ActivityType;
  title: string; // human-readable summary
  url: string; // page / link, if relevant
  metadata: Record<string, unknown>; // arbitrary properties
  occurred_at: string; // ISO timestamp the signal happened
  created_at: string;
}

export type NewActivity = Omit<Activity, "id" | "created_at">;

// ---------------- Growth OS: ambassadors (UpPromote mirror) ----------------
// UpPromote owns affiliate status, links, coupons, referral sales, commission
// math, and payouts; the CRM owns lifecycle, tier, notes, and everything
// relationship-side. The two status fields are deliberately separate.

export type AmbassadorLifecycle =
  | "Prospect"
  | "Contacted"
  | "Invited"
  | "Applied"
  | "Approved"
  | "Onboarding"
  | "Activated"
  | "At risk"
  | "Inactive"
  | "Declined";

export type AmbassadorTier = "Ambassador" | "Islander" | "Founding Circle";

export interface Ambassador {
  id: string;
  contact_id: string | null; // link to the canonical person record
  uppromote_id: number | null; // external id; primary match key
  email: string;
  first_name: string;
  last_name: string;
  uppromote_status: string; // theirs: pending / approved / inactive …
  lifecycle: AmbassadorLifecycle; // ours
  tier: AmbassadorTier; // ours
  program_id: number | null;
  program_name: string;
  referral_link: string;
  facebook: string;
  instagram: string;
  tiktok: string;
  website: string;
  email_verified: boolean | null;
  w9_on_file: boolean | null; // status only; the document is never stored
  upline_uppromote_id: number | null;
  total_referrals: number;
  total_revenue: number;
  total_commission: number;
  unpaid_commission: number;
  first_sale_at: string | null;
  last_sale_at: string | null;
  uppromote_created_at: string | null;
  last_synced_at: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface AmbassadorCoupon {
  id: string;
  ambassador_id: string;
  code: string;
  discount: string;
  uppromote_coupon_id: number | null;
  created_at: string;
}

export interface Referral {
  id: string;
  uppromote_referral_id: number | null;
  ambassador_id: string | null;
  uppromote_affiliate_id: number | null;
  order_id: string;
  order_number: string;
  tracking_type: string;
  coupon_code: string;
  status: string;
  revenue: number;
  commission: number;
  adjustment: number;
  occurred_at: string | null;
  synced_at: string;
  created_at: string;
}

export interface Payout {
  id: string;
  uppromote_payment_id: number | null;
  ambassador_id: string | null;
  uppromote_affiliate_id: number | null;
  amount: number;
  status: string;
  method: string;
  paid_at: string | null;
  synced_at: string;
  created_at: string;
}

// ---------------- Growth OS: campaigns & sampling ----------------

export type CampaignChannel =
  | "Shopify"
  | "TikTok Shop"
  | "DTC"
  | "Retail"
  | "Wholesale"
  | "Custom";

export type CampaignStatus = "Planned" | "Active" | "Paused" | "Complete";

export interface Campaign {
  id: string;
  name: string;
  channel: CampaignChannel;
  status: CampaignStatus;
  start_date: string | null;
  end_date: string | null;
  goal: string;
  budget: number | null;
  bottles_allocated: number | null;
  notes: string;
  created_at: string;
  updated_at: string;
}

export type SampleShipmentStatus =
  | "Planned"
  | "Ready"
  | "Shipped"
  | "Delivered"
  | "Followed up";

export interface SampleShipment {
  id: string;
  contact_id: string;
  campaign_id: string | null;
  quantity: number;
  status: SampleShipmentStatus;
  shipping_name: string;
  shipping_address: string;
  tracking_number: string;
  cost: number | null;
  shipped_at: string | null;
  delivered_at: string | null;
  content_received: boolean;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface ContentPost {
  id: string;
  contact_id: string;
  campaign_id: string | null;
  platform: string;
  url: string;
  posted_at: string | null;
  approval_status: "Pending" | "Approved" | "Needs changes";
  usage_rights: boolean;
  ftc_disclosed: boolean | null;
  claims_checked: boolean | null;
  rating: number | null;
  notes: string;
  created_at: string;
  updated_at: string;
}

// ---------------- Growth OS: integration plumbing ----------------

export interface SyncRun {
  id: string;
  provider: string;
  kind: "backfill" | "webhook" | "reconcile";
  dry_run: boolean;
  status: "running" | "success" | "partial" | "error";
  started_at: string;
  finished_at: string | null;
  counts: Record<string, number>;
  errors: string[];
  cursor: Record<string, unknown>;
  created_at: string;
}
