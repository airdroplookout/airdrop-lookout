import { json, sbJson, requireAdmin } from "../../../_lib.js";
// POST /api/admin/payments/verify — owner only.
// Body: { payment_id, subscriber_email, paid_until? }
// Marks the payment verified and flips the subscriber to paid.
export async function onRequestPost(context) {
  const denied = requireAdmin(context); if (denied) return denied;
  try {
    const b = await context.request.json();
    if (!b.payment_id || !b.subscriber_email) return json({ ok: false, error: "payment_id and subscriber_email are required" }, 400);
    await sbJson(context, `payments?id=eq.${b.payment_id}`, { method: "PATCH", body: JSON.stringify({ verified: true }) });
    await sbJson(context, `subscribers?email=eq.${encodeURIComponent(b.subscriber_email.toLowerCase())}`, {
      method: "PATCH", body: JSON.stringify({ status: "paid", paid_until: b.paid_until || new Date(Date.now() + 7 * 864e5).toISOString() }),
    });
    return json({ ok: true });
  } catch (e) { return json({ ok: false, error: String(e.message || e) }, 500); }
}
