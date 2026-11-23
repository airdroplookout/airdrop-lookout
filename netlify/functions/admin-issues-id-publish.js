// Netlify Function — converted from Cloudflare Pages Functions (Nov 2026).
// Original: functions/api/admin/issues/[id]/publish.js. Route is rewritten to this function in netlify.toml;
// the public /api/* URL is unchanged, so the front-end and weekly job need no changes.
import { json, sbJson, requireAdmin, handlerFor } from "./_lib.js";
// POST /api/admin/issues/:id/publish — draft → published. Owner only.
// Separate from create, so nothing goes live by accident.
async function onPost(context) {
  const denied = requireAdmin(context); if (denied) return denied;
  try {
    const rows = await sbJson(context, `issues?id=eq.${context.params.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "published", published_at: new Date().toISOString() }),
    });
    return json({ ok: true, issue: rows[0] || null });
  } catch (e) { return json({ ok: false, error: String(e.message || e) }, 500); }
}

export const handler = handlerFor({ POST: onPost },
  (event, q) => ({ id: q.id || event.path.split("/").filter(Boolean).at(-2) }));
