// Netlify Function — converted from Cloudflare Pages Functions (Nov 2026).
// Original: functions/api/admin/payments.js. Route is rewritten to this function in netlify.toml;
// the public /api/* URL is unchanged, so the front-end and weekly job need no changes.
import { json, sbJson, requireAdmin, handlerFor } from "./_lib.js";
// POST /api/admin/payments — record a USDT payment (public submit from Pricing page
// does NOT need the admin key).
// Body: { email, txid, network, amount_usdt? } → creates an unverified payment row.
// Verifying is a separate endpoint: POST /api/admin/payments/verify (owner only).
async function onPost(context) {
  try {
    const b = await context.request.json();
    if (!b.email || !b.txid) return json({ ok: false, error: "email and txid are required" }, 400);
    const rows = await sbJson(context, "payments", { method: "POST", body: JSON.stringify({
      email: b.email.trim().toLowerCase(), txid: b.txid.trim(), network: b.network || null,
      amount_usdt: b.amount_usdt || 5, verified: false,
    })});
    return json({ ok: true, payment: rows[0] });
  } catch (e) { return json({ ok: false, error: String(e.message || e) }, 500); }
}

export const handler = handlerFor({ POST: onPost });
