// Shared helpers for Netlify Functions.
// Converted from Cloudflare Pages Functions (Nov 2026) — same logic, same
// Supabase calls. Sending moved from Brevo to Resend (Nov 2026): the Resend
// Send Email API supports PDF attachments, which Broadcasts do not, so
// readers can open the issue straight from Gmail with no link click and no
// Google redirect page. Server-side only. Secrets come
// from process.env (Netlify Site settings -> Environment variables), never
// from the browser.
//
// Netlify classic handler shape: each endpoint file exports
//   export const handler = handlerFor({ GET: ..., POST: ..., ... })
// handlerFor builds a Cloudflare-style `context` ({ request, env, params })
// from the Netlify `event`, calls the method handler, and converts the
// returned Response into Netlify's { statusCode, headers, body } shape.
export function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
}

function buildContext(event, getParams) {
  const query = event.queryStringParameters || {};
  const qs = new URLSearchParams(query).toString();
  const path = event.path || "/";
  const url = `https://${(event.headers && (event.headers.host || event.headers.Host)) || "localhost"}${path}${qs ? `?${qs}` : ""}`;
  const headers = new Headers(event.headers || {});
  const method = event.httpMethod || "GET";
  let body;
  if (event.body && method !== "GET" && method !== "HEAD") {
    body = event.isBase64Encoded ? Buffer.from(event.body, "base64") : event.body;
  }
  const request = new Request(url, { method, headers, body });
  return { request, env: process.env, params: getParams ? getParams(event, query) : {} };
}

export function handlerFor(methods, getParams) {
  return async (event) => {
    const fn = methods[event.httpMethod];
    if (!fn) {
      return { statusCode: 405, headers: { "content-type": "application/json" }, body: JSON.stringify({ ok: false, error: "Method not allowed" }) };
    }
    try {
      const res = await fn(buildContext(event, getParams));
      const text = await res.text();
      const headers = {};
      res.headers.forEach((v, k) => { headers[k] = v; });
      return { statusCode: res.status, headers, body: text };
    } catch (e) {
      return { statusCode: 500, headers: { "content-type": "application/json" }, body: JSON.stringify({ ok: false, error: String(e.message || e) }) };
    }
  };
}

export function isAdmin(context) {
  const req = context.request;
  const key = req.headers.get("x-admin-key") || (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const expected = context.env.ADMIN_API_KEY;
  return Boolean(expected && key && key === expected);
}
export function requireAdmin(context) {
  if (!isAdmin(context)) return json({ ok: false, error: "unauthorized — valid ADMIN_API_KEY required" }, 401);
  return null;
}
export function sb(context, path, opts = {}) {
  // Supabase REST via the service-role key (bypasses RLS, server-side only).
  const url = `${context.env.SUPABASE_URL}/rest/v1/${path}`;
  return fetch(url, {
    ...opts,
    headers: {
      apikey: context.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${context.env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(opts.headers || {}),
    },
  });
}
export async function sbJson(context, path, opts = {}) {
  const r = await sb(context, path, opts);
  const text = await r.text();
  let data = null; try { data = JSON.parse(text); } catch { data = text; }
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${typeof data === "string" ? data : JSON.stringify(data)}`);
  return data;
}
export function trustScore(drop) {
  // Out of 100, derived ONLY from the drop's real stored fields.
  // verified source 40, documented steps 20, clear eligibility 15,
  // confirmed deadline 15, difficulty stated 10.
  let s = 0;
  if (drop.verified && drop.source_url) s += 40;
  if (Array.isArray(drop.steps) && drop.steps.length >= 2) s += 20;
  else if (Array.isArray(drop.steps) && drop.steps.length === 1) s += 10;
  if (drop.eligibility && drop.eligibility.length > 20) s += 15;
  if (drop.deadline_at) s += 15;
  if (drop.effort) s += 10;
  return Math.min(100, s);
}
export function emailHtml({ title, intro, safety_tip, drops, siteUrl, unsubscribeUrl, pdfUrl }) {
  const rows = (drops || []).map(d => `
    <h3>${d.name}${d.token ? ` (${d.token})` : ""} — closes ${d.deadline_at ? new Date(d.deadline_at).toUTCString() : "—"}</h3>
    <p><strong>Trust score: ${d.trust_score ?? "—"}/100</strong> · ${d.chain || ""} · Effort: ${d.effort || "—"}</p>
    <p><strong>Eligibility:</strong> ${d.eligibility || "—"}</p>
    <ol>${(d.steps || []).map(s => `<li>${s}</li>`).join("")}</ol>
    ${d.source_url ? `<p>Official page: <a href="${d.source_url}">${d.source_url}</a></p>` : ""}`).join("");
  return `<!doctype html><html><body style="font-family:system-ui,Arial,sans-serif;max-width:640px;margin:0 auto;padding:16px">
<h1>Airdrop Lookout — ${title}</h1>
<p>${intro || ""}</p>
${pdfUrl ? `<p><a href="${pdfUrl}" style="display:inline-block;background:#0f766e;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">Read this issue as a PDF</a></p>
<p style="color:#666;font-size:13px">The PDF is also attached to this email, so you can open it straight from your inbox.</p>` : ""}
${rows}
<h2>Stay safe this week</h2><p>${safety_tip || ""}</p>
<p><strong>Never share your seed phrase or private key.</strong> No legitimate claim needs one.</p>
<p style="color:#666;font-size:13px">You are receiving this because you signed up at ${siteUrl}. This is information, not financial advice. <a href="${unsubscribeUrl}">Unsubscribe</a></p>
</body></html>`;
}
// Send one email via the Resend Send Email API. Supports attachments
// (Broadcasts do not), so the issue PDF rides along with the email and
// readers can open it straight from Gmail — no link click, no Google
// redirect page. One recipient per call, so nobody sees anyone else's
// address. Server-side only: RESEND_API_KEY comes from env (Netlify Site
// settings -> Environment variables). From address defaults to
// newsletter@airdroplookout.com, overridable via RESEND_SENDER_EMAIL.
export async function sendViaResend(context, { to, subject, html, attachments }) {
  const apiKey = context.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not set — add it in Netlify Site settings -> Environment variables, then redeploy.");
  const from = context.env.RESEND_SENDER_EMAIL || "newsletter@airdroplookout.com";
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: `Airdrop Lookout <${from}>`,
      to: [to],
      subject,
      html,
      ...(attachments && attachments.length ? { attachments } : {}),
    }),
  });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text()}`);
  return r.json();
}
export function validEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || "").trim().toLowerCase()); }
// Canonical public base URL for links readers see (PDF button, unsubscribe).
// The Netlify SITE_URL env var still holds the pre-domain Netlify subdomain
// (with a trailing slash, which produced "//issues/..." links); the site's
// real domain is airdroplookout.com (see public/config.js). So: strip any
// trailing slash, and if SITE_URL is still a *.netlify.app address, use the
// canonical domain instead — both serve the same site. Once SITE_URL is
// updated in Netlify to airdroplookout.com, that value is used as-is.
export function siteBaseUrl(env) {
  const raw = String((env && env.SITE_URL) || "https://airdroplookout.com").trim().replace(/\/+$/, "");
  if (/\.netlify\.app$/i.test(raw)) return "https://airdroplookout.com";
  return raw || "https://airdroplookout.com";
}
