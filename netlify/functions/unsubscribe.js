// Netlify Function — converted from Cloudflare Pages Functions (Nov 2026).
// Original: functions/api/unsubscribe.js. Route is rewritten to this function in netlify.toml;
// the public /api/* URL is unchanged, so the front-end and weekly job need no changes.
import { json, sbJson, validEmail, handlerFor } from "./_lib.js";
// POST /api/unsubscribe { email } — sets status=unsubscribed.
async function onPost(context) {
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

export const handler = handlerFor({ POST: onPost });
