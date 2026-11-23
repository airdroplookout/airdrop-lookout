// Netlify Function — converted from Cloudflare Pages Functions (Nov 2026).
// Original: functions/api/admin/issues/[id]/send.js. Route is rewritten to this function in netlify.toml;
// the public /api/* URL is unchanged, so the front-end and weekly job need no changes.
import { json, sbJson, requireAdmin, sendViaResend, emailHtml, validEmail, handlerFor } from "./_lib.js";
// POST /api/admin/issues/:id/send — send a PUBLISHED issue to every active subscriber,
// one individual email each via the Resend Send Email API, with the issue
// HTML in the body, a "Read this issue as a PDF" button linking to the PDF
// on airdroplookout.com, AND the issue PDF attached — so readers can open it
// straight from Gmail with no link click and no Google redirect page.
// Owner only (ADMIN_API_KEY). Records send_count / send_failed / last_send_at.
// Safety: refuses to send a draft. Refuses if there are 0 recipients.
// Refuses if RESEND_API_KEY is not set, or if the issue PDF cannot be
// fetched (no link-only sends — the attachment is the point).
// The typo signup enjoyhamikton@gmail.com does not exist (bounced in the
// Nov 23 test send) and is never emailed, even as a test address.
// Body (optional): { test_email } — send to ONE test address only, for TEST_PLAN.md step 3.
const BAD_ADDRESS = "enjoyhamikton@gmail.com";
async function onPost(context) {
  const denied = requireAdmin(context); if (denied) return denied;
  try {
    const id = context.params.id;
    const body = await context.request.json().catch(() => ({}));
    const issues = await sbJson(context, `issues?id=eq.${id}&limit=1`);
    const issue = issues[0]; if (!issue) return json({ ok: false, error: "issue not found" }, 404);
    if (issue.status !== "published" && !body.test_email) return json({ ok: false, error: "Publish the issue first (POST /publish) — drafts are never sent." }, 400);
    if (!context.env.RESEND_API_KEY) return json({ ok: false, error: "RESEND_API_KEY is not set — add it in Netlify Site settings -> Environment variables, then redeploy." }, 500);
    const links = await sbJson(context, `issue_airdrops?issue_id=eq.${id}&order=position.asc`);
    const drops = [];
    for (const l of links) { const d = await sbJson(context, `airdrops?id=eq.${l.airdrop_id}&limit=1`); if (d[0]) drops.push(d[0]); }
    const siteUrl = context.env.SITE_URL || "https://airdroplookout.com";
    // Issue N -> /issues/issue-N.pdf (Issue 1 -> issue-1.pdf, etc).
    const m = String(issue.title || "").match(/issue\s+(\d+)/i);
    const pdfFilename = m ? `issue-${m[1]}.pdf` : "issue-1.pdf";
    const pdfUrl = `${siteUrl}/issues/${pdfFilename}`;
    // Fetch the PDF once and reuse it for every recipient. Abort before
    // sending anyone if it is missing — a send without the attachment
    // would put readers back on the Google redirect page.
    const pdfRes = await fetch(pdfUrl);
    if (!pdfRes.ok) return json({ ok: false, error: `Issue PDF not available at ${pdfUrl} (HTTP ${pdfRes.status}) — upload it to public/issues/ first.` }, 500);
    const pdfBase64 = Buffer.from(await pdfRes.arrayBuffer()).toString("base64");
    if (pdfBase64.length > 40 * 1024 * 1024) return json({ ok: false, error: "Issue PDF is over Resend's 40 MB attachment limit." }, 500);
    const attachments = [{ filename: pdfFilename, content: pdfBase64, contentType: "application/pdf" }];
    const isBad = (e) => String(e || "").trim().toLowerCase() === BAD_ADDRESS;
    const recipients = body.test_email
      ? [{ email: body.test_email }]
      : (await sbJson(context, "subscribers?status=neq.unsubscribed&status=neq.archived&select=email"))
          .filter((r) => validEmail(r.email) && !isBad(r.email));
    if (body.test_email && isBad(body.test_email)) return json({ ok: false, error: `${BAD_ADDRESS} does not exist (bounced) — it is never emailed.` }, 400);
    if (!recipients.length) return json({ ok: false, error: "No recipients." }, 400);
    let sent = 0, failed = 0; const failures = [];
    for (const r of recipients) {
      const unsub = `${siteUrl}/?unsubscribe=${encodeURIComponent(r.email)}`;
      const html = emailHtml({ title: issue.title, intro: issue.intro, safety_tip: issue.safety_tip, drops, siteUrl, unsubscribeUrl: unsub, pdfUrl });
      try { await sendViaResend(context, { to: r.email, subject: `Airdrop Lookout — ${issue.title}`, html, attachments }); sent++; }
      catch (e) { failed++; failures.push(`${r.email}: ${e.message}`); }
    }
    if (!body.test_email) {
      await sbJson(context, `issues?id=eq.${id}`, { method: "PATCH",
        body: JSON.stringify({ send_count: (issue.send_count||0)+sent, send_failed: (issue.send_failed||0)+failed, last_send_at: new Date().toISOString() }) });
    }
    return json({ ok: true, sent, failed, failures: failures.slice(0, 10), test: Boolean(body.test_email), pdf: pdfFilename, attached: true });
  } catch (e) { return json({ ok: false, error: String(e.message || e) }, 500); }
}

export const handler = handlerFor({ POST: onPost },
  (event, q) => ({ id: q.id || event.path.split("/").filter(Boolean).at(-2) }));
