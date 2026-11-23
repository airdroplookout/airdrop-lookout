// Netlify Function — converted from Cloudflare Pages Functions (Nov 2026).
// Original: functions/api/board.js. Route is rewritten to this function in netlify.toml;
// the public /api/* URL is unchanged, so the front-end and weekly job need no changes.
import { json, sbJson, handlerFor } from "./_lib.js";
// GET /api/board — public board: active airdrops by deadline, latest published issue, public settings.
async function onGet(context) {
  try {
    const airdrops = await sbJson(context, "airdrops?status=eq.active&order=deadline_at.asc");
    const issues = await sbJson(context, "issues?status=eq.published&order=published_at.desc&limit=1");
    const settingsRows = await sbJson(context, "settings?select=key,value");
    const settings = Object.fromEntries(settingsRows.map(r => [r.key, r.value]));
    return json({ ok: true, airdrops, issue: issues[0] || null, settings });
  } catch (e) { return json({ ok: false, error: String(e.message || e) }, 500); }
}

export const handler = handlerFor({ GET: onGet });
