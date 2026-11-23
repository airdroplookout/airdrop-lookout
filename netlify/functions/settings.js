// Netlify Function — converted from Cloudflare Pages Functions (Nov 2026).
// Original: functions/api/settings.js. Route is rewritten to this function in netlify.toml;
// the public /api/* URL is unchanged, so the front-end and weekly job need no changes.
import { json, sbJson, handlerFor } from "./_lib.js";
// GET /api/settings — public payment settings only (wallet address + network).
// Never returns secrets. Wallet address is blank until the owner fills it in.
async function onGet(context) {
  try {
    const rows = await sbJson(context, "settings?select=key,value&key=in.(usdt_wallet_address,usdt_network,telegram_link,site_domain)");
    return json({ ok: true, settings: Object.fromEntries(rows.map(r => [r.key, r.value])) });
  } catch (e) { return json({ ok: false, error: String(e.message || e) }, 500); }
}

export const handler = handlerFor({ GET: onGet });
