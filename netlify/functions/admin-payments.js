// Netlify Function — converted from Cloudflare Pages Functions (Nov 2026).
// Original: functions/api/admin/payments.js. Route is rewritten to this function in netlify.toml;
// the public /api/* URL is unchanged, so the front-end and weekly job need no changes.
import { json, sbJson, handlerFor, validEmail } from "./_lib.js";
// POST /api/admin/payments — record a USDT payment (public submit from Pricing page
// does NOT need the admin key).
// Body: { email, txid, network, amount_usdt? } → creates an unverified payment row.
// Verifying is a separate endpoint: POST /api/admin/payments/verify (owner only).
// Abuse checks (a fake payment used to mean nothing more than a row in the
// ledger, but it polluted it and could be used to impersonate a payer):
// - the email must belong to an existing subscriber (sign up first);
// - the txid must look like a real transaction id (20–128 letters/digits);
// - the same txid cannot be submitted twice.
// A row created here is still UNVERIFIED — only the owner, via
// /payments/verify, can mark anyone paid.
async function onPost(context) {
  try {
    const b = await context.request.json();
    if (!b.email || !b.txid) return json({ ok: false, error: "email and txid are required" }, 400);
    const email = String(b.email).trim().toLowerCase();
    const txid = String(b.txid).trim();
    if (!validEmail(email)) return json({ ok: false, error: "Enter a valid email address." }, 400);
    if (!/^[A-Za-z0-9]{20,128}$/.test(txid)) return json({ ok: false, error: "That transaction ID does not look like a real one — paste the full ID from your wallet." }, 400);
    const subs = await sbJson(context, `subscribers?email=eq.${encodeURIComponent(email)}&limit=1`);
    if (!subs[0]) return json({ ok: false, error: "No subscriber with that email — sign up first, then submit your transaction ID." }, 400);
    const dupes = await sbJson(context, `payments?txid=eq.${encodeURIComponent(txid)}&limit=1`);
    if (dupes[0]) return json({ ok: false, error: "That transaction ID was already submitted." }, 400);
    const rows = await sbJson(context, "payments", { method: "POST", body: JSON.stringify({
      email, txid, network: b.network || null,
      amount_usdt: b.amount_usdt || 5, verified: false,
    })});
    return json({ ok: true, payment: rows[0] });
  } catch (e) { return json({ ok: false, error: String(e.message || e) }, 500); }
}

export const handler = handlerFor({ POST: onPost });
