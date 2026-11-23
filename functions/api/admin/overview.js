import { json, sbJson, requireAdmin, trustScore } from "../../_lib.js";
// GET /api/admin/overview — everything Manage needs in one call. Owner only.
export async function onRequestGet(context) {
  const denied = requireAdmin(context); if (denied) return denied;
  try {
    const [subscribers, issues, airdrops, payments, settingsRows] = await Promise.all([
      sbJson(context, "subscribers?order=created_at.desc&limit=500"),
      sbJson(context, "issues?order=created_at.desc&limit=50"),
      sbJson(context, "airdrops?order=deadline_at.asc&limit=200"),
      sbJson(context, "payments?order=created_at.desc&limit=200"),
      sbJson(context, "settings?select=key,value"),
    ]);
    const active = subscribers.filter(s => s.status !== "unsubscribed").length;
    const last = issues.filter(i => i.last_send_at).sort((a,b)=>new Date(b.last_send_at)-new Date(a.last_send_at))[0];
    return json({ ok: true, subscribers, issues, airdrops, payments,
      settings: Object.fromEntries(settingsRows.map(r => [r.key, r.value])),
      active_subscribers: active,
      last_send: last ? `${last.title} — ${last.last_send_at} (${last.send_count} sent, ${last.send_failed} failed)` : null });
  } catch (e) { return json({ ok: false, error: String(e.message || e) }, 500); }
}
