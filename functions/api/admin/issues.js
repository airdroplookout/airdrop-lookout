import { json, sbJson, requireAdmin, trustScore } from "../../_lib.js";
// POST /api/admin/issues — create a draft issue.
// Body: { title, week_label, intro, safety_tip, airdrop_ids?: [uuid...] }
// This is the endpoint the Muse weekly job calls. It creates a DRAFT only —
// publishing is a separate, explicit step (see [id]/publish.js).
export async function onRequestPost(context) {
  const denied = requireAdmin(context); if (denied) return denied;
  try {
    const b = await context.request.json();
    if (!b.title) return json({ ok: false, error: "title is required" }, 400);
    const rows = await sbJson(context, "issues", { method: "POST", body: JSON.stringify({
      title: b.title, week_label: b.week_label || null, intro: b.intro || null,
      safety_tip: b.safety_tip || null, status: "draft",
    })});
    const issue = rows[0];
    for (const [i, aid] of (b.airdrop_ids || []).entries()) {
      await sbJson(context, "issue_airdrops", { method: "POST", body: JSON.stringify({ issue_id: issue.id, airdrop_id: aid, position: i }) });
    }
    return json({ ok: true, issue });
  } catch (e) { return json({ ok: false, error: String(e.message || e) }, 500); }
}
