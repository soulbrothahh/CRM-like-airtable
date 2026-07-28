# NuKava Growth OS

The plan and status for expanding the NuKava CRM into a creator, ambassador,
launch, outreach, and market-intelligence operating system — built as connected
modules on one database, one auth system, one design system, and one canonical
contact record.

## Current architecture

- **Next.js 14 App Router + TypeScript + Tailwind** (class-based dark mode,
  CSS-variable palette — the NuKava charcoal/cream brand system).
- **Supabase** (Postgres + email/password auth + RLS) with an on-device
  localStorage fallback when no keys are configured. All tables use a single
  RLS model: any authenticated user has full access; anon is blocked. Server
  jobs use the service-role key (server-side only).
- **Vercel** hosting; two daily crons (`/api/reminders`, `/api/boardroom`).
- **PWA** (installable, offline shell).
- **Existing integrations:** Resend (tracked email), Anthropic (outreach
  drafting + the Boardroom agents), an MCP server at `/api/mcp`, and public
  web-analytics ingestion at `/api/track`.

### The canonical person record

`contacts` is the one person table. Creators, ambassadors, retailers, friends,
and wholesale leads are `contact_type` values plus role-specific fields and
linked tables — never separate copies of a person. The `ambassadors` table
(below) is a role profile that links to a contact, not a second person record.

## Database relationships (Growth OS foundation)

```
contacts ←─ ambassadors ─→ ambassador_coupons
                 │        ─→ referrals   (UpPromote mirror, read-only)
                 │        ─→ payouts     (UpPromote mirror, read-only)
contacts ←─ campaign_members ─→ campaigns
contacts ←─ sample_shipments ─→ campaigns (optional attribution)
contacts ←─ content_posts    ─→ campaigns (optional attribution)
sync_runs / webhook_events / duplicate_review / suppression_entries / audit_logs
```

Migration: `supabase/migrations/2026-07-28-growth-os-foundation.sql`
(also inlined in `supabase/schema.sql` for fresh installs). Additive only —
no existing table or column is modified. RLS is enabled with authenticated
policies on every new table.

## Source-of-truth matrix

| Data | Owner | Direction |
| --- | --- | --- |
| Affiliate status, links, coupons | UpPromote | → CRM |
| Referral sales, commission math | UpPromote | → CRM |
| Payout status | UpPromote | → CRM |
| Lifecycle (Prospect…Inactive) | CRM | never syncs out |
| Tier (Ambassador/Islander/Founding Circle) | CRM | never syncs out |
| Notes, tasks, follow-ups, tags | CRM | never syncs out |
| Sample shipments, content, compliance | CRM | never syncs out |

Sync rules: idempotent upserts on UpPromote ids; nothing deleted; blank
external values never overwrite CRM fields; CRM-owned columns never written by
sync; uncertain email matches go to `duplicate_review` (no auto-merge).

## Modules

1. **Ambassador hub** (`/ambassadors`) — UpPromote-synced roster, sync health,
   dry-run/sync-now controls. Live in Phase 1 (this phase).
2. **Creator Engine** — discovery, fit scoring, pipelines, sample management on
   top of `campaigns` + `sample_shipments` + `content_posts`. Phase 2.
3. **Campaign Copilot** — dynamic segments, automation rules with run logs,
   unified outreach on the existing sequences engine. Phase 3.
4. **Launch Lab** — launch campaigns, cohorts, calculators, review-request
   compliance. Phase 4 (builds on `campaigns`).
5. **Market Signals** — Reddit monitors and intent scoring via official APIs
   only. Phase 5.

## Integration requirements & credentials

| Integration | Env vars | Status |
| --- | --- | --- |
| Supabase | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Connected (live) |
| Resend email | `RESEND_API_KEY`, `EMAIL_FROM` | Connected (live) |
| Anthropic | `ANTHROPIC_API_KEY` | Connected (live) |
| **UpPromote** | `UPPROMOTE_API_KEY`, `UPPROMOTE_API_BASE_URL` (optional), `UPPROMOTE_WEBHOOK_SECRET` (later phase) | **Not Connected** — key required from UpPromote → Settings → Integrations → API & Webhook; API v2 requires a plan with API access |
| Shopify, TikTok Shop, Reddit, SMS, shipping | — | Not started (adapters land with their modules) |

