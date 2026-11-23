import { json, sbJson, requireAdmin, trustScore } from "../../_lib.js";
// POST /api/admin/airdrops — add a drop as draft_review (nothing goes live unchecked).
// Body: { name, token, chain, effort, deadline_at, eligibility, steps[], source_url, verified, notes }
// PATCH /api/admin/airdrops?id=...&status=active|expired|archived|draft_review — move in the pipeline.
export async function onRequestPost(context) {
  const denied = requireAdmin(context); if (denied) return denied;
  try {
    const b = await context.request.json();
    if (!b.name) return json({ ok: false, error: "name is required" }, 400);
    const drop = { ...b, trust_score: trustScore(b), status: "draft_review" };
    const rows = await sbJson(context, "airdrops", { method: "POST", body: JSON.stringify(drop) });
    return json({ ok: true, airdrop: rows[0] });
  } catch (e) { return json({ ok: false, error: String(e.message || e) }, 500); }
}
export async function onRequestPatch(context) {
  const denied = requireAdmin(context); if (denied) return denied;
  try {
    const url = new URL(context.request.url);
    const id = url.searchParams.get("id"); const status = url.searchParams.get("status");
    if (!id || !status) return json({ ok: false, error: "id and status are required" }, 400);
    const rows = await sbJson(context, `airdrops?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
    return json({ ok: true, airdrop: rows[0] || null });
  } catch (e) { return json({ ok: false, error: String(e.message || e) }, 500); }
}
