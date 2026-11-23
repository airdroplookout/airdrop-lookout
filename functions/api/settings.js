import { json, sbJson } from "../_lib.js";
// GET /api/settings — public payment settings only (wallet address + network).
// Never returns secrets. Wallet address is blank until the owner fills it in.
export async function onRequestGet(context) {
  try {
    const rows = await sbJson(context, "settings?select=key,value&key=in.(usdt_wallet_address,usdt_network,telegram_link,site_domain)");
    return json({ ok: true, settings: Object.fromEntries(rows.map(r => [r.key, r.value])) });
  } catch (e) { return json({ ok: false, error: String(e.message || e) }, 500); }
}
