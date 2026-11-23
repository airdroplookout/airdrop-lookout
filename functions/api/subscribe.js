import { json, sbJson, validEmail } from "../_lib.js";
// POST /api/subscribe  { email } — email only, never a wallet address.
// Free trial = 30 days from signup.
export async function onRequestPost(context) {
  try {
    const { email } = await context.request.json();
    if (!validEmail(email)) return json({ ok: false, error: "Enter a valid email address." }, 400);
    const clean = email.trim().toLowerCase();
    const ends = new Date(Date.now() + 30 * 864e5).toISOString();
    const rows = await sbJson(context, "subscribers?on_conflict=email", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({ email: clean, status: "free_trial", free_trial_ends_at: ends }),
    });
    return json({ ok: true, subscriber: rows[0] || null, free_trial_ends_at: ends });
  } catch (e) { return json({ ok: false, error: String(e.message || e) }, 500); }
}
