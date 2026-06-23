import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

// Optional AI-personalized outreach drafting. Works only if ANTHROPIC_API_KEY is set;
// otherwise returns { configured: false } so the UI falls back to templates.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface OutreachRequest {
  category?: "B2B" | "Ambassador";
  channel?: "Email" | "DM" | "Text";
  goal?: string;
  recipient?: {
    name?: string;
    company?: string;
    handle?: string;
    city?: string;
    contact_type?: string;
    notes?: string;
  };
  sender?: string;
}

export async function GET() {
  return NextResponse.json({ configured: Boolean(process.env.ANTHROPIC_API_KEY) });
}

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ configured: false });
  }

  let body: OutreachRequest;
  try {
    body = (await req.json()) as OutreachRequest;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const {
    category = "B2B",
    channel = "Email",
    goal = "",
    recipient = {},
    sender = "the NuKava team",
  } = body;

  const client = new Anthropic({ apiKey });
  const model = process.env.OUTREACH_MODEL || "claude-opus-4-8";

  const system =
    "You write concise, warm, high-converting outreach for NuKava, a premium kava " +
    "wellness beverage brand. Kava is a natural drink that promotes calm, relaxation, " +
    "and focus. Write in a friendly, genuine, non-spammy voice. Personalize using the " +
    "recipient details provided. Keep it short and skimmable. Return ONLY the message " +
    "text — no preamble, no subject-line label unless writing an email (then put the " +
    "subject on the first line prefixed with 'Subject: ').";

  const audience =
    category === "Ambassador"
      ? "an Instagram/TikTok creator or potential brand ambassador"
      : "a B2B prospect (retailer, distributor, agency, or wholesale buyer)";

  const userPrompt = [
    `Write a ${channel.toLowerCase()} outreach message to ${audience}.`,
    `Sender name/brand: ${sender}.`,
    goal ? `Goal of this message: ${goal}.` : "",
    recipient.name ? `Recipient name: ${recipient.name}.` : "",
    recipient.company ? `Company: ${recipient.company}.` : "",
    recipient.handle ? `Social handle: ${recipient.handle}.` : "",
    recipient.city ? `City: ${recipient.city}.` : "",
    recipient.contact_type ? `Type: ${recipient.contact_type}.` : "",
    recipient.notes ? `Context/notes: ${recipient.notes}.` : "",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const response = await client.messages.create({
      model,
      max_tokens: 1024,
      system,
      messages: [{ role: "user", content: userPrompt }],
    });
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    return NextResponse.json({ configured: true, message: text });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "Generation failed." },
      { status: 502 }
    );
  }
}
