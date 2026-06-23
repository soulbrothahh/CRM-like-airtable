// Outreach templates for NuKava — B2B (wholesale/retail/distribution/partnership)
// and ambassador/creator outreach. Bodies use {{variables}} filled from a contact,
// a deal, or manual entry.

export type OutreachCategory = "B2B" | "Ambassador";
export type OutreachChannel = "Email" | "DM" | "Text";

export interface OutreachTemplate {
  id: string;
  category: OutreachCategory;
  channel: OutreachChannel;
  label: string;
  subject?: string;
  body: string;
}

export interface OutreachVars {
  first_name?: string;
  name?: string;
  company?: string;
  handle?: string;
  city?: string;
  sender?: string;
}

export const OUTREACH_TEMPLATES: OutreachTemplate[] = [
  // ---------------- B2B ----------------
  {
    id: "b2b-cold-email",
    category: "B2B",
    channel: "Email",
    label: "Cold intro — wholesale/retail",
    subject: "NuKava for {{company}}",
    body: `Hi {{first_name}},

I'm {{sender}} with NuKava — we make a premium kava wellness drink that's building a loyal following with people looking for a natural way to relax and unwind.

I think it could be a great fit for {{company}}'s customers. I'd love to send over a few samples and our wholesale pricing so your team can try it.

Would it be alright if I sent a sample box your way this week?

Thanks,
{{sender}}`,
  },
  {
    id: "b2b-distribution",
    category: "B2B",
    channel: "Email",
    label: "Distributor intro",
    subject: "NuKava — distribution partnership",
    body: `Hi {{first_name}},

I'm {{sender}} from NuKava. We're expanding our retail footprint and looking for the right distribution partner in your region.

NuKava is a premium kava beverage with strong direct-to-consumer traction and repeat purchase rates. I'd love to share our line sheet, margins, and current demand in your area.

Are you open to a quick 15-minute call this week?

Best,
{{sender}}`,
  },
  {
    id: "b2b-followup",
    category: "B2B",
    channel: "Email",
    label: "Follow-up (no reply)",
    subject: "Re: NuKava for {{company}}",
    body: `Hi {{first_name}},

Just floating this back to the top of your inbox. I'd still love to get a few NuKava samples into {{company}}'s hands — no commitment, just want your honest take.

Want me to drop a sample box in the mail?

Thanks,
{{sender}}`,
  },
  {
    id: "b2b-post-sample",
    category: "B2B",
    channel: "Email",
    label: "After samples sent",
    subject: "How were the NuKava samples?",
    body: `Hi {{first_name}},

Hope the NuKava samples landed well! Curious what you and the team thought.

If there's interest, I can put together a starter wholesale order that's easy to trial on your shelves. Happy to work around what makes sense for {{company}}.

Cheers,
{{sender}}`,
  },
  // ---------------- Ambassador ----------------
  {
    id: "amb-dm-intro",
    category: "Ambassador",
    channel: "DM",
    label: "Creator DM — intro",
    body: `Hey {{first_name}}! 🌿 Love what you're putting out on {{handle}}.

I'm {{sender}} with NuKava — a premium kava drink for natural calm + focus. Your audience feels like a perfect match for what we're building.

We'd love to send you some product (on us) to try. If you vibe with it, there's room to partner. Cool if I send a bottle your way?`,
  },
  {
    id: "amb-dm-followup",
    category: "Ambassador",
    channel: "DM",
    label: "Creator DM — follow-up",
    body: `Hey {{first_name}}! Just checking back in 🙌 Still happy to send you a NuKava bottle to try — no strings.

What's the best address to ship to?`,
  },
  {
    id: "amb-offer",
    category: "Ambassador",
    channel: "DM",
    label: "Ambassador offer",
    body: `Hey {{first_name}}! Loved having you try NuKava 🙏

Want to make it official? Our ambassador program includes free product, your own discount code, and commission on every sale you drive. Takes 2 minutes to set up.

Want me to send the details?`,
  },
  {
    id: "amb-reengage",
    category: "Ambassador",
    channel: "DM",
    label: "Re-engage quiet creator",
    body: `Hey {{first_name}}! It's been a minute 🌿 We just refreshed our NuKava lineup and I immediately thought of you.

Want me to send the new flavor over so you can check it out?`,
  },
];

function firstName(name?: string): string {
  if (!name) return "there";
  return name.trim().split(/\s+/)[0] || "there";
}

export function fillTemplate(text: string, vars: OutreachVars): string {
  const map: Record<string, string> = {
    first_name: firstName(vars.name || vars.first_name),
    name: vars.name || vars.first_name || "there",
    company: vars.company || "your team",
    handle: vars.handle || "your page",
    city: vars.city || "your area",
    sender: vars.sender || "the NuKava team",
  };
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) =>
    key in map ? map[key] : ""
  );
}
