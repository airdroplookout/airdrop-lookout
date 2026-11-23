// Shared helpers for Cloudflare Pages Functions.
// Server-side only. Secrets come from env (Cloudflare Pages Variables), never from the browser.
export function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
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
export function emailHtml({ title, intro, safety_tip, drops, siteUrl, unsubscribeUrl }) {
  const rows = (drops || []).map(d => `
    <h3>${d.name}${d.token ? ` (${d.token})` : ""} — closes ${d.deadline_at ? new Date(d.deadline_at).toUTCString() : "—"}</h3>
    <p><strong>Trust score: ${d.trust_score ?? "—"}/100</strong> · ${d.chain || ""} · Effort: ${d.effort || "—"}</p>
    <p><strong>Eligibility:</strong> ${d.eligibility || "—"}</p>
    <ol>${(d.steps || []).map(s => `<li>${s}</li>`).join("")}</ol>
    ${d.source_url ? `<p>Official page: <a href="${d.source_url}">${d.source_url}</a></p>` : ""}`).join("");
  return `<!doctype html><html><body style="font-family:system-ui,Arial,sans-serif;max-width:640px;margin:0 auto;padding:16px">
<h1>Airdrop Lookout — ${title}</h1>
<p>${intro || ""}</p>
${rows}
<h2>Stay safe this week</h2><p>${safety_tip || ""}</p>
<p><strong>Never share your seed phrase or private key.</strong> No legitimate claim needs one.</p>
<p style="color:#666;font-size:13px">You are receiving this because you signed up at ${siteUrl}. This is information, not financial advice. <a href="${unsubscribeUrl}">Unsubscribe</a></p>
</body></html>`;
}
export async function sendViaBrevo(context, { to, subject, html }) {
  const r = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": context.env.BREVO_API_KEY, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: { name: context.env.BREVO_SENDER_NAME || "Airdrop Lookout", email: context.env.BREVO_SENDER_EMAIL },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });
  if (!r.ok) throw new Error(`Brevo ${r.status}: ${await r.text()}`);
  return r.json();
}
export function validEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || "").trim().toLowerCase()); }
