import { json, sbJson, validEmail } from "../_lib.js";
// POST /api/unsubscribe { email } — sets status=unsubscribed.
export async function onRequestPost(context) {
  try {
    const { email } = await context.request.json();
    if (!validEmail(email)) return json({ ok: false, error: "Enter a valid email address." }, 400);
    await sbJson(context, `subscribers?email=eq.${encodeURIComponent(email.trim().toLowerCase())}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "unsubscribed", unsubscribed_at: new Date().toISOString() }),
    });
    return json({ ok: true });
  } catch (e) { return json({ ok: false, error: String(e.message || e) }, 500); }
}
