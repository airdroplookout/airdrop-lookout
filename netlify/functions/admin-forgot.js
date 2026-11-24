// Airdrop Lookout — Netlify Function — Manage "Forgot password?" request.
// POST /api/admin/forgot — no auth, no body needed.
// The reset email goes ONLY to the owner's address (taradil@gmail.com) —
// the requester never supplies a recipient, so this endpoint cannot be
// used to send mail to anyone else. It always answers with the same
// generic message, whether or not a token was created or an email was
// sent, so it never reveals whether a reset is possible.
// One-time token, 30-minute expiry, stored only as a SHA-256 hash in
// the settings table (see createAdminResetToken in _lib.js). Rate-limited
// to 3 requests per hour per site, so the inbox cannot be spammed.
// A reset request never touches the login lockout: it must work even
// while the owner is locked out of /api/admin/login, and it must never
// burn lockout attempts. Sending uses Resend (already working here;
// sender contact@airdroplookout.com via RESEND_SENDER_EMAIL).
import { json, handlerFor, sendViaResend, siteBaseUrl, createAdminResetToken, checkResetRequestAllowed, OWNER_EMAIL, ADMIN_RESET_TTL_MS } from "./_lib.js";

const SITE_NAME = "Airdrop Lookout";
const GENERIC = "If a reset email could be sent, check your inbox — the link works once and expires in 30 minutes.";

async function onPost(context) {
  try {
    const allowed = await checkResetRequestAllowed(context);
    if (!allowed) return json({ ok: true, message: GENERIC });
    const token = await createAdminResetToken(context);
    const resetUrl = `${siteBaseUrl(context.env)}/manage?reset=${encodeURIComponent(token)}`;
    const minutes = Math.round(ADMIN_RESET_TTL_MS / 60000);
    const html = `<!doctype html><html><body style="font-family:system-ui,Arial,sans-serif;max-width:640px;margin:0 auto;padding:16px">
<p>Hi Adil,</p>
<p>Someone asked to reset the Manage password for <strong>${SITE_NAME}</strong>. If that was you, choose a new password here:</p>
<p><a href="${resetUrl}" style="display:inline-block;background:#0b6e4f;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">Choose a new Manage password</a></p>
<p>This link works once and expires in ${minutes} minutes. After you set the new password, every Manage session is logged out and you sign in again with it.</p>
<p>If you did not ask for this, ignore this email — your password has not changed.</p>
</body></html>`;
    try {
      await sendViaResend(context, { to: OWNER_EMAIL, subject: `Reset your Manage password — ${SITE_NAME}`, html });
    } catch (e) {
      // Email could not be sent. Logged server-side; the caller still
      // gets the generic answer.
      console.error("admin-forgot: reset email NOT sent:", String(e.message || e));
    }
  } catch (e) {
    console.error("admin-forgot:", String(e.message || e));
  }
  return json({ ok: true, message: GENERIC });
}

export const handler = handlerFor({ POST: onPost });
