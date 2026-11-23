import { json, sbJson, requireAdmin } from "../../_lib.js";
// POST /api/admin/settings — save owner settings. Owner only.
// Body: any of { usdt_wallet_address, usdt_network, notification_email, telegram_link, site_domain }
// The wallet address is a PUBLIC receiving address. Never a seed phrase / private key.
export async function onRequestPost(context) {
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
