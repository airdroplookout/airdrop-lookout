// Netlify Function — converted from Cloudflare Pages Functions (Nov 2026).
// Original: functions/api/unsubscribe.js. Route is rewritten to this function in netlify.toml;
// the public /api/* URL is unchanged, so the front-end and weekly job need no changes.
import { json, sbJson, handlerFor, verifyUnsubscribeToken } from "./_lib.js";
// POST /api/unsubscribe { token } — sets status=unsubscribed.
// The token is the signed link from the newsletter email (see
// createUnsubscribeToken in _lib.js): it proves the clicker owns that
// address, because the link was sent to it. A bare email is NOT accepted
// here — anyone could otherwise unsubscribe any address. The front-end
// reads ?unsubscribe=<token> from the email link and posts it.
async function onPost(context) {
  try {
    const { token } = await context.request.json();
    const email = verifyUnsubscribeToken(context.env, token);
    if (!email) return json({ ok: false, error: "That unsubscribe link is not valid. Use the unsubscribe link in the latest issue email." }, 400);
    await sbJson(context, `subscribers?email=eq.${encodeURIComponent(email)}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "unsubscribed", unsubscribed_at: new Date().toISOString() }),
    });
    return json({ ok: true, email });
  } catch (e) { return json({ ok: false, error: String(e.message || e) }, 500); }
}

export const handler = handlerFor({ POST: onPost });
