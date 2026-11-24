# Airdrop Lookout — Manage "Forgot password?" flow (STAGED, not yet live)

Prepared 2026-11-24 ~12:50 EST. Same flow as AI Outlet Plus, where it is
already LIVE and verified. This folder is a complete, deploy-ready set —
it ALSO includes the two earlier un-deployed changes, so one push lands
all three. Do NOT push the toggle folder separately after this one: it
would revert the forgot-password changes on `public/index.html` /
`public/app.js`.

## What changed (7 files, mirroring the repo layout)

- `netlify/functions/_lib.js` — base is the live file PLUS the global
  lockout fix (from `~/workspace/your_files/airdrop-watch-portable/`,
  which was live + lockout only), PLUS the new forgot-password helpers:
  scrypt password hashing (`hashAdminPassword` /
  `verifyAdminPasswordHash`), `adminPasswordConfigured` /
  `checkAdminPassword` (database hash wins, `ADMIN_PASSWORD` env var
  stays as fallback while no database password exists), one-time reset
  tokens (`createAdminResetToken` / `verifyAdminResetToken` /
  `consumeAdminResetToken` — 32 random bytes, SHA-256 hash only in the
  settings table, 30-minute expiry), 3-per-hour rate limit
  (`checkResetRequestAllowed`), and `bumpAdminSessionVersion` (revokes
  all sessions after a reset). `node --check` passes; crypto helpers
  tested locally (scrypt round-trip, tampered-hash and wrong-token
  rejection).
- `netlify/functions/admin-login.js` — base is live + lockout fix. Login
  now accepts the database password hash when one exists, else the
  `ADMIN_PASSWORD` env var. Lockout behaviour unchanged. Fail-closed
  reads unchanged.
- `netlify/functions/admin-forgot.js` — NEW. POST /api/admin/forgot, no
  auth, no body. The reset email goes ONLY to taradil@gmail.com (never
  a requester-supplied address). Always answers with the same generic
  message. Rate-limited to 3/hour; never touches the login lockout.
  Sends via Resend (already working here; sender
  contact@airdroplookout.com).
- `netlify/functions/admin-reset.js` — NEW. POST /api/admin/reset, body
  { token, password }. Verifies the one-time token, sets the new
  password as a database hash, consumes the token, clears the lockout,
  revokes all sessions. Bad/expired/used tokens all get the same
  message; a too-short password (< 8 chars) is rejected without
  consuming the token.
- `public/index.html` — base is live + the "Don't count my visits"
  toggle. Login card gained a "Forgot password?" button + status line;
  new hidden reset card (new password + repeat + Change password).
- `public/app.js` — base is live + toggle. Forgot button posts to
  /api/admin/forgot; `/manage?reset=<token>` shows the reset card; the
  reset form posts to /api/admin/reset, then shows the login card and
  strips the token from the address bar. No CSP hash work needed
  (enforced `script-src 'self'`, external file only).
- `netlify.toml` — base is the LIVE file (includes the newer badge
  domains in the CSP img-src). Added /api/admin/forgot and
  /api/admin/reset rewrites.

## Why it is NOT pushed yet (blocker — proven twice)

The current GitHub connector token ("AI Store Deploy") covers the
**Aistore repo only**. Verified 2026-11-24:
- `PUT /repos/airdroplookout/airdrop-lookout/contents/...` → **403
  "Resource not accessible by personal access token"**
- Same token works fine on Aistore (201/200). No push was attempted
  from this folder.

## How to finish (parent/owner steps, in order)

1. Extend/reconnect GitHub so the token covers
   `airdroplookout/airdrop-lookout` with Contents read/write.
2. Push from THIS folder (it mirrors the repo layout):
   `python3 ~/workspace/custom-connectors/custom.github/bin/gh_adl_contents.py push ~/workspace/your_files/airdrop-lookout-forgot-password "Add Manage 'Forgot password?' flow (reset-by-email, DB password hash) + global login lockout + exclude-my-visits toggle"`
   (Helper is a copy of `github_aistore_contents.py` with REPO changed
   to `airdrop-lookout`; it updates files in place via the Contents
   API. Do NOT use `github_curl.py push` — its git-tree path builds a
   tree with no `base_tree` and would replace the whole repo with just
   these files.)
3. **REQUIRED before testing — database grant.** The live Airdrop
   `schema.sql` has NO GRANT lines, and the settings INSERT/UPDATE
   grant was already an outstanding item. Without it, the forgot flow
   cannot write its token/rate-limit/password rows (and login's new
   settings read would fail closed). In the Airdrop Supabase SQL Editor
   (project "airdrop-lookout", ref `zyckfawddwjhxqrtkdvt`), run:
   `GRANT SELECT, INSERT, UPDATE ON public.settings TO service_role;`
   (SELECT already works today — login and the lockout read use it — so
   this is only about the writes.)
4. Wait for the Netlify deploy, then verify live (do NOT use the real
   password, and use ZERO wrong-password probes):
   - Home 200; `/manage` 200 and shows "Forgot password?".
   - `GET /api/admin/overview` without session → 401; `/api/ping` → `{"ok":true}`.
   - `POST /api/admin/forgot` → 200 with the generic message; a reset
     email must arrive at taradil@gmail.com (Resend works here).
   - `POST /api/admin/reset` with a fake token → 400 "invalid or
     expired".
   - Owner test (his step, after the above): click "Forgot password?",
     open the emailed link, set a new password, sign in with it. The
     old password must then stop working; all other sessions are
     logged out.

## Notes

- The reset request is rate-limited to 3 per hour per site. The live
  AI Outlet Plus test used 1 of its 3 slots; Airdrop's counter is
  untouched (nothing has been posted to its forgot endpoint).
- The owner still has the current password working throughout: the env
  var is the fallback until the first successful reset sets a database
  password.
- After this push, the counter reset (`delete from public.page_views;`)
  can run — the toggle will be live on both sites. See the toggle
  folder's README for that step.
