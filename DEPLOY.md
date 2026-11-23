# Deploy Airdrop Lookout (portable) — Netlify

Do NOT buy anything or create accounts until Adil confirms: (1) his USDT
address + network; (2) approval to spend ~$11.81 for the domain +
$25/month Supabase Pro. Domain is confirmed: `airdroplookout.com`
(`public/config.js` → `SITE_DOMAIN`, plus `.env` `SITE_DOMAIN` and the
`settings.site_domain` row).

**Hosting: Netlify, not Cloudflare Pages.** Cloudflare's login verification
kept blocking Muse's browser (Turnstile error on every sign-in attempt,
22 Nov 2026), so the build was switched. Netlify Free allows commercial use
(unlike Vercel Hobby) — see README.md for the credit limits: 300 credits/month
on a new account, hard limit, projects pause when they run out. Plenty for
launch; watch it if traffic grows.

## 0. Accounts — all in Adil's name, his email

1. **Porkbun** — buy the domain (~$11.81/year). Do not use GoDaddy if price
   matters: GoDaddy is $0.01 year 1 only with a required 3-year purchase
   ($45.99 at checkout), then $22.99/year.
2. **GitHub** — ✅ already done: account `airdroplookout`, repo
   `airdroplookout/airdrop-lookout`. The Netlify switch in this folder is a
   local change — push it (`git add -A && git commit && git push`) before
   connecting Netlify, so Netlify deploys the Netlify code, not the old
   Cloudflare code.
3. **Netlify** — free account, for hosting. Adil creates it and signs in once;
   Dexter cannot create accounts in his name.
4. **Supabase** — free account to start; upgrade to Pro ($25/month) before launch.
5. **Brevo** — free account, for sending. Needs account approval before the first send.

## 1. Code → GitHub → Netlify

```bash
cd airdrop-watch-portable
git add -A && git commit -m "Switch hosting to Netlify" && git push
# (Repo already exists: https://github.com/airdroplookout/airdrop-lookout)
```

Netlify Dashboard → **Add new site → Import an existing project** → GitHub
(authorise Netlify to read the repo if asked — Adil approves that himself) →
pick `airdroplookout/airdrop-lookout` → **Deploy settings** (pre-filled from
`netlify.toml` — check they show):
- Build command: *(leave empty — no build step)*
- Publish directory: `public`
- Functions directory: `netlify/functions`
→ **Deploy site**. First deploy lands on a `*.netlify.app` address.

Then Site settings → **Environment variables → Add a variable** (scope: All
scopes), add:
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`BREVO_API_KEY`, `BREVO_SENDER_EMAIL` (e.g. `news@airdroplookout.com`),
`BREVO_SENDER_NAME`, `ADMIN_API_KEY` (generate: `openssl rand -hex 32`),
`SITE_DOMAIN`, `SITE_URL`.
**After adding variables, trigger a redeploy** (Deploys → Trigger deploy →
Deploy site) — functions only pick up new variables on a fresh deploy.

## 2. Database — Supabase

Supabase Dashboard → SQL Editor → run `supabase/schema.sql`, then
`supabase/seed.sql` (Issue 1 + its 7 drops, real, checked 22 Nov 2026).
Then Dashboard → Authentication → Settings → confirm the anon key can only
read active airdrops / published issues (RLS policies in schema.sql).

Upgrade to Pro **before launch**: Dashboard → Settings → Billing → Pro
$25/month. Free pauses after 1 week of inactivity — do not launch a paid
newsletter on a database that can pause.

## 3. Domain — Netlify + Porkbun (later — domain is deferred, do this when Adil says so)

Netlify recommends `www` as the primary domain when DNS stays outside
Netlify. DNS stays at Porkbun (do NOT move nameservers to Netlify unless
Adil asks for Netlify DNS).

1. Netlify → Site settings → Domain management → Add a custom domain →
   enter `airdroplookout.com`, then add `www.airdroplookout.com` too and set
   `www` as primary.
2. At Porkbun, DNS for the domain:
   - `www` → CNAME → `<site-name>.netlify.app` (the value Netlify shows).
   - Apex (`@`, no www) → A record → `75.2.60.5` (Netlify's load-balancer IP;
     if Porkbun offers an ALIAS record, point it at
     `apex-loadbalancer.netlify.com` instead — same result, more resilient).
3. Netlify issues the HTTPS certificate automatically (Let's Encrypt). Wait
   for the domain status to show Active, then open `https://airdroplookout.com`.

## 4. Sending — Brevo (SPF / DKIM / DMARC)

1. Brevo → Settings → Senders & IP → Domains → Add a domain → enter the domain.
2. Brevo gives you DKIM TXT/CNAME records. Add them in **Porkbun DNS**
   (DNS stays at Porkbun — not in Netlify, not in Cloudflare).
3. Publish a DMARC TXT record at `_dmarc` starting with `p=none`, then verify
   in Brevo. Example: `v=DMARC1; p=none; rua=mailto:dmarc@airdroplookout.com`
4. Send from `news@airdroplookout.com` (or similar) — never from a Gmail address.
5. Brevo Free: 300 emails/day, unlimited contacts. That covers a weekly send
   to up to 300 people in one day. Starter: from $9/month for 5,000 emails/month.

## 5. Settings in the site

Open `https://airdroplookout.com` (or the `*.netlify.app` address before the
domain is added) → Manage → enter `ADMIN_API_KEY` →
Settings: paste the real USDT wallet address + network (TRC20 / ERC20 /
BEP20), notification email, Telegram link. Save. The address then shows on
the Pricing page. **Never paste a seed phrase or private key anywhere.**

## 6. Weekly auto-send setup for Dexter (Muse) — the key requirement

Adil confirmed: Dexter creates the newsletter each week and sends it to all
subscribers automatically, without Adil uploading anything or intervening.

**What the weekly job needs:**
- `ADMIN_API_KEY` — the same long random value in Netlify environment variables.
  Stored in the Muse scheduled job only (never in code, never in chat).
  **Rotate/revoke:** change it in Netlify environment variables *and* in the
  Muse job, then trigger a redeploy so the functions pick it up. Old keys stop
  working immediately.
- The site URL (`https://airdroplookout.com`, or the `*.netlify.app` address
  until the domain is added).

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

- [ ] Netlify site live on `*.netlify.app`, env vars set, redeploy done
- [ ] Domain confirmed + bought, DNS active, HTTPS works
- [ ] Supabase Pro active, schema + seed run, Issue 1 visible on the board
- [ ] Brevo domain verified (SPF/DKIM/DMARC), test email lands in inbox, not spam
- [ ] Settings filled (USDT address + network, notification email)
- [ ] TEST_PLAN.md run end-to-end with 1 test subscriber (see that file)
- [ ] Weekly Muse job created with the admin key
- [ ] CSV export tested — the subscriber list is backed up
