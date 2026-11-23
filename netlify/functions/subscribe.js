// Netlify Function — converted from Cloudflare Pages Functions (Nov 2026).
// Original: functions/api/subscribe.js. Route is rewritten to this function in netlify.toml;
// the public /api/* URL is unchanged, so the front-end and weekly job need no changes.
import { json, sbJson, validEmail, handlerFor } from "./_lib.js";
// POST /api/subscribe  { email } — email only, never a wallet address.
// Free trial = 30 days from signup.
// An existing email NEVER gets downgraded by re-signing up: a paid
// subscriber stays paid (same paid_until), a free-trial subscriber keeps
// their original trial end, and an archived subscriber stays archived.
// Only a previously unsubscribed address starts a fresh free trial,
// because that is opting back in, not a downgrade.
async function onPost(context) {
  try {
    const { email } = await context.request.json();
    if (!validEmail(email)) return json({ ok: false, error: "Enter a valid email address." }, 400);
    const clean = email.trim().toLowerCase();
    const existing = await sbJson(context, `subscribers?email=eq.${encodeURIComponent(clean)}&limit=1`);
    const sub = existing[0];
    if (sub) {
      if (sub.status === "paid") {
        return json({ ok: true, subscriber: sub, free_trial_ends_at: sub.free_trial_ends_at, already: "paid" });
      }
      if (sub.status === "free_trial") {
        return json({ ok: true, subscriber: sub, free_trial_ends_at: sub.free_trial_ends_at, already: "free_trial" });
      }
      if (sub.status === "archived") {
        return json({ ok: false, error: "This address is archived. Email the owner to rejoin." }, 403);
      }
      // unsubscribed → opt back in with a fresh 30-day free trial.
      const ends = new Date(Date.now() + 30 * 864e5).toISOString();
      const rows = await sbJson(context, `subscribers?email=eq.${encodeURIComponent(clean)}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "free_trial", free_trial_ends_at: ends, unsubscribed_at: null }),
      });
      return json({ ok: true, subscriber: rows[0] || null, free_trial_ends_at: ends, rejoined: true });
    }
    const ends = new Date(Date.now() + 30 * 864e5).toISOString();
    const rows = await sbJson(context, "subscribers", {
      method: "POST",
      body: JSON.stringify({ email: clean, status: "free_trial", free_trial_ends_at: ends }),
    });
    return json({ ok: true, subscriber: rows[0] || null, free_trial_ends_at: ends });
  } catch (e) { return json({ ok: false, error: String(e.message || e) }, 500); }
}

export const handler = handlerFor({ POST: onPost });
