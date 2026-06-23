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
  created_at: string;
  updated_at: string;
}

export interface Interaction {
  id: string;
  contact_id: string;
  date: string; // YYYY-MM-DD
  type: InteractionType;
  notes: string;
  next_action: string;
  created_at: string;
}

export type NewContact = Omit<Contact, "id" | "created_at" | "updated_at">;
export type NewInteraction = Omit<Interaction, "id" | "created_at">;
