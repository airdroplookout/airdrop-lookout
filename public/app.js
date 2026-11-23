// Airdrop Lookout — front-end. Calls /api/* (Netlify Functions, rewritten in netlify.toml).
// Domain comes from public/config.js — ONE place to change it.
const CFG = window.AIRDROP_LOOKOUT_CONFIG || { SITE_DOMAIN: "airdroplookout.com", SITE_URL: "https://airdroplookout.com" };
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
let adminKey = sessionStorage.getItem("aw_admin_key") || "";
let boardData = { airdrops: [], issue: null, settings: {} };

function esc(s){ return String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function daysLeft(d){ if(!d) return "—"; const ms = new Date(d) - Date.now(); return ms < 0 ? "closed" : Math.ceil(ms/864e5) + "d left"; }
function trustBadge(score){
  if (score == null) return "";
  return `<div>Trust score <span class="trust">${score}/100</span><div class="muted small">Based only on what is actually there: verified source, documented steps, clear eligibility, confirmed deadline.</div></div>`;
}
function show(view){
  $$("[data-page]").forEach(s => s.classList.toggle("hidden", s.dataset.page !== view));
  $$(".nav button").forEach(b => b.classList.toggle("active", b.dataset.view === view));
  if (view === "board") renderBoard();
  if (view === "issue") renderIssue();
  if (view === "manage" && adminKey) loadAdmin();
}
$$(".nav button").forEach(b => b.addEventListener("click", () => show(b.dataset.view)));

async function loadBoard(){
  try {
    const r = await fetch("/api/board"); const j = await r.json(); boardData = j;
    const next = (j.airdrops||[]).filter(a => a.deadline_at && new Date(a.deadline_at) > new Date()).sort((a,b)=>new Date(a.deadline_at)-new Date(b.deadline_at))[0];
    if (next){ $("#countdown").textContent = `${next.name} closes in ${daysLeft(next.deadline_at)} — ${new Date(next.deadline_at).toUTCString()}`;
      $("#countdown-sub").textContent = "Next closing drop. All deadlines are UTC."; }
    else { $("#countdown").textContent = "No closing drops right now — check back for the next issue."; }
    const iss = j.issue;
    $("#missed").innerHTML = iss
      ? `<p><strong>${esc(iss.title)}</strong> — ${esc(iss.week_label||"")}</p><p>${esc(iss.intro||"")}</p><p class="muted small">Members got the full deadline board, eligibility and steps. Non-members missed it.</p>`
      : `<p>No issue has gone out yet — so there is honestly nothing to have missed yet.</p>`;
    const w = j.settings?.usdt_wallet_address, n = j.settings?.usdt_network;
    $("#pay-address").textContent = w ? `Wallet address (${n||"USDT"}): ${w}` : "Wallet address: to be added by the owner.";
    $("#foot-domain").textContent = CFG.SITE_DOMAIN;
    renderBoard(); renderIssue();
  } catch(e){ $("#board").innerHTML = `<p class="err">Could not load the board. Check the site is deployed and Supabase is connected.</p>`; }
}
function renderBoard(){
  const q = ($("#board-search").value||"").toLowerCase();
  const f = document.querySelector('[data-filter].active')?.dataset.filter || "all";
  let list = (boardData.airdrops||[]).filter(a => !q || [a.name,a.token,a.chain].join(" ").toLowerCase().includes(q));
  if (f === "closing") list = list.filter(a => a.deadline_at && (new Date(a.deadline_at)-Date.now()) < 7*864e5);
  if (f === "latest") list = [...list].sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0)).slice(0,6);
  $("#board-count").textContent = `${list.length} live drop(s).`;
  $("#board").innerHTML = list.map(a => `<div class="card">
    <span class="badge ${a.deadline_at && (new Date(a.deadline_at)-Date.now())<7*864e5 ? "hot":"soon"}">${esc(a.status||"active")} · ${daysLeft(a.deadline_at)}</span>
    <h3>${esc(a.name)} ${a.token?`(${esc(a.token)})`:""}</h3>
    <p class="muted small">${esc(a.chain||"")} · Effort: ${esc(a.effort||"—")} · Closes: ${a.deadline_at?new Date(a.deadline_at).toUTCString():"—"}</p>
    ${trustBadge(a.trust_score)}
    <p><strong>Eligibility:</strong> ${esc(a.eligibility||"—")}</p>
    <ul class="steps">${(a.steps||[]).map((s,i)=>`<li><label><input type="checkbox"> Step ${i+1}: ${esc(s)}</label></li>`).join("")}</ul>
    ${a.source_url?`<p class="small"><a href="${esc(a.source_url)}" target="_blank" rel="noopener">Official project page ↗</a> — claim only from the official page.</p>`:""}
  </div>`).join("") || "<p>No drops match.</p>";
}
$$("[data-filter]").forEach(b => b.addEventListener("click", () => { $$("[data-filter]").forEach(x=>x.classList.remove("active")); b.classList.add("active"); renderBoard(); }));
$("#board-search").addEventListener("input", renderBoard);

