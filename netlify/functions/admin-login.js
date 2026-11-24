// Netlify Function — Manage password login.
// POST /api/admin/login — body { password }.
// The password is the database hash (settings key admin_password_hash,
// set by a "Forgot password?" reset) when one exists, otherwise the
// ADMIN_PASSWORD env var (Netlify Site settings -> Environment
// variables, server-side only, never in code or in the page).
// The owner picks it himself; Dexter never invents it. If neither is
// set yet, login refuses with a clear error instead of guessing.
// On success returns a 30-day session token (HMAC-SHA256 over the expiry,
// signed with ADMIN_API_KEY — see createAdminSession in _lib.js), which
// the Manage page stores in localStorage and sends as x-admin-session.
// On failure returns 401 with no hint about what was wrong.
// Rate limiting: 5 wrong passwords inside 15 minutes locks the admin
// login out of this endpoint for 15 minutes (429) — a GLOBAL budget
// shared across all IPs, plus a per-IP limit as a second layer. The
// check runs before the password is compared, and this endpoint is the
// only place a password is ever accepted, so the lockout cannot be
// bypassed by switching endpoints. State lives in the settings table —
// see checkLoginAllowed / recordFailedLogin in _lib.js. If the lockout
// state cannot be read or written, login fails closed (500) instead of
// silently granting more tries.
// No email is sent here.
import { json, handlerFor, createAdminSession, getSessionVersion, checkLoginAllowed, recordFailedLogin, clearLoginLockout, LOGIN_MAX_FAILS, adminPasswordConfigured, checkAdminPassword } from "./_lib.js";

async function onPost(context) {
  if (!context.env.ADMIN_API_KEY) return json({ ok: false, error: "ADMIN_API_KEY is not set — it signs the session token." }, 500);
  let configured;
  try {
    configured = await adminPasswordConfigured(context);
  } catch {
    // FAIL CLOSED: the settings table could not be read, so login is
    // refused rather than letting attempts continue unchecked.
    return json({ ok: false, error: "Login is temporarily unavailable — please try again in a few minutes." }, 500);
  }
  let allowed;
  try {
    allowed = await checkLoginAllowed(context);
  } catch {
    // FAIL CLOSED: the lockout state could not be read, so login is
    // refused rather than letting attempts continue unchecked.
    return json({ ok: false, error: "Login is temporarily unavailable — please try again in a few minutes." }, 500);
  }
  if (!allowed.allowed) {
    const mins = Math.max(1, Math.ceil(allowed.retry_after_ms / 60000));
    return json({ ok: false, error: `Too many wrong passwords — try again in ${mins} minute${mins === 1 ? "" : "s"}.` }, 429);
  }
  const body = await context.request.json().catch(() => ({}));
  const given = typeof body.password === "string" ? body.password : "";
  if (!configured) return json({ ok: false, error: "ADMIN_PASSWORD is not set — add it in Netlify Site settings -> Environment variables, then redeploy." }, 500);
  let result;
  try {
    result = await checkAdminPassword(context, given);
  } catch {
    // FAIL CLOSED: the settings table could not be read, so login is
    // refused rather than letting attempts continue unchecked.
    return json({ ok: false, error: "Login is temporarily unavailable — please try again in a few minutes." }, 500);
  }
  if (result === "not-set") return json({ ok: false, error: "ADMIN_PASSWORD is not set — add it in Netlify Site settings -> Environment variables, then redeploy." }, 500);
  if (!given || result !== "ok") {
    let entry;
    try {
      entry = await recordFailedLogin(context);
    } catch {
      // FAIL CLOSED: the failed attempt could not be recorded, so the
      // login is refused instead of silently granting more tries.
      return json({ ok: false, error: "Login is temporarily unavailable — please try again in a few minutes." }, 500);
    }
    if (entry && entry.locked_until) {
      return json({ ok: false, error: "Too many wrong passwords — locked out for 15 minutes." }, 429);
    }
    const remaining = entry ? Math.max(0, LOGIN_MAX_FAILS - entry.fails) : null;
    return json({ ok: false, error: remaining !== null ? `Invalid password. ${remaining} attempt${remaining === 1 ? "" : "s"} left before a 15-minute lockout.` : "Invalid password." }, 401);
  }
  await clearLoginLockout(context).catch(() => {});
  const version = await getSessionVersion(context);
  const session = createAdminSession(context.env, version);
  return json({ ok: true, token: session.token, expires_at: session.expires_at });
}

export const handler = handlerFor({ POST: onPost });
