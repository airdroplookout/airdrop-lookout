// Netlify Function — converted from Cloudflare Pages Functions (Nov 2026).
// Original: functions/api/admin/settings.js. Route is rewritten to this function in netlify.toml;
// the public /api/* URL is unchanged, so the front-end and weekly job need no changes.
import { json, sbJson, requireAdmin, handlerFor } from "./_lib.js";
// POST /api/admin/settings — save owner settings. Owner only.
// Body: any of { usdt_wallet_address, usdt_network, notification_email, telegram_link, site_domain }
// The wallet address is a PUBLIC receiving address. Never a seed phrase / private key.
async function onPost(context) {
  const denied = requireAdmin(context); if (denied) return denied;
  try {
    const b = await context.request.json();
    for (const [k, v] of Object.entries(b)) {
      if (v === undefined) continue;
      await sbJson(context, "settings?on_conflict=key", {
        method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify({ key: k, value: String(v) }),
      });
    }
    return json({ ok: true });
  } catch (e) { return json({ ok: false, error: String(e.message || e) }, 500); }
}

export const handler = handlerFor({ POST: onPost });