function renderIssue(){
  const iss = boardData.issue;
  $("#issue").innerHTML = iss ? `<div class="card"><h2>${esc(iss.title)}</h2><p class="muted">${esc(iss.week_label||"")}</p><p>${esc(iss.intro||"")}</p><p>${esc(iss.safety_tip||"")}</p></div>`
    : "<p>No published issue yet.</p>";
}

$("#signup-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = $("#email").value.trim();
  const r = await fetch("/api/subscribe", { method:"POST", headers:{"content-type":"application/json"}, body: JSON.stringify({ email }) });
  const j = await r.json();
  $("#signup-msg").textContent = j.ok ? `You're in — free month started. Check ${email} for the welcome email.` : (j.error || "Signup failed.");
  $("#signup-msg").className = j.ok ? "ok" : "err";
});
$("#pay-submit").addEventListener("click", async () => {
  const body = { email: $("#pay-email").value.trim(), network: $("#pay-network").value, txid: $("#pay-txid").value.trim(), amount_usdt: 5 };
  const r = await fetch("/api/admin/payments", { method:"POST", headers:{"content-type":"application/json"}, body: JSON.stringify(body) });
  const j = await r.json();
  $("#pay-msg").textContent = j.ok ? "Transaction ID submitted. Adil will verify it and mark you paid." : (j.error || "Could not submit.");
  $("#pay-msg").className = j.ok ? "ok" : "err";
});

