"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { getSupabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";
import type {
  Ambassador,
  AmbassadorCoupon,
  AmbassadorLifecycle,
  AmbassadorTier,
  Payout,
  SampleShipment,
  SampleShipmentStatus,
} from "@/lib/types";

const SHIPMENT_STATUSES: SampleShipmentStatus[] = [
  "Planned",
  "Ready",
  "Shipped",
  "Delivered",
  "Followed up",
];

// Ambassador detail: UpPromote-owned facts (status, link, coupons, money)
// plus the CRM-owned relationship side (tier, lifecycle, notes, contact link).

const TIERS: AmbassadorTier[] = ["Ambassador", "Islander", "Founding Circle"];
const LIFECYCLES: AmbassadorLifecycle[] = [
  "Prospect",
  "Contacted",
  "Invited",
  "Applied",
  "Approved",
  "Onboarding",
  "Activated",
  "At risk",
  "Inactive",
  "Declined",
];

export default function AmbassadorDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { session } = useAuth();
  const [amb, setAmb] = useState<Ambassador | null>(null);
  const [coupons, setCoupons] = useState<AmbassadorCoupon[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [shipments, setShipments] = useState<SampleShipment[]>([]);
  const [posts, setPosts] = useState<{ id: string; platform: string; url: string; created_at: string }[]>([]);
  const [postUrl, setPostUrl] = useState("");
  const [postPlatform, setPostPlatform] = useState("TikTok");
  const [newQty, setNewQty] = useState(1);
  const [contactName, setContactName] = useState("");
  const [notesDraft, setNotesDraft] = useState("");
  const [saved, setSaved] = useState("");
  const [linkSearch, setLinkSearch] = useState("");
  const [linkResults, setLinkResults] = useState<{ id: string; name: string; email: string }[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const sb = getSupabase();
    if (!sb) return;
    const { data } = await sb.from("ambassadors").select("*").eq("id", params.id).maybeSingle();
    if (!data) return;
    const a = data as Ambassador;
    setAmb(a);
    setNotesDraft(a.notes);
    const [{ data: cps }, { data: pays }] = await Promise.all([
      sb.from("ambassador_coupons").select("*").eq("ambassador_id", a.id),
      sb.from("payouts").select("*").eq("ambassador_id", a.id).order("paid_at", { ascending: false }),
    ]);
    setCoupons((cps as AmbassadorCoupon[]) ?? []);
    setPayouts((pays as Payout[]) ?? []);
    if (a.contact_id) {
      const { data: c } = await sb.from("contacts").select("name").eq("id", a.contact_id).maybeSingle();
      setContactName((c?.name as string) ?? "");
      const { data: ships } = await sb
        .from("sample_shipments")
        .select("*")
        .eq("contact_id", a.contact_id)
        .order("created_at", { ascending: false });
      setShipments((ships as SampleShipment[]) ?? []);
      const { data: cp } = await sb
        .from("content_posts")
        .select("id, platform, url, created_at")
        .eq("contact_id", a.contact_id)
        .order("created_at", { ascending: false });
      setPosts((cp as { id: string; platform: string; url: string; created_at: string }[]) ?? []);
    }
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const update = useCallback(
    async (patch: Partial<Ambassador>, message = "Saved") => {
      const sb = getSupabase();
      if (!sb || !amb) return;
      const { error } = await sb
        .from("ambassadors")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", amb.id);
      if (!error) {
        setAmb({ ...amb, ...patch } as Ambassador);
        setSaved(message);
        setTimeout(() => setSaved(""), 2000);
      }
    },
    [amb]
  );

  const searchContacts = useCallback(async (q: string) => {
    setLinkSearch(q);
    const sb = getSupabase();
    if (!sb || q.trim().length < 2) {
      setLinkResults([]);
      return;
    }
    const { data } = await sb
      .from("contacts")
      .select("id, name, email")
      .or(`name.ilike.%${q.trim()}%,email.ilike.%${q.trim()}%`)
      .limit(5);
    setLinkResults((data as { id: string; name: string; email: string }[]) ?? []);
  }, []);

  const linkContact = useCallback(
    async (contactId: string, name: string) => {
      const sb = getSupabase();
      if (!sb || !amb) return;
      setBusy(true);
      await sb.from("contacts").update({ ambassador_signup: true }).eq("id", contactId);
      await update({ contact_id: contactId }, "Linked");
      setContactName(name);
      setLinkResults([]);
      setLinkSearch("");
      setBusy(false);
    },
    [amb, update]
  );

  const createContact = useCallback(async () => {
    const sb = getSupabase();
    if (!sb || !amb) return;
    setBusy(true);
    const ts = new Date().toISOString();
    const name = `${amb.first_name} ${amb.last_name}`.trim() || amb.email;
    const { data, error } = await sb
      .from("contacts")
      .insert({
        name,
        email: amb.email,
        instagram: amb.instagram,
        tiktok: amb.tiktok,
        contact_type: "Ambassador",
        status: "Ambassador Signed Up",
        source: "UpPromote",
        outreach_status: "Not contacted",
        ambassador_signup: true,
        discount_code: coupons[0]?.code ?? "",
        created_at: ts,
        updated_at: ts,
      })
      .select("id")
      .single();
    if (!error && data) {
      await update({ contact_id: data.id as string }, "Contact created");
      setContactName(name);
    }
    setBusy(false);
  }, [amb, coupons, update]);

  const addShipment = useCallback(async () => {
    const sb = getSupabase();
    if (!sb || !amb?.contact_id) return;
    const { data, error } = await sb
      .from("sample_shipments")
      .insert({ contact_id: amb.contact_id, quantity: Math.max(1, newQty), status: "Planned" })
      .select("*")
      .single();
    if (!error && data) {
      setShipments((prev) => [data as SampleShipment, ...prev]);
      setNewQty(1);
      setSaved("Shipment planned");
      setTimeout(() => setSaved(""), 2000);
    }
  }, [amb, newQty]);

  const updateShipment = useCallback(async (id: string, patch: Partial<SampleShipment>) => {
    const sb = getSupabase();
    if (!sb) return;
    const stamps: Partial<SampleShipment> = { ...patch, updated_at: new Date().toISOString() };
    if (patch.status === "Shipped") stamps.shipped_at = new Date().toISOString().slice(0, 10);
    if (patch.status === "Delivered") stamps.delivered_at = new Date().toISOString().slice(0, 10);
    const { error } = await sb.from("sample_shipments").update(stamps).eq("id", id);
    if (!error) {
      setShipments((prev) => prev.map((sh) => (sh.id === id ? { ...sh, ...stamps } : sh)));
      // Delivered bottles start the content clock: drop a follow-up task on
      // the Today view so nobody's free bottle goes quiet.
      if (patch.status === "Delivered" && amb?.contact_id) {
        const due = new Date();
        due.setDate(due.getDate() + 3);
        const who = `${amb.first_name} ${amb.last_name}`.trim() || amb.email;
        await sb.from("tasks").insert({
          title: `Follow up with ${who} — bottles delivered, content posted?`,
          notes: "Free ambassador bottle delivered. Check in, ask how they like it, nudge the first post.",
          due_date: due.toISOString().slice(0, 10),
          contact_id: amb.contact_id,
        });
        setSaved("Delivered — follow-up task created");
        setTimeout(() => setSaved(""), 2500);
      }
    }
  }, [amb]);

  const pullShopify = useCallback(async () => {
    if (!session?.access_token || !amb) return;
    setBusy(true);
    try {
      const res = await fetch("/api/shopify/pull", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ambassador_id: amb.id }),
      });
      const body = (await res.json()) as { error?: string; found?: boolean; order?: string; status?: string; message?: string };
      setSaved(
        body.error ?? (body.found ? `Shopify: ${body.order} → ${body.status}` : body.message ?? "No match")
      );
      setTimeout(() => setSaved(""), 3500);
      await load();
    } finally {
      setBusy(false);
    }
  }, [session, amb, load]);

  const logContent = useCallback(async () => {
    const sb = getSupabase();
    if (!sb || !amb?.contact_id || !postUrl.trim()) return;
    const { data, error } = await sb
      .from("content_posts")
      .insert({
        contact_id: amb.contact_id,
        platform: postPlatform,
        url: postUrl.trim(),
        posted_at: new Date().toISOString().slice(0, 10),
      })
      .select("id, platform, url, created_at")
      .single();
    if (!error && data) {
      setPosts((prev) => [data as { id: string; platform: string; url: string; created_at: string }, ...prev]);
      setPostUrl("");
      // Mark their most recent delivered shipment as content-received.
      const delivered = shipments.find((sh) => sh.status === "Delivered" || sh.status === "Followed up");
      if (delivered && !delivered.content_received) {
        await sb.from("sample_shipments").update({ content_received: true }).eq("id", delivered.id);
        setShipments((prev) => prev.map((sh) => (sh.id === delivered.id ? { ...sh, content_received: true } : sh)));
      }
      setSaved("Content logged");
      setTimeout(() => setSaved(""), 2000);
    }
  }, [amb, postUrl, postPlatform, shipments]);

  if (!amb) {
    return (
      <div className="min-h-dvh">
        <PageHeader title="Ambassador" />
        <p className="px-4 py-6 text-sm text-taupe-500 sm:px-6">Loading…</p>
      </div>
    );
  }

  const name = `${amb.first_name} ${amb.last_name}`.trim() || amb.email || "Ambassador";

  return (
    <div className="min-h-dvh pb-24 md:pb-8">
      <PageHeader
        title={name}
        subtitle={amb.email}
        action={
          <button
            onClick={() => router.push("/ambassadors")}
            className="rounded-xl px-3 py-2 text-xs font-semibold text-taupe-600 ring-1 ring-night-900/10 hover:bg-night-900/[0.04]"
          >
            ← Roster
          </button>
        }
      />

      <div className="space-y-4 px-4 py-4 sm:px-6">
        {saved && (
          <p className="rounded-xl bg-sage-500/10 px-3 py-2 text-sm font-semibold text-sage-600 ring-1 ring-sage-500/20">
            {saved} ✓
          </p>
        )}

        {/* UpPromote facts */}
        <section className="rounded-2xl bg-cream-50 p-4 ring-1 ring-night-900/5">
          <div className="flex flex-wrap items-center gap-2">
            <Chip
              text={amb.uppromote_status || "unknown"}
              tone={
                amb.uppromote_status === "active"
                  ? "sage"
                  : amb.uppromote_status === "pending"
                    ? "gold"
                    : "muted"
              }
            />
            {amb.program_name && <Chip text={amb.program_name} tone="muted" />}
            {amb.email_verified === false && <Chip text="email unverified" tone="rose" />}
            {amb.w9_on_file && <Chip text="W-9 on file" tone="muted" />}
          </div>
          {amb.referral_link && (
            <div className="mt-3 flex items-center gap-2">
              <p className="min-w-0 flex-1 truncate text-sm text-taupe-600">{amb.referral_link}</p>
              <button
                onClick={() => {
                  void navigator.clipboard.writeText(amb.referral_link);
                  setSaved("Link copied");
                  setTimeout(() => setSaved(""), 2000);
                }}
                className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-gold-700 ring-1 ring-gold-400/30 hover:bg-gold-400/10"
              >
                Copy link
              </button>
            </div>
          )}
          {coupons.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {coupons.map((c) => (
                <span
                  key={c.id}
                  className="rounded-lg bg-gold-400/10 px-2.5 py-1 font-mono text-xs font-bold text-gold-700 ring-1 ring-gold-400/25"
                >
                  {c.code}
                  {c.discount ? ` · ${c.discount}` : ""}
                </span>
              ))}
            </div>
          )}
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Money label="Revenue" value={amb.total_revenue} />
            <Money label="Commission" value={amb.total_commission} />
            <Money label="Unpaid" value={amb.unpaid_commission} />
            <div className="rounded-xl bg-cream-100 p-3 ring-1 ring-night-900/5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-taupe-500">
                Referrals
              </p>
              <p className="mt-0.5 text-lg font-bold tabular-nums">{amb.total_referrals}</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-taupe-400">
            Synced from UpPromote{amb.last_synced_at ? ` · ${amb.last_synced_at.slice(0, 16).replace("T", " ")}` : ""} — sales &amp; commission are UpPromote&rsquo;s numbers.
          </p>
        </section>

        {/* CRM-owned relationship */}
        <section className="rounded-2xl bg-cream-50 p-4 ring-1 ring-night-900/5">
          <h2 className="text-xs font-bold uppercase tracking-wide text-taupe-500">
            Relationship (yours)
          </h2>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold text-taupe-600">Tier</span>
              <select
                value={amb.tier}
                onChange={(e) => void update({ tier: e.target.value as AmbassadorTier })}
                className="input mt-1 w-full"
              >
                {TIERS.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-taupe-600">Lifecycle</span>
              <select
                value={amb.lifecycle}
                onChange={(e) => void update({ lifecycle: e.target.value as AmbassadorLifecycle })}
                className="input mt-1 w-full"
              >
                {LIFECYCLES.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="mt-3 block">
            <span className="text-xs font-semibold text-taupe-600">Notes</span>
            <textarea
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              onBlur={() => {
                if (notesDraft !== amb.notes) void update({ notes: notesDraft }, "Notes saved");
              }}
              rows={3}
              className="input mt-1 w-full"
              placeholder="How you met, what they care about, next move…"
            />
          </label>
        </section>

        {/* Contact link */}
        <section className="rounded-2xl bg-cream-50 p-4 ring-1 ring-night-900/5">
          <h2 className="text-xs font-bold uppercase tracking-wide text-taupe-500">CRM contact</h2>
          {amb.contact_id ? (
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="text-sm text-taupe-600">
                Linked to <span className="font-semibold text-night-800">{contactName || "contact"}</span>
              </p>
              <Link
                href={`/contacts/${amb.contact_id}`}
                className="btn-gold rounded-xl px-3 py-2 text-xs font-semibold"
              >
                Open contact →
              </Link>
            </div>
          ) : (
            <div className="mt-2 space-y-2">
              <p className="text-sm text-taupe-600">
                Not linked yet — connect them to a contact so bottles, follow-ups, and the timeline
                live in one place.
              </p>
              <input
                value={linkSearch}
                onChange={(e) => void searchContacts(e.target.value)}
                placeholder="Search contacts by name or email…"
                className="input w-full"
              />
              {linkResults.map((r) => (
                <button
                  key={r.id}
                  disabled={busy}
                  onClick={() => void linkContact(r.id, r.name)}
                  className="block w-full rounded-xl px-3 py-2 text-left text-sm ring-1 ring-night-900/10 hover:bg-gold-400/10"
                >
                  <span className="font-semibold">{r.name}</span>
                  {r.email && <span className="text-taupe-500"> · {r.email}</span>}
                </button>
              ))}
              <button
                disabled={busy}
                onClick={() => void createContact()}
                className="btn-gold rounded-xl px-3 py-2 text-xs font-semibold disabled:opacity-50"
              >
                {busy ? "Working…" : `＋ Create contact for ${name}`}
              </button>
            </div>
          )}
        </section>

        {/* Gifting */}
        <section className="rounded-2xl bg-cream-50 p-4 ring-1 ring-night-900/5">
          <h2 className="text-xs font-bold uppercase tracking-wide text-taupe-500">
            Bottles &amp; gifting
          </h2>
          {!amb.contact_id ? (
            <p className="mt-2 text-sm text-taupe-600">
              Link or create their CRM contact above first — every bottle ships against a contact
              so the attribution trail stays intact.
            </p>
          ) : (
            <>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  value={newQty}
                  onChange={(e) => setNewQty(Number(e.target.value) || 1)}
                  className="input w-20"
                  aria-label="Bottles to send"
                />
                <button
                  onClick={() => void addShipment()}
                  className="btn-gold rounded-xl px-3 py-2 text-xs font-semibold"
                >
                  ＋ Plan shipment
                </button>
                <button
                  onClick={() => void pullShopify()}
                  disabled={busy}
                  className="rounded-xl px-3 py-2 text-xs font-semibold text-taupe-600 ring-1 ring-night-900/10 hover:bg-night-900/[0.04] disabled:opacity-50"
                >
                  {busy ? "Working…" : "⇩ Pull from Shopify"}
                </button>
              </div>
              {shipments.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {shipments.map((sh) => (
                    <li
                      key={sh.id}
                      className="flex flex-wrap items-center gap-2 rounded-xl bg-cream-100 px-3 py-2 ring-1 ring-night-900/5"
                    >
                      <span className="text-sm font-semibold tabular-nums">
                        {sh.quantity} bottle{sh.quantity === 1 ? "" : "s"}
                      </span>
                      <select
                        value={sh.status}
                        onChange={(e) =>
                          void updateShipment(sh.id, {
                            status: e.target.value as SampleShipmentStatus,
                          })
                        }
                        className="input px-2 py-1 text-xs"
                      >
                        {SHIPMENT_STATUSES.map((st) => (
                          <option key={st}>{st}</option>
                        ))}
                      </select>
                      <input
                        defaultValue={sh.tracking_number}
                        placeholder="Tracking #"
                        onBlur={(e) => {
                          if (e.target.value !== sh.tracking_number)
                            void updateShipment(sh.id, { tracking_number: e.target.value });
                        }}
                        className="input min-w-0 flex-1 px-2 py-1 text-xs"
                      />
                      <span className="text-xs text-taupe-400">
                        {sh.delivered_at || sh.shipped_at || sh.created_at.slice(0, 10)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>

        {/* Content */}
        <section className="rounded-2xl bg-cream-50 p-4 ring-1 ring-night-900/5">
          <h2 className="text-xs font-bold uppercase tracking-wide text-taupe-500">Content</h2>
          {!amb.contact_id ? (
            <p className="mt-2 text-sm text-taupe-600">Link their CRM contact first to log content.</p>
          ) : (
            <>
              <div className="mt-2 flex items-center gap-2">
                <select
                  value={postPlatform}
                  onChange={(e) => setPostPlatform(e.target.value)}
                  className="input w-28 px-2 py-2 text-xs"
                >
                  {["TikTok", "Instagram", "YouTube", "Other"].map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
                <input
                  value={postUrl}
                  onChange={(e) => setPostUrl(e.target.value)}
                  placeholder="Paste the post URL…"
                  className="input min-w-0 flex-1"
                />
                <button
                  onClick={() => void logContent()}
                  disabled={!postUrl.trim()}
                  className="btn-gold rounded-xl px-3 py-2 text-xs font-semibold disabled:opacity-50"
                >
                  ＋ Log
                </button>
              </div>
              {posts.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {posts.map((p) => (
                    <li key={p.id} className="flex items-center gap-2 text-sm">
                      <span className="w-20 shrink-0 text-xs font-semibold text-taupe-500">{p.platform}</span>
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noreferrer"
                        className="min-w-0 flex-1 truncate text-gold-700 hover:underline"
                      >
                        {p.url}
                      </a>
                      <span className="text-xs text-taupe-400">{p.created_at.slice(0, 10)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>

        {/* Payout history */}
        {payouts.length > 0 && (
          <section className="rounded-2xl bg-cream-50 p-4 ring-1 ring-night-900/5">
            <h2 className="text-xs font-bold uppercase tracking-wide text-taupe-500">Payouts</h2>
            <ul className="mt-2 space-y-1.5">
              {payouts.map((p) => (
                <li key={p.id} className="flex items-center justify-between text-sm">
                  <span className="text-taupe-600">
                    {p.paid_at ? p.paid_at.slice(0, 10) : "—"} · {p.method || "—"}
                  </span>
                  <span className="font-semibold tabular-nums">${Number(p.amount).toFixed(2)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

function Chip({ text, tone }: { text: string; tone: "sage" | "gold" | "rose" | "muted" }) {
  const cls =
    tone === "sage"
      ? "bg-sage-500/10 text-sage-600 ring-sage-500/20"
      : tone === "gold"
        ? "bg-gold-400/15 text-gold-700 ring-gold-400/20"
        : tone === "rose"
          ? "bg-rose-500/10 text-rose-500 ring-rose-500/20"
          : "bg-night-900/[0.04] text-taupe-600 ring-night-900/10";
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${cls}`}>{text}</span>
  );
}

function Money({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-cream-100 p-3 ring-1 ring-night-900/5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-taupe-500">{label}</p>
      <p className="mt-0.5 text-lg font-bold tabular-nums">${Number(value).toFixed(2)}</p>
    </div>
  );
}
