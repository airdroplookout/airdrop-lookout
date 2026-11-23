import { json, sbJson, requireAdmin } from "../../../../_lib.js";
// POST /api/admin/issues/:id/publish — draft → published. Owner only.
// Separate from create, so nothing goes live by accident.
export async function onRequestPost(context) {
  const denied = requireAdmin(context); if (denied) return denied;
  try {
    const rows = await sbJson(context, `issues?id=eq.${context.params.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "published", published_at: new Date().toISOString() }),
    });
    return json({ ok: true, issue: rows[0] || null });
  } catch (e) { return json({ ok: false, error: String(e.message || e) }, 500); }
}
