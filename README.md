# Airdrop Lookout — Portable version

Own-it-yourself build of Airdrop Lookout. Not a Muse artifact. Take these files to
any host that can run them — the recommended route is below.

**Hosting switch (22 Nov 2026): this build now deploys on Netlify, not
Cloudflare Pages.** Cloudflare's login verification kept blocking Muse's
browser, so the site was moved. The old Cloudflare code is in the GitHub
repo's history (commit `1eea607`); the live code in this folder is Netlify
only. Supabase, Brevo, the front-end, the admin API and the weekly send flow
are unchanged — only the hosting layer moved.

## What it is

Weekly crypto airdrop newsletter. **$5/week in USDT, free first month.**
Privacy-first: **we never ask readers for a wallet address.** Readers check
their own eligibility. USDT payment is manual: the reader pays to Adil's
address, emails the transaction ID, Adil marks them paid in Manage.

## Recommended stack (researched 22 Nov 2026, USD, before tax)

| Piece | Service | Cost |
|---|---|---|
| Domain | Porkbun, `airdroplookout.com` (confirmed 22 Nov 2026) | ~$11.81/year |
| Hosting | Netlify Free (credit-based, see note below) | $0 |
| Database | Supabase Pro — real Postgres, never pauses | $25/month |
| Sending | Brevo Free — 300 emails/day, then Starter $9/month | $0 to start |
| **First year** | | **~$311.81** |

**Netlify Free — what it actually is (checked 22 Nov 2026):** new Netlify
accounts are on a credit-based Free plan: **300 credits/month, hard limit**.
A production deploy costs 15 credits, bandwidth 20 credits/GB, web requests
2 credits per 10,000, functions are metered as compute (10 credits/GB-hour).
If all 300 credits went on bandwidth that is ~15 GB. **When the credits run
out, Netlify pauses every project on the team until the next monthly cycle**
— no bill, no automatic top-up. That is plenty for launch (a small site uses
a few credits a month), but it is a real ceiling to watch once traffic
grows: if the site ever gets big, the next step is Netlify Personal ($9/month)
or back to Cloudflare Pages. The old figures you may see quoted elsewhere
(100 GB bandwidth, 300 build minutes, 125,000 function calls) are Netlify's
Legacy plan and do not apply to a new account.

Why Netlify and not Vercel free: Vercel Hobby is personal, non-commercial use
only, and Airdrop Lookout charges $5/week, so it is commercial — Pro would be
$20/month. **Netlify Free has no commercial-use restriction** — a paid site
may run on it. Why not Beehiiv: it has its own database and templates; the
custom airdrop board, trust scores, tick-off steps and USDT ledger would not
survive the move. Budget alternative: Hostinger VPS + PocketBase, ~$72–$132 in
year 1, but with no managed backups — you run, back up and update it yourself.

## What's in this folder

```
public/                 Front-end (signup, board, issue, Safety, pricing, Manage)
  index.html            Single-page app
  app.js                All client logic, calls /api/*
  styles.css            Deep navy / charcoal, teal accent (same look as Muse site)
netlify/
  functions/            Netlify Functions (server code, Node-style, one per endpoint)
    _lib.js             Shared Supabase / Brevo / auth helpers + handlerFor adapter
    board.js            GET /api/board — public board + latest issue + settings
    subscribe.js        POST /api/subscribe — public signup (email only)
    unsubscribe.js      POST /api/unsubscribe
    settings.js         GET /api/settings — public payment settings
    admin-airdrops.js   POST/PATCH /api/admin/airdrops
    admin-export.js     GET /api/admin/export — subscribers CSV
    admin-issues.js     POST /api/admin/issues — create draft issue
    admin-issues-id-publish.js   POST /api/admin/issues/:id/publish
    admin-issues-id-preview.js   GET  /api/admin/issues/:id/preview
    admin-issues-id-send.js      POST /api/admin/issues/:id/send
    admin-overview.js   GET /api/admin/overview — everything Manage needs
    admin-payments.js   POST /api/admin/payments — reader submits a USDT txid
    admin-payments-verify.js     POST /api/admin/payments/verify
    admin-settings.js   POST /api/admin/settings — owner settings
netlify.toml            Publish dir (public), functions dir, /api/* rewrites
supabase/schema.sql     Creates the 5 tables + RLS policies
supabase/seed.sql       Issue 1 + its 7 drops (real, checked 22 Nov 2026)
content/issue-1.json    Issue 1 as structured data (same content as the 7-page PDF)
.env.example            Every secret needed — copy to .env / dashboard, never commit real values
DEPLOY.md               Step-by-step deploy + weekly auto-send setup for Dexter (Muse)
TEST_PLAN.md            Test with 1 test subscriber before going live
scripts/weekly-issue.mjs  Reference script a Muse scheduled job can run via the admin API
```

**How the Netlify functions work:** each file exports a classic Netlify
`handler(event)` built by `handlerFor` in `_lib.js`, which rebuilds a
Cloudflare-style `context` (`{ request, env, params }`) from the Netlify
event — `env` is `process.env`, `request` is a real `Request`, and `params.id`
for the three `/api/admin/issues/:id/...` routes comes from the `?id=` the
rewrite in `netlify.toml` adds. The endpoint logic itself is unchanged from
the Cloudflare version: same Supabase REST calls, same Brevo calls, same
`ADMIN_API_KEY` check, same trust-score maths. The public URLs are
unchanged (`/api/*`), so the front-end and the weekly job need no changes.

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

How to revoke: change `ADMIN_API_KEY` in the Netlify dashboard
(Site settings → Environment variables) and in the Muse job. Old keys stop
working immediately. See DEPLOY.md § "Weekly auto-send setup" for the exact
job body and key handling.

A manual fallback is also kept: **Manage → Issues → Upload newsletter**
(upload a .txt/.md/.pdf — text is extracted for .txt/.md; .pdf is stored and
its text must be pasted, see DEPLOY.md) and the **Send to all subscribers**
card with preview + recipient count.

## Placeholders — nothing invented

- Domain: `airdroplookout.com` — confirmed 22 Nov 2026 (renamed from the
  `airdropwatch.com` placeholder, which was already taken). Change it once
  in `public/config.js` (`SITE_DOMAIN`) and in Netlify/Brevo settings
  if it ever changes.
- USDT wallet address + network: **blank** in `settings`. Fill in Manage →
  Settings after launch. Never invent an address.
- Notification email, Telegram link: **blank**.
- Issue 1 is real (checked 22 Nov 2026). Later issues are created weekly by
  Dexter — never auto-generated from unverified sources.

## Quick start (local test)

```bash
cp .env.example .env   # fill in Supabase + Brevo values from your dashboards
npm install -g netlify-cli   # once, for local dev only
netlify dev            # serves public/ + functions at http://localhost:8888
```

No real email is sent by this folder as delivered. Sending only happens when
a real `BREVO_API_KEY` is set and the send endpoint is called.
