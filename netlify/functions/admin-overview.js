// Netlify Function — converted from Cloudflare Pages Functions (Nov 2026).
// Original: functions/api/admin/overview.js. Route is rewritten to this function in netlify.toml;
// the public /api/* URL is unchanged, so the front-end and weekly job need no changes.
import { json, sbJson, requireAdmin, trustScore, handlerFor } from "./_lib.js";
// GET /api/admin/overview — everything Manage needs in one call. Owner only.
async function onGet(context) {
  const denied = await requireAdmin(context); if (denied) return denied;
  try {
    const [subscribers, issues, airdrops, payments, settingsRows] = await Promise.all([
      sbJson(context, "subscribers?order=created_at.desc&limit=500"),
      sbJson(context, "issues?order=created_at.desc&limit=50"),
      sbJson(context, "airdrops?order=deadline_at.asc&limit=200"),
      sbJson(context, "payments?order=created_at.desc&limit=200"),
      sbJson(context, "settings?select=key,value"),
    ]);
    const active = subscribers.filter(s => s.status !== "unsubscribed" && s.status !== "archived").length;
    const last = issues.filter(i => i.last_send_at).sort((a,b)=>new Date(b.last_send_at)-new Date(a.last_send_at))[0];
    return json({ ok: true, subscribers, issues, airdrops, payments,
      settings: Object.fromEntries(settingsRows.map(r => [r.key, r.value])),
      active_subscribers: active,
      last_send: last ? `${last.title} — ${last.last_send_at} (${last.send_count} sent, ${last.send_failed} failed)` : null });
  } catch (e) { return json({ ok: false, error: String(e.message || e) }, 500); }
}

export const handler = handlerFor({ GET: onGet });