// ---- Manage (owner) ----
const adminHeaders = () => ({ "content-type":"application/json", "x-admin-key": adminKey });
async function loadAdmin(){
  const r = await fetch("/api/admin/overview", { headers: adminHeaders() });
  if (!r.ok){ $("#login-msg").textContent = "Wrong key, or the admin API is not deployed yet."; return; }
  const j = await r.json();
  $("#login-card").classList.add("hidden"); $("#manage-body").classList.remove("hidden");
  $("#send-count").textContent = j.active_subscribers ?? "—";
  $("#last-send").textContent = j.last_send ? `Last send: ${j.last_send}` : "No send yet.";
  $("#send-issue").innerHTML = (j.issues||[]).map(i => `<option value="${i.id}">${esc(i.title)} (${i.status})</option>`).join("");
  $("#subscribers").innerHTML = `<table><tr><th>Email</th><th>Status</th><th>Free month ends</th><th></th></tr>${(j.subscribers||[]).map(s=>`<tr><td>${esc(s.email)}</td><td>${esc(s.status)}</td><td>${s.free_trial_ends_at?new Date(s.free_trial_ends_at).toLocaleDateString():"—"}</td><td>${s.status==="archived"
    ? `<button onclick="subAction('${s.id}','restore')">Restore</button>`
    : `<button onclick="subAction('${s.id}','archive')">Archive</button> <button onclick="subAction('${s.id}','remove')">Remove</button>`}</td></tr>`).join("")}</table>`;
  $("#issues").innerHTML = (j.issues||[]).map(i=>`<p>${esc(i.title)} — ${i.status} · sent ${i.send_count||0}</p>`).join("") || "No issues yet.";
  $("#airdrops-admin").innerHTML = (j.airdrops||[]).map(a=>`<p>${esc(a.name)} — ${a.status} · ${a.trust_score??"—"}/100 · closes ${a.deadline_at?new Date(a.deadline_at).toLocaleDateString():"—"}</p>`).join("") || "No airdrops yet.";
  $("#payments").innerHTML = (j.payments||[]).map(p=>`<p>${esc(p.email)} — ${p.amount_usdt} USDT (${esc(p.network||"")}) · ${esc(p.txid)} · ${p.verified?"verified":"pending"}</p>`).join("") || "No payments yet.";
  const s = j.settings||{};
  $("#set-wallet").value = s.usdt_wallet_address||""; $("#set-network").value = s.usdt_network||"";
  $("#set-email").value = s.notification_email||""; $("#set-telegram").value = s.telegram_link||"";
}
// Remove = out for good (row deleted). Archive = set aside, can be restored.
async function subAction(id, what){
  if (what === "remove" && !confirm("Remove this subscriber for good? They will be deleted and cannot be restored.")) return;
  const method = what === "remove" ? "DELETE" : "PATCH";
  const url = what === "remove" ? `/api/admin/subscribers?id=${id}` : `/api/admin/subscribers?id=${id}&action=${what}`;
  const r = await fetch(url, { method, headers: adminHeaders() }); const j = await r.json().catch(()=>({}));
  if (!r.ok) { alert(j.error || "That did not work."); return; }
  loadAdmin();
}
$("#login-btn").addEventListener("click", () => { adminKey = $("#admin-key").value.trim(); sessionStorage.setItem("aw_admin_key", adminKey); loadAdmin(); });
$("#preview-btn").addEventListener("click", async () => {
  const id = $("#send-issue").value; if(!id) return;
  const r = await fetch(`/api/admin/issues/${id}/preview`, { headers: adminHeaders() }); const j = await r.json();
  $("#preview").textContent = j.ok ? `Subject: ${j.subject}\nRecipients: ${j.recipient_count}\n\n${j.body}` : (j.error||"Preview failed.");
});
$("#send-btn").addEventListener("click", async () => {
  if (!confirm("Send this issue to ALL active subscribers? This cannot be undone.")) return;
  const id = $("#send-issue").value; if(!id) return;
  $("#send-msg").textContent = "Sending…";
  const r = await fetch(`/api/admin/issues/${id}/send`, { method:"POST", headers: adminHeaders() }); const j = await r.json();
  $("#send-msg").textContent = j.ok ? `Sent: ${j.sent} delivered, ${j.failed} failed.` : (j.error||"Send failed.");
  $("#send-msg").className = j.ok ? "ok" : "err"; loadAdmin();
});
$("#export-btn").addEventListener("click", async () => {
  const r = await fetch("/api/admin/export", { headers: adminHeaders() }); const t = await r.text();
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([t],{type:"text/csv"})); a.download = "airdrop-lookout-subscribers.csv"; a.click();
});
$("#upload-file").addEventListener("change", async (e) => {
  const f = e.target.files[0]; if(!f) return;
  if (f.name.endsWith(".pdf")) { $("#upload-msg").textContent = "PDF selected — paste its text below (PDF text is not extracted in the browser)."; return; }
  $("#upload-text").value = await f.text();
});
$("#upload-btn").addEventListener("click", async () => {
  const body = { title: $("#upload-title").value.trim() || "Untitled issue", intro: $("#upload-text").value, status: "draft" };
  const r = await fetch("/api/admin/issues", { method:"POST", headers: adminHeaders(), body: JSON.stringify(body) }); const j = await r.json();
  $("#upload-msg").textContent = j.ok ? "Draft issue created from upload. Review it in Issues, then publish and send." : (j.error||"Upload failed.");
  $("#upload-msg").className = j.ok ? "ok" : "err"; loadAdmin();
});
$("#save-settings").addEventListener("click", async () => {
  const body = { usdt_wallet_address: $("#set-wallet").value.trim(), usdt_network: $("#set-network").value, notification_email: $("#set-email").value.trim(), telegram_link: $("#set-telegram").value.trim() };
  const r = await fetch("/api/admin/settings", { method:"POST", headers: adminHeaders(), body: JSON.stringify(body) }); const j = await r.json();
  $("#settings-msg").textContent = j.ok ? "Settings saved." : (j.error||"Save failed.");
});
loadBoard();
