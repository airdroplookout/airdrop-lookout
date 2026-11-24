// Airdrop Lookout — Netlify Function — Manage password reset.
// POST /api/admin/reset — body { token, password }.
// Verifies the one-time token (hash + 30-minute expiry), sets the new
// Manage password as a database hash, consumes the token, clears the
// login lockout, and revokes every existing Manage session (the owner
// logs in again with the new password on every device).
// Never touches the lockout budget for bad tokens, and never reveals
// whether a token is valid: every bad, expired or already-used token
// gets the same message. A too-short password is rejected without
// consuming the token, so the owner can retry within the 30 minutes.
import { json, handlerFor, verifyAdminResetToken, consumeAdminResetToken, setAdminPasswordHash, clearLoginLockout, bumpAdminSessionVersion, ADMIN_PASSWORD_MIN_LENGTH } from "./_lib.js";

const BAD_TOKEN = "This reset link is invalid or has expired. Ask for a new one from the Manage sign-in page.";

async function onPost(context) {
  const body = await context.request.json().catch(() => ({}));
  const token = typeof body.token === "string" ? body.token : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!token) return json({ ok: false, error: BAD_TOKEN }, 400);
  let valid = false;
  try { valid = await verifyAdminResetToken(context, token); } catch { valid = false; }
  if (!valid) return json({ ok: false, error: BAD_TOKEN }, 400);
  if (!password || password.length < ADMIN_PASSWORD_MIN_LENGTH) {
    return json({ ok: false, error: `Choose a password of at least ${ADMIN_PASSWORD_MIN_LENGTH} characters.` }, 400);
  }
  // Token is valid and the password is acceptable — consume the token
  // FIRST, so a later failure cannot leave a live token behind, then
  // store the new password hash.
  try {
    await consumeAdminResetToken(context);
    await setAdminPasswordHash(context, password);
    await clearLoginLockout(context).catch((e) => { console.error("admin-reset: could not clear lockout:", String(e.message || e)); });
    await bumpAdminSessionVersion(context).catch((e) => { console.error("admin-reset: could not bump session version:", String(e.message || e)); });
  } catch (e) {
    return json({ ok: false, error: "Could not change the password — please try again in a few minutes." }, 500);
  }
  return json({ ok: true });
}

export const handler = handlerFor({ POST: onPost });
