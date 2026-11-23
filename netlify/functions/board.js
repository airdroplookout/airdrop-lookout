// Netlify Function — converted from Cloudflare Pages Functions (Nov 2026).
// Original: functions/api/board.js. Route is rewritten to this function in netlify.toml;
// the public /api/* URL is unchanged, so the front-end and weekly job need no changes.
import { json, sbJson, handlerFor } from "./_lib.js";
// GET /api/board — public board: active airdrops by deadline, latest published issue, public settings.
// Privacy: only the fields the public board actually shows are returned.
// Airdrop `notes` and timestamps never leave the server, and settings are
// limited to the three the board needs (Telegram link, USDT address and
// network) — the notification email and anything else in settings stays
// private even once the owner fills it in.
const PUBLIC_AIRDROP_FIELDS = "id,name,token,chain,effort,deadline_at,status,eligibility,steps,source_url,verified,trust_score";
const PUBLIC_SETTINGS = "telegram_link,usdt_wallet_address,usdt_network";
async function onGet(context) {
  try {
    const airdrops = await sbJson(context, `airdrops?select=${PUBLIC_AIRDROP_FIELDS}&status=eq.active&order=deadline_at.asc`);
    const issues = await sbJson(context, "issues?select=id,title,week_label,intro,safety_tip,published_at&status=eq.published&order=published_at.desc&limit=1");
    const settingsRows = await sbJson(context, `settings?select=key,value&key=in.(${PUBLIC_SETTINGS})`);
    const settings = Object.fromEntries(settingsRows.map(r => [r.key, r.value]));
    return json({ ok: true, airdrops, issue: issues[0] || null, settings });
  } catch (e) { return json({ ok: false, error: String(e.message || e) }, 500); }
}

export const handler = handlerFor({ GET: onGet });
