# 🍶 NuKava CRM

A clean, mobile-first personal CRM built for **NuKava relationships and bottle gifting** —
think *Airtable + Apple Notes + a simple sales CRM*. Track creators, ambassadors,
agencies, friends, retailers, event contacts and wholesale leads; manage who gets a
NuKava bottle; and never miss a follow-up.

Built with **Next.js + TypeScript + Tailwind CSS + Supabase**, installable on your
phone as an app (PWA), with **CSV import/export** and **JSON backups**.

---

## ✨ What it does

- **Dashboard** — the numbers that matter, *Today's Follow-Ups*, *Ready to Ship*, and *Missing Address* sections.
- **Contacts** — Airtable-style **table view** with **inline editing** and **sortable columns**, plus a phone-friendly **card view**.
- **Deals pipeline** — a **B2B/partnership deal-flow board** (Lead → Contacted → Qualified → Meeting → Proposal → Negotiation → Won/Lost) with pipeline value, weighted forecast, win rate, per-deal activity log, and next-step tracking. Move stages with a tap.
- **Outreach toolkit** — ready-to-send **B2B and ambassador** message templates that auto-fill with a contact's or deal's details (one-tap copy), plus optional **AI-personalized drafting**.
- **Saved views** — All, Hot Leads, Kava Giveaway List, Ready to Send, Missing Address, Bottles Sent, Needs Follow-Up, Creators, Agencies, Ambassadors, Wholesale/Retail, Utah Contacts.
- **Search & filters** — search by name, handle, city, status or notes; filter chips for type, status, priority and "bottle sent?".
- **Contact profiles** — full info, social links, bottle/shipping details, follow-up reminders, and an **interaction timeline**.
- **Interaction logging** — Texted, Called, DM'd, Met in person, Sent bottle, Followed up, Posted content, Signed up as ambassador — each with a date, notes and a "next action".
- **Bottle Sending dashboard** — approved count, bottles to ship, bottles sent, who's missing an address, high-priority first.
- **Quick actions everywhere** — ✅ Approve for bottles · 📦 Mark bottle sent · 🔔 Add follow-up · 📝 Add note.
- **Status & priority color badges** throughout.
- **Import / Export** — import creator-list CSVs (smart header matching), export CSV, and download full JSON backups.
- **Private login** — when cloud sync is on, the app is protected behind an email/password account (on-device mode stays login-free).
- **Daily reminder emails** (optional) — a once-a-day digest of due follow-ups, ready-to-ship bottles and missing addresses, sent via a scheduled job.
- **Installable PWA** — add it to your iPhone/Android home screen and it opens like a native app.

---

## 🚀 Run it on your computer (5 minutes)

You'll need [Node.js](https://nodejs.org) (version 18 or newer) installed.

```bash
npm install
npm run dev
```

Open **http://localhost:3000**. That's it — the app starts in **on-device mode** with
10 sample NuKava contacts so you can play with everything immediately. No accounts,
no cloud, no setup.

> In on-device mode your data is stored privately in that browser. To move it to
> another device, use **Import / Export** to download a backup and re-import it.

---

## ☁️ Turn on cloud sync (so your phone and computer share data)

This is optional but recommended — it's free and gives you the same data on every device.

