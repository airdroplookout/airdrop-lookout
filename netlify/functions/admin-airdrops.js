// Netlify Function — converted from Cloudflare Pages Functions (Nov 2026).
// Original: functions/api/admin/airdrops.js. Route is rewritten to this function in netlify.toml;
// the public /api/* URL is unchanged, so the front-end and weekly job need no changes.
import { json, sbJson, requireAdmin, trustScore, handlerFor } from "./_lib.js";
// POST /api/admin/airdrops — add a drop as draft_review (nothing goes live unchecked).
// Body: { name, token, chain, effort, deadline_at, eligibility, steps[], source_url, verified, notes }
// PATCH /api/admin/airdrops?id=...&status=active|expired|archived|draft_review — move in the pipeline.
async function onPost(context) {
  const denied = await requireAdmin(context); if (denied) return denied;
  try {
    const b = await context.request.json();
    if (!b.name) return json({ ok: false, error: "name is required" }, 400);
    const drop = { ...b, trust_score: trustScore(b), status: "draft_review" };
    const rows = await sbJson(context, "airdrops", { method: "POST", body: JSON.stringify(drop) });
    return json({ ok: true, airdrop: rows[0] });
  } catch (e) { return json({ ok: false, error: String(e.message || e) }, 500); }
}
async function onPatch(context) {
  const denied = await requireAdmin(context); if (denied) return denied;
  try {
    const url = new URL(context.request.url);
    const id = url.searchParams.get("id"); const status = url.searchParams.get("status");
    if (!id || !status) return json({ ok: false, error: "id and status are required" }, 400);
    const rows = await sbJson(context, `airdrops?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ status }) });
    return json({ ok: true, airdrop: rows[0] || null });
  } catch (e) { return json({ ok: false, error: String(e.message || e) }, 500); }
}

export const handler = handlerFor({ POST: onPost, PATCH: onPatch });
