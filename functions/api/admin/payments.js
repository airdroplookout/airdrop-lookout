import { json, sbJson, requireAdmin } from "../../_lib.js";
// POST /api/admin/payments — record a USDT payment (public submit from Pricing page
// does NOT need the admin key).
// Body: { email, txid, network, amount_usdt? } → creates an unverified payment row.
// Verifying is a separate endpoint: POST /api/admin/payments/verify (owner only).
export async function onRequestPost(context) {
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