All secrets live in Vercel env vars, server-side only. Never paste a secret
into source code or chat.

### UpPromote adapter (`src/lib/uppromote/`)

- `client.ts` — server-only v2 client: raw-key Authorization header, 15s
  timeout, retry with exponential backoff honoring 429/Retry-After, paged
  fetching that stays under the 120 req/min store limit.
- `map.ts` — defensive field mapping. The v2 docs block automated fetching, so
  accessors check candidate key lists and unmappable rows surface in the
  dry-run report instead of being guessed at. **First live dry run confirms
  the real field names; tighten `map.ts` then.**
- `sync.ts` — backfill engine: affiliates → referrals → payments → coupons →
  contact linking (exact email; ambiguous → `duplicate_review`) → cached
  rollups. Every run recorded in `sync_runs`.
- `fixtures.ts` — obviously-fake demo rows, used only when `?demo=1` AND
  UpPromote is not configured; demo runs never write to the database.

Endpoint: `GET/POST /api/uppromote/sync` (`?dry_run=1`, `?demo=1`). Auth:
Supabase user token or `CRON_SECRET`.

## Feature status

**Completed (this phase)**
- Foundation schema (13 tables) with RLS + indexes
- UpPromote read-only adapter with dry-run and demo modes
- Sync endpoint with auth, run logging, and idempotent upserts
- Ambassadors hub page (roster, stats, sync health, Not-Connected state)
- TypeScript domain types for all new tables

**Mocked / demo**
- UpPromote data (fixtures behind `?demo=1`, labeled, never persisted)

**Blocked (credentials or platform approval required)**
- Live UpPromote sync — needs `UPPROMOTE_API_KEY` (plan-gated)
- UpPromote webhooks — needs `UPPROMOTE_WEBHOOK_SECRET` + subscription setup
- Shopify / TikTok Shop / Reddit integrations — future phases

**Known tech debt**
- `next lint` has never been configured (interactive setup pending)
- No test runner yet; introduce Vitest with fixture tests when the first live
  API responses confirm the mapping (Phase 2 entry task)
- Roles/permissions: all signed-in users are admins (RBAC deferred)
- `/api/track` is public and unthrottled (acceptable for the marketing pixel;
  revisit before external users exist)

## Security decisions

- All UpPromote communication is server-side; the key never reaches the browser.
- Sync endpoint requires a Supabase user token or `CRON_SECRET`.
- W-9 documents and banking details are **never** stored (status booleans only).
- Referred-customer emails are not imported.
- Webhook signature verification (HMAC-SHA256, raw body, constant-time
  compare) is specified for the webhook phase; the `webhook_events` table and
  dedupe index already exist.
- `suppression_entries` and `audit_logs` exist from day one so later
  automation phases have consent and audit rails to build on.

## Compliance decisions

- No review-gating, no compensation conditioned on positive reviews;
  `content_posts` records `ftc_disclosed` and `claims_checked` per post.
- Free/discounted product is recorded via `sample_shipments`.
- No scraping; only official APIs with credentials the platforms issue.

## Testing instructions

1. `npx tsc --noEmit` — type check (passing).
2. `npm run build` — production build (passing).
3. Manual: sign in → Ambassadors tab → "Dry run" (uses demo fixtures until
   UpPromote is connected; verify the run appears under Sync health and
   nothing is written to `ambassadors`).
4. After connecting UpPromote: "Dry run" again → check counts and warnings →
   then "Sync now" → verify roster, contact links, and `duplicate_review`.

## Deployment instructions

1. Run `supabase/migrations/2026-07-28-growth-os-foundation.sql` in the
   Supabase SQL Editor (safe to re-run; additive only).
2. Add `UPPROMOTE_API_KEY` in Vercel → Settings → Environment Variables when
   the key exists. Redeploy.
3. Confirm `CRON_SECRET` is set (also protects the sync endpoint's cron path).

## Next recommended phase

**Phase 2 kickoff:** run the first live dry run against the real UpPromote
account, lock `map.ts` to the confirmed field names, add Vitest fixture tests
for the mapper, then build the ambassador profile tabs (Overview /
Performance / Gifting / Content / Timeline) on the contact page.
