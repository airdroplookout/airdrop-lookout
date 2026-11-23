// Netlify Function — converted from Cloudflare Pages Functions (Nov 2026).
// Original: functions/api/admin/export.js. Route is rewritten to this function in netlify.toml;
// the public /api/* URL is unchanged, so the front-end and weekly job need no changes.
import { sbJson, requireAdmin, handlerFor } from "./_lib.js";
// GET /api/admin/export — subscribers as CSV. Owner only.
// Columns: email,status,free_trial_ends_at,paid_until,created_at
async function onGet(context) {
  const denied = requireAdmin(context); if (denied) return denied;
  try {
    const rows = await sbJson(context, "subscribers?order=created_at.asc&select=email,status,free_trial_ends_at,paid_until,created_at");
    const csv = ["email,status,free_trial_ends_at,paid_until,created_at",
      ...rows.map(r => [r.email, r.status, r.free_trial_ends_at || "", r.paid_until || "", r.created_at].join(","))].join("\n");
    return new Response(csv, { headers: { "content-type": "text/csv", "content-disposition": "attachment; filename=airdrop-lookout-subscribers.csv" } });
  } catch (e) { return new Response(JSON.stringify({ ok: false, error: String(e.message || e) }), { status: 500 }); }
}

export const handler = handlerFor({ GET: onGet });
