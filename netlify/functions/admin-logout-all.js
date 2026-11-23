// Netlify Function — revoke every Manage session, everywhere.
// POST /api/admin/logout-all — owner only.
// Bumps the admin_session_version row in the settings table. Every
// session token carries the version it was minted with, and
// verifyAdminSession only honours tokens whose version matches the
// current one — so one call here instantly logs out every Manage session
// on every device, including the caller's own. The caller then logs in
// again with the Manage password, which mints a fresh token at the new
// version. The long ADMIN_API_KEY is untouched, so the weekly script and
// the stored admin connector keep working.
import { json, sbJson, handlerFor, requireAdmin, getSessionVersion } from "./_lib.js";

async function onPost(context) {
  const denied = await requireAdmin(context); if (denied) return denied;
  try {
    const current = await getSessionVersion(context);
    const next = current + 1;
    await sbJson(context, "settings?on_conflict=key", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({ key: "admin_session_version", value: String(next) }),
    });
    return json({ ok: true, session_version: next });
  } catch (e) { return json({ ok: false, error: String(e.message || e) }, 500); }
}

export const handler = handlerFor({ POST: onPost });
