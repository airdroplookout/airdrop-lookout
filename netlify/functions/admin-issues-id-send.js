// Netlify Function — converted from Cloudflare Pages Functions (Nov 2026).
// Original: functions/api/admin/issues/[id]/send.js. Route is rewritten to this function in netlify.toml;
// the public /api/* URL is unchanged, so the front-end and weekly job need no changes.
import { json, sbJson, requireAdmin, sendViaBrevo, emailHtml, handlerFor } from "./_lib.js";
// POST /api/admin/issues/:id/send — send a PUBLISHED issue to every active subscriber,
// one individual email each via Brevo, with unsubscribe footer.
// Owner only (ADMIN_API_KEY). Records send_count / send_failed / last_send_at.
// Safety: refuses to send a draft. Refuses if there are 0 recipients.
// Body (optional): { test_email } — send to ONE test address only, for TEST_PLAN.md step 3.
async function onPost(context) {
  const denied = requireAdmin(context); if (denied) return denied;
  try {
    const id = context.params.id;
    const body = await context.request.json().catch(() => ({}));
    const issues = await sbJson(context, `issues?id=eq.${id}&limit=1`);
    const issue = issues[0]; if (!issue) return json({ ok: false, error: "issue not found" }, 404);
    if (issue.status !== "published" && !body.test_email) return json({ ok: false, error: "Publish the issue first (POST /publish) — drafts are never sent." }, 400);
    const links = await sbJson(context, `issue_airdrops?issue_id=eq.${id}&order=position.asc`);
    const drops = [];
    for (const l of links) { const d = await sbJson(context, `airdrops?id=eq.${l.airdrop_id}&limit=1`); if (d[0]) drops.push(d[0]); }
    const siteUrl = context.env.SITE_URL || "https://airdroplookout.com";
    const recipients = body.test_email
      ? [{ email: body.test_email }]
      : await sbJson(context, "subscribers?status=neq.unsubscribed&select=email");
    if (!recipients.length) return json({ ok: false, error: "No recipients." }, 400);
    let sent = 0, failed = 0; const failures = [];
    for (const r of recipients) {
      const unsub = `${siteUrl}/?unsubscribe=${encodeURIComponent(r.email)}`;
      const html = emailHtml({ title: issue.title, intro: issue.intro, safety_tip: issue.safety_tip, drops, siteUrl, unsubscribeUrl: unsub });
      try { await sendViaBrevo(context, { to: r.email, subject: `Airdrop Lookout — ${issue.title}`, html }); sent++; }
      catch (e) { failed++; failures.push(`${r.email}: ${e.message}`); }
    }
    if (!body.test_email) {
      await sbJson(context, `issues?id=eq.${id}`, { method: "PATCH",
        body: JSON.stringify({ send_count: (issue.send_count||0)+sent, send_failed: (issue.send_failed||0)+failed, last_send_at: new Date().toISOString() }) });
    }
    return json({ ok: true, sent, failed, failures: failures.slice(0, 10), test: Boolean(body.test_email) });
  } catch (e) { return json({ ok: false, error: String(e.message || e) }, 500); }
}

export const handler = handlerFor({ POST: onPost },
  (event, q) => ({ id: q.id || event.path.split("/").filter(Boolean).at(-2) }));
