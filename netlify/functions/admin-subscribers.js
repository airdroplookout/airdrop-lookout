// Netlify Function — subscriber management for Manage.
// PATCH /api/admin/subscribers?id=...&action=archive — put a subscriber aside.
//   Sets status "archived" and remembers their old status in notes, so they can
//   be pulled back. Archived subscribers get no emails and do not count as active.
// PATCH /api/admin/subscribers?id=...&action=restore — pull an archived subscriber back.
//   Restores the status they had before archiving (free_trial if unknown).
// DELETE /api/admin/subscribers?id=... — remove a subscriber for good (row deleted).
// Owner only (ADMIN_API_KEY).
import { json, sbJson, requireAdmin, handlerFor } from "./_lib.js";

async function onPatch(context) {
  const denied = requireAdmin(context); if (denied) return denied;
  try {
    const url = new URL(context.request.url);
    const id = url.searchParams.get("id");
    const action = url.searchParams.get("action");
    if (!id || (action !== "archive" && action !== "restore")) {
      return json({ ok: false, error: "id and action=archive|restore are required" }, 400);
    }
    const rows = await sbJson(context, `subscribers?id=eq.${id}&limit=1`);
    const sub = rows[0];
    if (!sub) return json({ ok: false, error: "subscriber not found" }, 404);
    let patch;
    if (action === "archive") {
      if (sub.status === "archived") return json({ ok: true, subscriber: sub });
      patch = { status: "archived", notes: `archived_from:${sub.status || "free_trial"}` };
    } else {
      if (sub.status !== "archived") return json({ ok: true, subscriber: sub });
      const prev = (sub.notes || "").match(/archived_from:([a-z_]+)/);
      patch = { status: prev ? prev[1] : "free_trial", notes: null };
    }
    const updated = await sbJson(context, `subscribers?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(patch) });
    return json({ ok: true, subscriber: updated[0] || null });
  } catch (e) { return json({ ok: false, error: String(e.message || e) }, 500); }
}

async function onDelete(context) {
  const denied = requireAdmin(context); if (denied) return denied;
  try {
    const url = new URL(context.request.url);
    const id = url.searchParams.get("id");
    if (!id) return json({ ok: false, error: "id is required" }, 400);
    await sbJson(context, `subscribers?id=eq.${id}`, { method: "DELETE" });
    return json({ ok: true, removed: id });
  } catch (e) { return json({ ok: false, error: String(e.message || e) }, 500); }
}

export const handler = handlerFor({ PATCH: onPatch, DELETE: onDelete });
