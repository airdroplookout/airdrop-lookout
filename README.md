# Airdrop Lookout — Portable version

Own-it-yourself build of Airdrop Lookout. Not a Muse artifact. Take these files to
any host that can run them — the recommended route is below.

## What it is

Weekly crypto airdrop newsletter. **$5/week in USDT, free first month.**
Privacy-first: **we never ask readers for a wallet address.** Readers check
their own eligibility. USDT payment is manual: the reader pays to Adil's
address, emails the transaction ID, Adil marks them paid in Manage.

## Recommended stack (researched 22 Nov 2026, USD, before tax)

| Piece | Service | Cost |
|---|---|---|
| Domain | Porkbun, `airdroplookout.com` (confirmed 22 Nov 2026) | ~$11.81/year |
| Hosting | Cloudflare Pages (free) | $0 |
| Database | Supabase Pro — real Postgres, never pauses | $25/month |
| Sending | Brevo Free — 300 emails/day, then Starter $9/month | $0 to start |
| **First year** | | **~$311.81** |

Why not Vercel free: Vercel Hobby is personal, non-commercial use only, and
Airdrop Lookout charges $5/week, so it is commercial — Pro would be $20/month.
Why not Beehiiv: it has its own database and templates; the custom airdrop
board, trust scores, tick-off steps and USDT ledger would not survive the move.
Budget alternative: Hostinger VPS + PocketBase, ~$72–$132 in year 1, but with
no managed backups — you run, back up and update it yourself.

## What's in this folder

```
public/                 Front-end (signup, board, issue, Safety, pricing, Manage)
  index.html            Single-page app
  app.js                All client logic, calls /api/*
  styles.css            Deep navy / charcoal, teal accent (same look as Muse site)
functions/              Cloudflare Pages Functions (server code, Node-style)
  api/subscribe.js      Public signup (email only)
  api/unsubscribe.js    Public unsubscribe
  api/board.js          Public board + latest published issue + settings
  api/settings.js       Public payment settings (wallet address, network)
  api/admin/*.js        Owner-only API, guarded by ADMIN_API_KEY
  _lib.js               Shared Supabase / Brevo / auth helpers
supabase/schema.sql     Creates the 5 tables + RLS policies
supabase/seed.sql       Issue 1 + its 7 drops (real, checked 22 Nov 2026)
content/issue-1.json    Issue 1 as structured data (same content as the 7-page PDF)
.env.example            Every secret needed — copy to .env / dashboard, never commit real values
DEPLOY.md               Step-by-step deploy + weekly auto-send setup for Dexter (Muse)
TEST_PLAN.md            Test with 1 test subscriber before going live
scripts/weekly-issue.mjs  Reference script a Muse scheduled job can run via the admin API
```

## The 5 tables

`subscribers` (email, status free_trial/paid/unsubscribed, free_trial_ends_at,
paid_until, txid, notes), `issues` (title, week_label, intro, safety_tip,
status draft/published, published_at), `airdrops` (name, token, chain, effort,
deadline_at, status draft_review/active/expired/archived, eligibility, steps,
source_url, verified, trust_score), `issue_airdrops` (issue ↔ airdrop links),
`payments` (subscriber email, amount_usdt, txid, network, verified),
`settings` (key/value: usdt_wallet_address, usdt_network, notification_email,
telegram_link).

## Automatic weekly sending — the key requirement

Adil confirmed: **Dexter (Muse) creates the newsletter each week and sends it
to all subscribers automatically, without Adil uploading anything or
intervening.** That is built in, not bolted on:

1. A Muse scheduled job (weekly, Monday ~09:00 Toronto — see DEPLOY.md)
   researches live airdrops, verifies deadlines on the source pages, and
   writes the issue.
2. It calls the admin API with `ADMIN_API_KEY`:
   `POST /api/admin/issues` → create draft → `POST /api/admin/issues/:id/publish`
   → `GET /api/admin/issues/:id/preview` → `POST /api/admin/issues/:id/send`
3. The send endpoint fetches every active subscriber from Supabase, sends
   **one individual email each via Brevo** (nobody sees anyone else's address),
   with an unsubscribe footer, and records the result in `sends` (logged in
   the `issues` row + a send log returned by the API).
4. Nothing publishes unchecked by that research step. If no verified drops
   are found, or a deadline cannot be verified, the job must NOT send — it
   reports back to Adil instead.

How to revoke: change `ADMIN_API_KEY` in the Cloudflare Pages dashboard
(Settings → Variables) and in the Muse job. Old keys stop working immediately.
See DEPLOY.md § "Weekly auto-send setup" for the exact job body and key handling.

A manual fallback is also kept: **Manage → Issues → Upload newsletter**
(upload a .txt/.md/.pdf — text is extracted for .txt/.md; .pdf is stored and
its text must be pasted, see DEPLOY.md) and the **Send to all subscribers**
card with preview + recipient count.

## Placeholders — nothing invented

- Domain: `airdroplookout.com` — confirmed 22 Nov 2026 (renamed from the
  `airdropwatch.com` placeholder, which was already taken). Change it once
  in `public/config.js` (`SITE_DOMAIN`) and in Cloudflare/Brevo settings
  if it ever changes.
- USDT wallet address + network: **blank** in `settings`. Fill in Manage →
  Settings after launch. Never invent an address.
- Notification email, Telegram link: **blank**.
- Issue 1 is real (checked 22 Nov 2026). Later issues are created weekly by
  Dexter — never auto-generated from unverified sources.

## Quick start (local test)

```bash
cp .env.example .env   # fill in Supabase + Brevo values from your dashboards
npm install            # no runtime dependencies; only wrangler for local Pages dev
npx wrangler pages dev public --compatibility-date=2026-11-22
# open http://localhost:8788
```

No real email is sent by this folder as delivered. Sending only happens when
a real `BREVO_API_KEY` is set and the send endpoint is called.
