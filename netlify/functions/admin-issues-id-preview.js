// Netlify Function — converted from Cloudflare Pages Functions (Nov 2026).
// Original: functions/api/admin/issues/[id]/preview.js. Route is rewritten to this function in netlify.toml;
// the public /api/* URL is unchanged, so the front-end and weekly job need no changes.
import { json, sbJson, requireAdmin, handlerFor } from "./_lib.js";
// GET /api/admin/issues/:id/preview — build the EXACT email (subject + body)
// and count recipients. No email is sent. Owner only.
async function onGet(context) {
  const denied = requireAdmin(context); if (denied) return denied;
  try {
    const id = context.params.id;
    const issues = await sbJson(context, `issues?id=eq.${id}&limit=1`);
    const issue = issues[0]; if (!issue) return json({ ok: false, error: "issue not found" }, 404);
    const links = await sbJson(context, `issue_airdrops?issue_id=eq.${id}&order=position.asc`);
    const drops = [];
    for (const l of links) { const d = await sbJson(context, `airdrops?id=eq.${l.airdrop_id}&limit=1`); if (d[0]) drops.push(d[0]); }
    const subs = await sbJson(context, "subscribers?status=neq.unsubscribed&status=neq.archived&select=email");
    const siteUrl = context.env.SITE_URL || "https://airdroplookout.com";
    const m = String(issue.title || "").match(/issue\s+(\d+)/i);
    const pdfFilename = m ? `issue-${m[1]}.pdf` : "issue-1.pdf";
    const pdfUrl = `${siteUrl}/issues/${pdfFilename}`;
    const body = [
      `Airdrop Lookout — ${issue.title}`, "",
      issue.intro || "", "",
      `Read this issue as a PDF: ${pdfUrl} (the PDF is also attached to the email)`, "",
      ...drops.flatMap(d => [`${d.name}${d.token?` (${d.token})`:""} — closes ${d.deadline_at?new Date(d.deadline_at).toUTCString():"—"}`, `Trust score: ${d.trust_score ?? "—"}/100`, `Eligibility: ${d.eligibility||"—"}`, ...(d.steps||[]).map((s,i)=>`  ${i+1}. ${s}`), ""]),
      "Stay safe this week:", issue.safety_tip || "",
      "Never share your seed phrase or private key. No legitimate claim needs one.",
      "", `You are receiving this because you signed up at ${siteUrl}. Unsubscribe: ${siteUrl}/?unsubscribe=1`,
    ].join("\n");
    return json({ ok: true, subject: `Airdrop Lookout — ${issue.title}`, recipient_count: subs.length, body, drops: drops.map(d=>d.name), pdf: pdfFilename, pdf_url: pdfUrl, attached: true });
  } catch (e) { return json({ ok: false, error: String(e.message || e) }, 500); }
}

export const handler = handlerFor({ GET: onGet },
  (event, q) => ({ id: q.id || event.path.split("/").filter(Boolean).at(-2) }));
