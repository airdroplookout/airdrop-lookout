# Deploy Airdrop Lookout (portable)

Do NOT buy anything or create accounts until Adil confirms: (1) his USDT
address + network; (2) approval to spend ~$11.81 for the domain +
$25/month Supabase Pro. Domain is confirmed: `airdroplookout.com`
(`public/config.js` → `SITE_DOMAIN`, plus `.env` `SITE_DOMAIN` and the
`settings.site_domain` row).

## 0. Accounts — all in Adil's name, his email

1. **Porkbun** — buy the domain (~$11.81/year). Do not use GoDaddy if price
   matters: GoDaddy is $0.01 year 1 only with a required 3-year purchase
   ($45.99 at checkout), then $22.99/year.
2. **GitHub** — free account, to hold the code so it is never lost.
3. **Cloudflare** — free account, for Pages hosting + DNS.
4. **Supabase** — free account to start; upgrade to Pro ($25/month) before launch.
5. **Brevo** — free account, for sending. Needs account approval before the first send.

## 1. Code → GitHub → Cloudflare Pages

```bash
cd airdrop-watch-portable
git init && git add . && git commit -m "Airdrop Lookout portable v1"
# create an empty repo on GitHub first, then:
git remote add origin https://github.com/YOUR-USERNAME/airdrop-lookout.git
git push -u origin main
```

Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git →
pick the repo → Framework preset: **None** → Build command: *(leave empty)*
→ Build output directory: `public` → Save and Deploy.
Then Pages → Settings → Variables, add (production):
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`BREVO_API_KEY`, `BREVO_SENDER_EMAIL` (e.g. `news@airdroplookout.com`),
`BREVO_SENDER_NAME`, `ADMIN_API_KEY` (generate: `openssl rand -hex 32`),
`SITE_DOMAIN`, `SITE_URL`.

## 2. Database — Supabase

Supabase Dashboard → SQL Editor → run `supabase/schema.sql`, then
`supabase/seed.sql` (Issue 1 + its 7 drops, real, checked 22 Nov 2026).
Then Dashboard → Authentication → Settings → confirm the anon key can only
read active airdrops / published issues (RLS policies in schema.sql).

Upgrade to Pro **before launch**: Dashboard → Settings → Billing → Pro
$25/month. Free pauses after 1 week of inactivity — do not launch a paid
newsletter on a database that can pause.

## 3. Domain — Cloudflare Pages + Porkbun

1. Cloudflare Pages → Custom domains → Set up a custom domain → enter the domain.
2. For `www`: at Porkbun, add a CNAME for `www` pointing to
   `<project>.pages.dev` (the value Cloudflare shows).
3. For the apex (`airdroplookout.com` with no www): the zone must be on
   Cloudflare nameservers, so Cloudflare can create the apex record itself.
   At Porkbun, change nameservers to Cloudflare's (shown in the Cloudflare
   dashboard) — a one-time, ~5-minute change; DNS stays free.
4. Cloudflare issues the HTTPS certificate automatically. Wait for the
   domain status to show Active, then open `https://airdroplookout.com`.

## 4. Sending — Brevo (SPF / DKIM / DMARC)

1. Brevo → Settings → Senders & IP → Domains → Add a domain → enter the domain.
2. Brevo gives you DKIM TXT/CNAME records. Add them in Cloudflare DNS
   (Dashboard → DNS → Records).
3. Publish a DMARC TXT record at `_dmarc` starting with `p=none`, then verify
   in Brevo. Example: `v=DMARC1; p=none; rua=mailto:dmarc@airdroplookout.com`
4. Send from `news@airdroplookout.com` (or similar) — never from a Gmail address.
5. Brevo Free: 300 emails/day, unlimited contacts. That covers a weekly send
   to up to 300 people in one day. Starter: from $9/month for 5,000 emails/month.

## 5. Settings in the site

Open `https://airdroplookout.com` → Manage → enter `ADMIN_API_KEY` →
Settings: paste the real USDT wallet address + network (TRC20 / ERC20 /
BEP20), notification email, Telegram link. Save. The address then shows on
the Pricing page. **Never paste a seed phrase or private key anywhere.**

## 6. Weekly auto-send setup for Dexter (Muse) — the key requirement

Adil confirmed: Dexter creates the newsletter each week and sends it to all
subscribers automatically, without Adil uploading anything or intervening.

**What the weekly job needs:**
- `ADMIN_API_KEY` — the same long random value in Cloudflare Pages Variables.
  Stored in the Muse scheduled job only (never in code, never in chat).
  **Rotate/revoke:** change it in Cloudflare Pages Variables *and* in the
  Muse job. Old keys stop working immediately.
- The site URL (`https://airdroplookout.com`).

**Job (create in Muse as a weekly cron, Monday ~09:00 America/Toronto):**

> Every Monday ~09:00 Toronto, for Airdrop Lookout on https://airdroplookout.com:
> 1. Research currently active crypto airdrops. Verify each deadline and
>    eligibility rule on the project's own official page. Never use an
>    unverified roundup as the only source. Flag any "Hyperliquid Season 2"
>    or "MetaMask MASK" claim as a scam unless an official announcement exists.
> 2. Write the weekly issue: title, week label, intro, safety tip, and the
>    drops in deadline order with eligibility + step-by-step claim steps.
> 3. Call the admin API with header `x-admin-key: <ADMIN_API_KEY>`:
>    a. `POST /api/admin/airdrops` for each new drop (creates draft_review;
>       trust score is computed server-side from verified source / steps /
>       eligibility / deadline).
>    b. `POST /api/admin/airdrops?id=<id>&status=active` for each verified drop.
>    c. `POST /api/admin/issues` with the issue + `airdrop_ids` → returns the
>       draft issue id.
>    d. `POST /api/admin/issues/<id>/publish`
>    e. `GET /api/admin/issues/<id>/preview` — check the subject, body and
>       recipient count; if anything looks wrong, STOP and report to Adil.
>    f. `POST /api/admin/issues/<id>/send` — sends one individual email per
>       active subscriber via Brevo, with unsubscribe footer.
> 4. Report back to Adil in chat: issue title, how many drops, how many sent /
>    failed. If no verified drops were found, or a deadline could not be
>    verified, do NOT send — report that instead.
> 5. Never ask readers for a wallet address. Never invent a drop, a deadline,
>    or a wallet address. This is information, not financial advice.

**Manual fallback (kept in the site):** Manage → Issues → Upload newsletter
(.txt/.md → draft issue; .pdf → paste its text), then preview and use the
**Send to all subscribers** card. Dexter's weekly job is the normal path;
upload is only if the job ever fails.

## 7. Go-live checklist

- [ ] Domain confirmed + bought, DNS active, HTTPS works
- [ ] Supabase Pro active, schema + seed run, Issue 1 visible on the board
- [ ] Brevo domain verified (SPF/DKIM/DMARC), test email lands in inbox, not spam
- [ ] Settings filled (USDT address + network, notification email)
- [ ] TEST_PLAN.md run end-to-end with 1 test subscriber (see that file)
- [ ] Weekly Muse job created with the admin key
- [ ] CSV export tested — the subscriber list is backed up