1. Create a free account at **[supabase.com](https://supabase.com)** and make a new project.
2. In the project, open the **SQL Editor**, paste the entire contents of
   [`supabase/schema.sql`](./supabase/schema.sql), and click **Run**.
   This creates the `contacts` and `interactions` tables and adds the sample data.
3. In Supabase, go to **Project Settings → API** and copy:
   - **Project URL**
   - **anon public** key
4. In this project, copy `.env.example` to a new file called `.env.local` and fill it in:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```
5. Restart the app (`npm run dev`). You'll now see a **login screen** — click
   *Create one*, sign up with your email + a password, and you're in. The sidebar
   will say **"Cloud sync on"** and your data lives in Supabase, private to your login.
6. **Lock the door (one-time):** in Supabase go to **Authentication → Providers →
   Email** and turn **off** "Allow new users to sign up" after you've created your
   account. Now only you can log in.

> **How security works:** cloud data is protected by Row Level Security — nobody can
> read or write it without signing in. On-device mode has no login (the data never
> leaves your browser). If you ever want each account to see only its own data,
> `schema.sql` has a ready-to-paste "per-user isolation" block at the bottom.

---

## 👥 Adding teammates / admins (shared workspace)

NuKava CRM is a **shared workspace**: every logged-in account sees and edits the same
contacts, deals, and activity. That's exactly what a small admin team wants. To add
someone (e.g. Fine or another admin):

1. **Keep public sign-ups OFF** — Authentication → Providers → Email → "Allow new
   users to sign up" = off. This stops anyone with the URL from registering.
2. **Add each admin yourself** — Authentication → **Users** → **Add user** → enter
   their email + a temporary password (or send an invite).
3. They log in at your app URL and immediately see the same shared data.
4. Use the **"Owner / assigned to"** field on every contact and deal to track who's
   responsible for what.

**Notes:**
- Every admin has full access (view / edit / delete everything) — right for a trusted team.
- Want **private per-person data** or **view-only roles**? That's a larger feature.
  `schema.sql` includes a per-user isolation starting point, and roles can be layered on.

---

## 📱 Put it on your phone (deploy free with Vercel)

1. Push this repo to GitHub (already done if you're reading this there).
2. Go to **[vercel.com](https://vercel.com)**, sign in with GitHub, and click
   **Add New → Project**, then pick this repository.
3. If you set up Supabase, add the two environment variables from above in Vercel's
   **Environment Variables** step. (Skip this to deploy in on-device mode.)
4. Click **Deploy**. Vercel gives you a public URL like `nukava-crm.vercel.app`.
5. On your phone, open that URL in Safari (iPhone) or Chrome (Android):
   - **iPhone:** tap **Share → Add to Home Screen**.
   - **Android:** tap the **⋮ menu → Install app / Add to Home screen**.

Now NuKava CRM has its own icon on your home screen and opens full-screen like a real app. 🎉

---

## 📧 Daily follow-up reminder emails (optional)

Get a once-a-day email digest of everyone whose follow-up is **due or overdue**, plus
who's **ready to ship** and who's **missing an address**. Requires cloud mode (Supabase)
+ a free [Resend](https://resend.com) account, and a Vercel deployment (Vercel runs the
daily schedule for you — see [`vercel.json`](./vercel.json)).

1. Sign up at **[resend.com](https://resend.com)** and create an **API key**.
   - To send to any address you must verify a domain. To just test it quickly, the
     default sender (`onboarding@resend.dev`) delivers to the email on your Resend account.
2. In **Vercel → your project → Settings → Environment Variables**, add:
   | Variable | Value |
   |---|---|
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → **service_role** key (secret) |
   | `RESEND_API_KEY` | your Resend API key |
   | `REMINDER_EMAIL_TO` | the email that should receive reminders |
   | `REMINDER_EMAIL_FROM` | leave default, or `NuKava <you@yourdomain.com>` if verified |
   | `CRON_SECRET` | any long random string (protects the endpoint) |
   | `NEXT_PUBLIC_APP_URL` | your app URL, e.g. `https://nukava.vercel.app` |
3. **Redeploy.** Vercel will hit `/api/reminders` every day at **15:00 UTC** (~8–9am Mountain).
   Change the time by editing the `schedule` in `vercel.json` ([cron syntax](https://crontab.guru)).
4. **Test it now:** visit `https://YOUR-APP.vercel.app/api/reminders?key=YOUR_CRON_SECRET`.
   You'll get a JSON result and (if anything is due) an email. Empty days send nothing.

---

## ✨ AI-personalized outreach (optional)

The **Outreach** tab works out of the box with built-in templates. To also draft
custom, personalized messages with AI:

1. Get an API key from **[console.anthropic.com](https://console.anthropic.com)**.
2. Add it to Vercel (or `.env.local`) as `ANTHROPIC_API_KEY` (server-only — keep it secret).
   Optionally set `OUTREACH_MODEL` to override the default model.
3. Redeploy. The Outreach tab's **Generate with AI** button is now live. Without the key,
   the button is disabled and templates still work.

---

## 🤝 Deal-flow workflow

1. Add a **deal** (company, type, value, expected close) from the **Deals** tab.
2. Work it across the **pipeline board** — tap a card's stage dropdown to advance it
   (Lead → … → Won/Lost). The dashboard tallies pipeline value, weighted forecast, and win rate.
3. Log calls, emails, meetings, and proposals on the **deal detail page**; the latest
   "next step" stays in sync and overdue steps are flagged.
4. Use the **Outreach** tab to message the deal's contact — pick a template (it auto-fills
   their name/company/handle) or generate a tailored message with AI, then copy and send.

---

## 🗂️ Daily workflow

1. **Add** a contact (the big **+ Add** button on the Dashboard or Contacts).
2. Set their **type** (creator, ambassador, agency, friend, retailer, event, wholesale).
3. When they should get product, hit **✅ Approve** — it flags them as a recipient and
   asks for an address if one's missing.
4. Add the **shipping address** (edit the contact), then it shows in **Ready to Ship**.
5. Hit **📦 Sent** to mark the bottle sent (logs the date + an interaction).
6. Add the **tracking number** on the profile.
7. After delivery, hit **🔔 Follow-up** to set a reminder — it appears on the Dashboard.
8. Log what happens (**📝 Note**) and mark **posted content / ambassador / sales** on the profile.

---

## 📥 Importing your existing creator lists

Go to **Import / Export → Import** and upload a CSV. Headers like
`name, instagram, phone, email, city, state, contact_type, followers, notes`
are matched automatically. The only required column is **name**. There's a copy-paste
template on that page.

---

## 🧱 Project structure

```
src/
  app/
    page.tsx              Dashboard
    contacts/page.tsx     Table + card views, search, filters, saved views
    contacts/[id]/page.tsx Contact profile + interaction timeline
    bottles/page.tsx      Bottle-sending dashboard
    deals/page.tsx        Deal pipeline board + list + metrics
    deals/[id]/page.tsx   Deal detail + activity log
    outreach/page.tsx     Outreach templates + AI drafting
    data/page.tsx         Import / export / backup
    api/reminders/route.ts Daily follow-up reminder email (Vercel Cron)
    api/outreach/route.ts  Optional AI outreach drafting (Anthropic)
  components/             UI: nav, badges, forms, table, cards, quick actions
  lib/
    types.ts              Data model
    constants.ts          Dropdown options + badge colors
    data.ts               Data layer (auto: Supabase OR on-device)
    supabase.ts           Supabase client
    csv.ts                CSV parse/export + JSON backup
    views.ts              Saved-view definitions + search
    seed.ts               Sample contacts (on-device mode)
    helpers.ts            Dates, formatting, small utilities
supabase/schema.sql       Database schema + seed (paste into Supabase)
vercel.json               Daily cron schedule for reminder emails
public/                   PWA manifest, service worker, app icons
```

## 🔧 Tech

Next.js 14 (App Router) · TypeScript · Tailwind CSS · Supabase · PWA (manifest + service worker).

## 💡 Ideas for later

- SMS reminders (in addition to email)
- Bulk actions and CSV column-mapping UI
- Photo attachments and tags
