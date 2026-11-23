// Netlify Function — Manage password login.
// POST /api/admin/login — body { password }.
// The password is the ADMIN_PASSWORD env var (Netlify Site settings ->
// Environment variables, server-side only, never in code or in the page).
// The owner picks it himself; Dexter never invents it. If it is not set
// yet, login refuses with a clear error instead of guessing.
// On success returns a 30-day session token (HMAC-SHA256 over the expiry,
// signed with ADMIN_API_KEY — see createAdminSession in _lib.js), which
// the Manage page stores in localStorage and sends as x-admin-session.
// On failure returns 401 with no hint about what was wrong.
// No email is sent here.
import { json, handlerFor, timingSafeCompare, createAdminSession } from "./_lib.js";

async function onPost(context) {
  const password = context.env.ADMIN_PASSWORD;
  if (!password) return json({ ok: false, error: "ADMIN_PASSWORD is not set — add it in Netlify Site settings -> Environment variables, then redeploy." }, 500);
  if (!context.env.ADMIN_API_KEY) return json({ ok: false, error: "ADMIN_API_KEY is not set — it signs the session token." }, 500);
  const body = await context.request.json().catch(() => ({}));
  const given = typeof body.password === "string" ? body.password : "";
  if (!given || !timingSafeCompare(given, password)) {
    return json({ ok: false, error: "Invalid password." }, 401);
  }
  const session = createAdminSession(context.env);
  return json({ ok: true, token: session.token, expires_at: session.expires_at });
}

export const handler = handlerFor({ POST: onPost });
