// Netlify Function — converted from Cloudflare Pages Functions (Nov 2026).
// Original: functions/api/admin/overview.js. Route is rewritten to this function in netlify.toml;
// the public /api/* URL is unchanged, so the front-end and weekly job need no changes.
import { json, sbJson, requireAdmin, trustScore, handlerFor, torontoToday, addDaysIso } from "./_lib.js";
// GET /api/admin/overview — everything Manage needs in one call. Owner only.
async function onGet(context) {
  const denied = await requireAdmin(context); if (denied) return denied;
  try {
    const [subscribers, issues, airdrops, payments, settingsRows, pageViews] = await Promise.all([
      sbJson(context, "subscribers?order=created_at.desc&limit=500"),
      sbJson(context, "issues?order=created_at.desc&limit=50"),
      sbJson(context, "airdrops?order=deadline_at.asc&limit=200"),
      sbJson(context, "payments?order=created_at.desc&limit=200"),
      sbJson(context, "settings?select=key,value"),
      // Visits card: one row per day. Missing table (before it is created)
      // must not break Manage — fall back to an empty list.
      sbJson(context, "page_views?select=day,views&order=day.asc&limit=800").catch(() => []),
    ]);
    const active = subscribers.filter(s => s.status !== "unsubscribed" && s.status !== "archived").length;
    const last = issues.filter(i => i.last_send_at).sort((a,b)=>new Date(b.last_send_at)-new Date(a.last_send_at))[0];
    // Visits: today / this week (Monday–Sunday) / this month / this year,
    // all by Toronto dates. Counts start the day the card was added.
    const today = torontoToday();
    const dow = new Date(today + "T12:00:00Z").getUTCDay();
    const monday = addDaysIso(today, -((dow + 6) % 7));
    const sunday = addDaysIso(monday, 6);
    const sum = (pred) => (pageViews || []).filter(pred).reduce((a, r) => a + (r.views || 0), 0);
    const visits = {
      today: sum(r => r.day === today),
      week: sum(r => r.day >= monday && r.day <= sunday),
      month: sum(r => r.day.startsWith(today.slice(0, 7))),
      year: sum(r => r.day.startsWith(today.slice(0, 4))),
    };
    return json({ ok: true, subscribers, issues, airdrops, payments, visits,
      settings: Object.fromEntries(settingsRows.map(r => [r.key, r.value])),
      active_subscribers: active,
      last_send: last ? `${last.title} — ${last.last_send_at} (${last.send_count} sent, ${last.send_failed} failed)` : null });
  } catch (e) { return json({ ok: false, error: String(e.message || e) }, 500); }
}

export const handler = handlerFor({ GET: onGet });
