# Test plan — run end-to-end with 1 test subscriber before going live

Use a second email Adil controls (e.g. a second Gmail) as the test subscriber.
Do NOT use a real subscriber's address for testing. Do NOT send a test to the
whole list.

## 1. Signup
1. Open the live site, sign up with the test email.
2. Expected: "free month started" message.
3. Manage → Subscribers: the test email appears, status `free_trial`,
   **free-month end date = signup date + 30 days**. If the date is wrong, stop.

## 2. Issue + preview
1. Manage → Issues: Issue 1 ("The deadline issue", 22 Nov 2026) is published
   and its 7 drops are linked in deadline order (Treehouse Nov 25, Doppler
   Nov 28, Aster Dec 4, Midnight Dec 4, Predict.fun Dec 18, StandX Dec 31,
   Grass Jan 22, 2027).
2. Select Issue 1 → **Preview exact email**. Check: subject, intro, each
   drop's deadline / eligibility / steps, trust scores, safety tip,
   unsubscribe footer. Recipient count should be **1** (the test subscriber).

## 3. Send to test subscriber only
1. Call `POST /api/admin/issues/<issue-id>/send` with body
   `{ "test_email": "<test email>" }` and header `x-admin-key: <ADMIN_API_KEY>`.
   (Or use `scripts/weekly-issue.mjs --test-email <test email>`.)
2. Expected: `{ ok: true, sent: 1, failed: 0, test: true }`.
3. Check the test inbox: email arrived (not spam), links work, unsubscribe
   link works, no other subscriber's address is visible.

## 4. USDT flow
1. Pricing → submit a **fake** transaction ID with the test email + a network
   (e.g. TRC20).
2. Manage → Payments: the row appears, status **pending**.
3. Verify it (Manage / `POST /api/admin/payments/verify` with the payment id):
   payment flips to **verified**, subscriber flips to **paid** with a
   `paid_until` date.
4. Delete the fake payment + test subscriber afterwards, or mark them clearly
   as test data.

## 5. CSV export
1. Manage → Export subscribers (CSV). Open the file.
2. Expected: the test email is in it, with status and dates. This is the
   backup — keep a copy off the site.

## 6. Weekly auto-send (dry run, no real send)
1. Run the weekly job body from DEPLOY.md §6 with a test issue, but stop
   after the preview step — do not call `/send`.
2. Check the preview, then delete the test issue.

Only when all six steps pass: announce the site, open public signups, and
start the free first month.
