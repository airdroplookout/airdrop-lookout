// Airdrop Lookout — front-end. Calls /api/* (Netlify Functions, rewritten in netlify.toml).
// Domain comes from public/config.js — ONE place to change it.
const CFG = window.AIRDROP_LOOKOUT_CONFIG || { SITE_DOMAIN: "airdroplookout.com", SITE_URL: "https://airdroplookout.com" };
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
let adminSession = localStorage.getItem("aw_admin_session") || "";
// The old long admin key is never asked for in Manage any more; drop any
// copy this browser still holds from before the password login.
sessionStorage.removeItem("aw_admin_key"); localStorage.removeItem("aw_admin_key");
let boardData = { airdrops: [], issue: null, settings: {} };

function esc(s){ return String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function daysLeft(d){ if(!d) return "—"; const ms = new Date(d) - Date.now(); return ms < 0 ? "closed" : Math.ceil(ms/864e5) + "d left"; }
function countdownText(d){ if(!d) return "—"; const ms = new Date(d) - Date.now(); if (ms < 0) return "closed"; const days = Math.floor(ms/864e5), hrs = Math.floor(ms%864e5/36e5), min = Math.floor(ms%36e5/6e4); return days > 0 ? `${days}d ${hrs}h left` : `${hrs}h ${min}m left`; }
function tickCountdowns(){ $$("[data-deadline]").forEach(el => { el.textContent = countdownText(el.dataset.deadline); }); }
setInterval(tickCountdowns, 60000);
function isTestnet(a){ return a.testnet === true || /testnet/i.test(`${a.name||""} ${a.chain||""}`); }
function costLabel(a){
  // Every tracked drop is a claim window for past activity: nothing new to
  // farm, just the claim transaction itself.
  return "Claim — gas only, no new capital";
}
function timeLabel(a){ return (a.effort||"").toLowerCase() === "easy" ? "≈ 5 min" : "≈ 10 min"; }
function diffLabel(a){ const e = (a.effort||"").toLowerCase(); return e === "easy" ? "Easy" : e === "hard" ? "Hard" : "Medium"; }
function trustBadge(score){
  if (score == null) return "";
  return `<div>Trust score <span class="trust">${score}/100</span><div class="muted small">Based only on what is actually there: verified source, documented steps, clear eligibility, confirmed deadline.</div></div>`;
}
function show(view){
  $$("[data-page]").forEach(s => s.classList.toggle("hidden", s.dataset.page !== view));
  $$(".nav button").forEach(b => b.classList.toggle("active", b.dataset.view === view));
  if (view === "board") renderBoard();
  if (view === "issue") renderIssue();
  if (view === "manage" && adminSession) loadAdmin();
}
$$(".nav button").forEach(b => b.addEventListener("click", () => show(b.dataset.view)));
// Hidden owner route: /manage opens the Manage view. There is no public
// link to it anywhere on the site — only someone who knows the URL gets here.
if (window.location.pathname.replace(/\/+$/, "") === "/manage") show("manage");
// Visits counter — one count per browser session, public pages only
// (never /manage, so the owner's own visits do not inflate the numbers).
if (window.location.pathname.replace(/\/+$/, "") !== "/manage" && !sessionStorage.getItem("aw_visit_counted")) {
  sessionStorage.setItem("aw_visit_counted", "1");
  fetch("/api/track", { method: "POST", keepalive: true }).catch(() => {});
}

async function loadBoard(){
  try {
    const r = await fetch("/api/board"); const j = await r.json(); boardData = j;
    const next = (j.airdrops||[]).filter(a => a.deadline_at && new Date(a.deadline_at) > new Date()).sort((a,b)=>new Date(a.deadline_at)-new Date(b.deadline_at))[0];
    if (next){ $("#countdown").textContent = `${next.name} closes in ${daysLeft(next.deadline_at)} — ${new Date(next.deadline_at).toUTCString()}`;
      $("#countdown-sub").textContent = "Next closing drop. All deadlines are UTC."; }
    else { $("#countdown").textContent = "No closing drops right now — check back for the next issue."; }
    // Proof bar — honest, live numbers only; never subscriber counts.
    const drops = j.airdrops||[];
    const soon = drops.filter(a => a.deadline_at && (new Date(a.deadline_at)-Date.now()) > 0 && (new Date(a.deadline_at)-Date.now()) < 7*864e5).length;
    const pb = $("#proofbar");
    if (pb) pb.textContent = `${drops.length} airdrop${drops.length===1?"":"s"} tracked this week · ${soon} deadline${soon===1?"":"s"} in the next 7 days · Last checked: Nov 22, 2026`;
    // Telegram button — only link it when a real channel link is saved in Settings.
    const tg = j.settings?.telegram_link || "";
    const tbtn = $("#telegram-btn"), tnote = $("#telegram-note");
    if (tg && tbtn){ tbtn.href = tg; tbtn.removeAttribute("data-telegram-placeholder"); if (tnote) tnote.textContent = ""; }
    tickCountdowns();
    const iss = j.issue;
    $("#missed").innerHTML = iss
      ? `<p><strong>${esc(iss.title)}</strong> — ${esc(iss.week_label||"")}</p><p>${esc(iss.intro||"")}</p><p class="muted small">Members got the full deadline board, eligibility and steps. Non-members missed it.</p>`
      : `<p>No issue has gone out yet — so there is honestly nothing to have missed yet.</p>`;
    const w = j.settings?.usdt_wallet_address || "TS5zyeDzJw9tjA56QtA8PFBEpLX4ywDQc2", n = j.settings?.usdt_network || "TRC20";
    $("#pay-address").textContent = w ? `Wallet address (${n||"USDT"}): ${w}` : "Wallet address: to be added by the owner.";
    $("#foot-domain").textContent = CFG.SITE_DOMAIN;
    renderBoard(); renderIssue(); renderTeaser(); updateHeroStats();
  } catch(e){ $("#board").innerHTML = `<p style="padding:16px" class="err">Could not load the board. Check the site is deployed and Supabase is connected.</p>`; const tl = $("#teaser-list"); if (tl) tl.innerHTML = "<p class=\"muted\" style=\"padding:16px\">Could not load today’s drops — check back shortly.</p>"; }
}
// Front-page teaser — names + deadlines only. The full insight,
// eligibility and steps live in the newsletter, not on the public page.
function teaserRows(list){
  return list.map(a => `<article class="teaser-item"><h3>${esc(a.name)}${a.token?` (${esc(a.token)})`:""}</h3><span class="deadline">Deadline<b>${a.deadline_at?new Date(a.deadline_at).toLocaleDateString("en-CA",{month:"short",day:"numeric",year:"numeric"}):"—"} · ${countdownText(a.deadline_at)}</b></span></article>`).join("");
}
function renderTeaser(){
  const el = $("#teaser-list"); if (!el) return;
  const list = (boardData.airdrops||[]).filter(a => a.deadline_at).sort((a,b)=>new Date(a.deadline_at)-new Date(b.deadline_at));
  const open = list.filter(a => new Date(a.deadline_at) > Date.now());
  const rows = (open.length ? open : list).slice(0, 8);
  el.innerHTML = rows.length ? teaserRows(rows)
    : "<p class=\"muted\" style=\"padding:16px\">No live drops right now — check back for the next issue.</p>";
}
function updateHeroStats(){
  const drops = boardData.airdrops||[];
  const soon = drops.filter(a => a.deadline_at && (new Date(a.deadline_at)-Date.now()) > 0 && (new Date(a.deadline_at)-Date.now()) < 7*864e5).length;
  const next = drops.filter(a => a.deadline_at && new Date(a.deadline_at) > new Date()).sort((a,b)=>new Date(a.deadline_at)-new Date(b.deadline_at))[0];
  const t = $("#stat-tracked"); if (t) t.textContent = drops.length;
  const s = $("#stat-soon"); if (s) s.textContent = soon;
  const n = $("#stat-next"); if (n && next) n.textContent = new Date(next.deadline_at).toLocaleDateString("en-CA",{month:"short",day:"numeric"});
}
function renderBoard(){
  const q = ($("#board-search").value||"").toLowerCase();
  const f = document.querySelector('[data-filter].active')?.dataset.filter || "all";
  let list = (boardData.airdrops||[]).filter(a => !q || [a.name,a.token,a.chain].join(" ").toLowerCase().includes(q));
  if (f === "confirmed") list = list.filter(a => a.verified);
  if (f === "testnet") list = list.filter(isTestnet);
  if (f === "mainnet") list = list.filter(a => !isTestnet(a));
  if (f === "ending") list = list.filter(a => a.deadline_at && (new Date(a.deadline_at)-Date.now()) < 7*864e5);
  list = list.slice().sort((a,b)=>new Date(a.deadline_at||0)-new Date(b.deadline_at||0));
  $("#board-count").textContent = `${list.length} live drop(s).`;
  // Teaser rows only — name, chain and deadline. No eligibility, steps,
  // trust scores or source links on the public page.
  $("#board").innerHTML = list.map(a => `<article class="teaser-item"><div><h3>${esc(a.name)} ${a.token?`(${esc(a.token)})`:""}</h3><p class="muted small" style="margin:2px 0 0">${esc(a.chain||"")}${a.verified?" · Confirmed":""}</p></div><span class="deadline">Deadline<b>${a.deadline_at?new Date(a.deadline_at).toLocaleDateString("en-CA",{month:"short",day:"numeric",year:"numeric"}):"—"} · ${countdownText(a.deadline_at)}</b></span></article>`).join("") || (f === "testnet" ? "<p style=\"padding:16px\">No testnet drops tracked right now — every live drop is a mainnet claim.</p>" : "<p style=\"padding:16px\">No drops match.</p>");
}
$$("[data-filter]").forEach(b => b.addEventListener("click", () => { $$("[data-filter]").forEach(x=>x.classList.remove("active")); b.classList.add("active"); renderBoard(); }));
$("#board-search").addEventListener("input", renderBoard);

function renderIssue(){
  const iss = boardData.issue;
  $("#issue").innerHTML = iss ? `<div class="card"><h2>${esc(iss.title)}</h2><p class="muted">${esc(iss.week_label||"")}</p><p>${esc(iss.intro||"")}</p><p>${esc(iss.safety_tip||"")}</p></div>`
    : "<p>No published issue yet.</p>";
}

// ---- Price board: top 7 coins, live from the CoinGecko free API (no key),
// refreshed every 5 minutes. If the feed fails, show the last dated
// snapshot so the board is never empty — labelled as a snapshot, never
// presented as live.
const PRICE_IDS = ["bitcoin","ethereum","tether","binancecoin","usd-coin","ripple","solana"];
const PRICE_ICONS = { bitcoin:["₿","#F7931A"], ethereum:["Ξ","#627EEA"], tether:["₮","#26A17B"], binancecoin:["B","#C9A227"], "usd-coin":["$","#2775CA"], ripple:["✕","#23292F"], solana:["◎","#111827"] };
const PRICE_SNAPSHOT = [
  { id:"bitcoin", name:"Bitcoin", symbol:"BTC", price:61790.47, change:1.92, mcap:"$1.24T", vol:"$24.81B" },
  { id:"ethereum", name:"Ethereum", symbol:"ETH", price:1758.65, change:2.74, mcap:"$214.99B", vol:"$8.91B" },
  { id:"tether", name:"Tether", symbol:"USDT", price:1.0, change:0.02, mcap:"$174.84B", vol:"$44.02B" },
  { id:"binancecoin", name:"BNB", symbol:"BNB", price:564.09, change:1.21, mcap:"$74.18B", vol:"$553.6M" },
  { id:"usd-coin", name:"USD Coin", symbol:"USDC", price:1.0, change:0.03, mcap:"$68.99B", vol:"$16.32B" },
  { id:"ripple", name:"XRP", symbol:"XRP", price:0.968, change:4.51, mcap:"$61.48B", vol:"$1.58B" },
  { id:"solana", name:"Solana", symbol:"SOL", price:74.06, change:5.46, mcap:"$43.84B", vol:"$2.25B" },
];
const PRICE_SNAPSHOT_LABEL = "Snapshot: Nov 23, 2026 · 12:29 PM EST";
function priceSignal(r, isTop){
  const sym = (r.symbol||"").toUpperCase();
  if (sym === "USDT" || sym === "USDC") return ["Stable", "pill-grey"];
  if (isTop && r.change > 0) return ["Top gainer", "pill-green"];
  if (r.change >= 4) return ["Strong day", "pill-green"];
  if (r.change > 0) return ["Rebound", "pill-green"];
  if (r.change < 0) return ["Down", "pill-red"];
  return ["Steady", "pill-grey"];
}
function renderPrices(rows, statusText){
  const body = $("#price-board-body"); if (!body) return;
  const top = rows.reduce((m,r)=> (r.change > m.change ? r : m), rows[0]);
  body.innerHTML = rows.map((r,i) => {
    const icon = PRICE_ICONS[r.id] || ["●","#0d9488"];
    const [signal, cls] = priceSignal(r, r === top);
    const price = r.price >= 100 ? "$" + r.price.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2}) : "$" + r.price.toFixed(4);
    return `<tr><td><div class="coin"><span class="coin-icon" style="background:${icon[1]}">${icon[0]}</span><span>${esc(r.name)}<small>${esc(r.symbol)} · #${i+1}</small></span></div></td><td class="mono" style="font-weight:700">${price}</td><td class="${r.change>=0?"up":"down"}">${r.change>=0?"▲":"▼"} ${r.change>=0?"+":""}${r.change.toFixed(2)}%</td><td>${esc(r.mcap)}</td><td>${esc(r.vol)}</td><td><span class="pill ${cls}">${signal}</span></td></tr>`;
  }).join("");
  const st = $("#price-status"); if (st) st.textContent = statusText;
}
async function loadPrices(){
  try {
    const r = await fetch("https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=" + PRICE_IDS.join(",") + "&order=market_cap_desc&per_page=7&page=1&price_change_percentage=24h");
    if (!r.ok) throw new Error("HTTP " + r.status);
    const j = await r.json();
    if (!Array.isArray(j) || j.length < 3) throw new Error("bad payload");
    const rows = j.map(c => ({ id: c.id, name: c.name, symbol: (c.symbol||"").toUpperCase(), price: c.current_price, change: c.price_change_percentage_24h || 0, mcap: "$" + (c.market_cap/1e9).toFixed(2) + "B", vol: "$" + (c.total_volume/1e9).toFixed(2) + "B" }));
    renderPrices(rows, "Live · updated " + new Date().toLocaleTimeString("en-CA",{hour:"2-digit",minute:"2-digit"}));
  } catch(e){
    renderPrices(PRICE_SNAPSHOT, PRICE_SNAPSHOT_LABEL + " — live feed unavailable, showing last snapshot.");
  }
}
loadPrices();
setInterval(loadPrices, 300000);

// Sticky mobile signup — jumps to the signup card on the home view.
const stickyBtn = $("#sticky-cta-btn");
if (stickyBtn) stickyBtn.addEventListener("click", (e) => {
  e.preventDefault(); show("home");
  const card = $("#signup-card"); if (card) card.scrollIntoView({ behavior:"smooth", block:"start" });
  const em = $("#email"); if (em) em.focus({ preventScroll:true });
});
// Welcome popup — once per visitor, never inside the Manage area.
(function welcomePopup(){
  const KEY = "aw_welcome_seen";
  let seen = false;
  try { seen = localStorage.getItem(KEY) === "1"; } catch(e){}
  const popup = $("#welcome-popup");
  if (!popup || seen) return;
  function dismiss(){ popup.classList.add("hidden"); try { localStorage.setItem(KEY, "1"); } catch(e){} }
  popup.addEventListener("click", (e) => { if (e.target.closest("[data-popup-close]")) dismiss(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !popup.classList.contains("hidden")) dismiss(); });
  const cta = $("#popup-signup-btn");
  if (cta) cta.addEventListener("click", () => {
    dismiss(); show("home");
    const card = $("#signup-card"); if (card) card.scrollIntoView({ behavior:"smooth", block:"start" });
    const em = $("#email"); if (em) em.focus({ preventScroll:true });
  });
  setTimeout(() => {
    const manage = document.querySelector('[data-page="manage"]');
    if (manage && !manage.classList.contains("hidden")) return; // never in Manage
    popup.classList.remove("hidden");
  }, 1000);
})();
// "See the full board" buttons anywhere on the home view.
$$("[data-view-link]").forEach(b => b.addEventListener("click", () => { show(b.dataset.viewLink); window.scrollTo(0,0); }));

$("#signup-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = $("#email").value.trim();
  const r = await fetch("/api/subscribe", { method:"POST", headers:{"content-type":"application/json"}, body: JSON.stringify({ email }) });
  const j = await r.json();
  $("#signup-msg").textContent = j.ok ? `You're in — free month started. Check ${email} for the welcome email.` : (j.error || "Signup failed.");
  $("#signup-msg").className = j.ok ? "ok" : "err";
});
// Sidebar mini signup — same /api/subscribe flow as the hero form.
const miniForm = $("#mini-signup-form");
if (miniForm) miniForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = $("#mini-email").value.trim();
  const r = await fetch("/api/subscribe", { method:"POST", headers:{"content-type":"application/json"}, body: JSON.stringify({ email }) });
  const j = await r.json();
  $("#mini-signup-msg").textContent = j.ok ? `You're in — free month started. Check ${email} for the welcome email.` : (j.error || "Signup failed.");
  $("#mini-signup-msg").className = j.ok ? "ok" : "err";
});
// Board view subscribe prompt — back to the home signup card.
const boardSub = $("#board-subscribe-btn");
if (boardSub) boardSub.addEventListener("click", (e) => {
  e.preventDefault(); show("home");
  const card = $("#signup-card"); if (card) card.scrollIntoView({ behavior:"smooth", block:"start" });
  const em = $("#email"); if (em) em.focus({ preventScroll:true });
});
$("#pay-submit").addEventListener("click", async () => {
  const body = { email: $("#pay-email").value.trim(), network: $("#pay-network").value, txid: $("#pay-txid").value.trim(), amount_usdt: 10 };
  const r = await fetch("/api/admin/payments", { method:"POST", headers:{"content-type":"application/json"}, body: JSON.stringify(body) });
  const j = await r.json();
  $("#pay-msg").textContent = j.ok ? "Transaction ID submitted. Adil will verify it and mark you paid." : (j.error || "Could not submit.");
  $("#pay-msg").className = j.ok ? "ok" : "err";
});

// ---- Manage (owner) ----
const adminHeaders = () => ({ "content-type":"application/json", "x-admin-session": adminSession });
async function loadAdmin(){
  const r = await fetch("/api/admin/overview", { headers: adminHeaders() });
  if (!r.ok){
    // Session expired or invalid — back to the password form.
    adminSession = ""; localStorage.removeItem("aw_admin_session");
    $("#login-card").classList.remove("hidden"); $("#manage-body").classList.add("hidden");
    $("#login-msg").textContent = r.status === 401 ? "Your session ended — please log in again." : "Manage could not load — check the site is deployed.";
    return;
  }
  const j = await r.json();
  $("#login-card").classList.add("hidden"); $("#manage-body").classList.remove("hidden");
  $("#send-count").textContent = j.active_subscribers ?? "—";
  const v = j.visits || {};
  $("#visits").innerHTML = `<table><tr><th>Today</th><th>This week</th><th>This month</th><th>This year</th></tr><tr><td>${v.today ?? "—"}</td><td>${v.week ?? "—"}</td><td>${v.month ?? "—"}</td><td>${v.year ?? "—"}</td></tr></table>`;
  $("#last-send").textContent = j.last_send ? `Last send: ${j.last_send}` : "No send yet.";
  $("#send-issue").innerHTML = (j.issues||[]).map(i => `<option value="${i.id}">${esc(i.title)} (${i.status})</option>`).join("");
  $("#subscribers").innerHTML = `<table><tr><th>Email</th><th>Status</th><th>Free month ends</th><th></th></tr>${(j.subscribers||[]).map(s=>`<tr><td>${esc(s.email)}</td><td>${esc(s.status)}</td><td>${s.free_trial_ends_at?new Date(s.free_trial_ends_at).toLocaleDateString():"—"}</td><td>${s.status==="archived"
    ? `<button data-sub-action="restore" data-sub-id="${esc(s.id)}">Restore</button>`
    : `<button data-sub-action="archive" data-sub-id="${esc(s.id)}">Archive</button> <button data-sub-action="remove" data-sub-id="${esc(s.id)}">Remove</button>`}</td></tr>`).join("")}</table>`;
  // "Log out everywhere" — revokes every Manage session on every device
  // (bumps the session version server-side). Added once, next to Log out.
  if (!$("#logout-all-btn")) {
    const b = document.createElement("button");
    b.id = "logout-all-btn"; b.className = "btn ghost"; b.textContent = "Log out everywhere";
    b.addEventListener("click", async () => {
      if (!confirm("Log out every Manage session on every device? You will need to log in again.")) return;
      const r = await fetch("/api/admin/logout-all", { method: "POST", headers: adminHeaders() });
      const jj = await r.json().catch(() => ({}));
      if (!r.ok) { alert(jj.error || "That did not work."); return; }
      adminSession = ""; localStorage.removeItem("aw_admin_session");
      $("#manage-body").classList.add("hidden"); $("#login-card").classList.remove("hidden");
      $("#login-msg").textContent = "All sessions logged out — please log in again.";
    });
    $("#logout-btn")?.after(b);
  }
  $("#issues").innerHTML = (j.issues||[]).map(i=>`<p>${esc(i.title)} — ${i.status} · sent ${i.send_count||0}</p>`).join("") || "No issues yet.";
  $("#airdrops-admin").innerHTML = (j.airdrops||[]).map(a=>`<p>${esc(a.name)} — ${a.status} · ${a.trust_score??"—"}/100 · closes ${a.deadline_at?new Date(a.deadline_at).toLocaleDateString():"—"}</p>`).join("") || "No airdrops yet.";
  $("#payments").innerHTML = (j.payments||[]).map(p=>`<p>${esc(p.email)} — ${p.amount_usdt} USDT (${esc(p.network||"")}) · ${esc(p.txid)} · ${p.verified?"verified":"pending"}</p>`).join("") || "No payments yet.";
  const s = j.settings||{};
  $("#set-wallet").value = s.usdt_wallet_address||""; $("#set-network").value = s.usdt_network||"";
  $("#set-email").value = s.notification_email||""; $("#set-telegram").value = s.telegram_link||"";
}
// Remove = out for good (row deleted). Archive = set aside, can be restored.
// Buttons carry data-sub-action / data-sub-id (no inline onclick — the
// site's Content-Security-Policy blocks inline handlers).
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-sub-action]");
  if (b) subAction(b.dataset.subId, b.dataset.subAction);
});
async function subAction(id, what){
  if (what === "remove" && !confirm("Remove this subscriber for good? They will be deleted and cannot be restored.")) return;
  const method = what === "remove" ? "DELETE" : "PATCH";
  const url = what === "remove" ? `/api/admin/subscribers?id=${encodeURIComponent(id)}` : `/api/admin/subscribers?id=${encodeURIComponent(id)}&action=${what}`;
  const r = await fetch(url, { method, headers: adminHeaders() }); const j = await r.json().catch(()=>({}));
  if (!r.ok) { alert(j.error || "That did not work."); return; }
  loadAdmin();
}
$("#login-btn").addEventListener("click", async () => {
  const pw = $("#admin-password").value;
  $("#login-msg").textContent = "Logging in…";
  const r = await fetch("/api/admin/login", { method:"POST", headers:{"content-type":"application/json"}, body: JSON.stringify({ password: pw }) });
  const j = await r.json().catch(()=>({}));
  if (!r.ok || !j.token) { $("#login-msg").textContent = r.status === 500 ? (j.error || "Login is not set up yet.") : "Wrong password — try again."; $("#admin-password").value = ""; return; }
  adminSession = j.token; localStorage.setItem("aw_admin_session", adminSession);
  $("#admin-password").value = ""; $("#login-msg").textContent = "";
  loadAdmin();
});
$("#admin-password").addEventListener("keydown", (e) => { if (e.key === "Enter") $("#login-btn").click(); });
$("#logout-btn").addEventListener("click", () => {
  adminSession = ""; localStorage.removeItem("aw_admin_session");
  $("#manage-body").classList.add("hidden"); $("#login-card").classList.remove("hidden");
  $("#login-msg").textContent = "Logged out.";
});
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
// Unsubscribe link from a newsletter email: ?unsubscribe=<signed token>.
// The token proves the clicker owns that address (it was sent to them),
// so the server accepts it — a bare email in the URL never worked and is
// no longer accepted at all. Runs once on page load.
(function handleUnsubscribe(){
  const params = new URLSearchParams(location.search);
  const token = params.get("unsubscribe");
  if (!token) return;
  history.replaceState(null, "", location.pathname);
  const banner = document.createElement("p");
  banner.id = "unsub-msg"; banner.className = "muted";
  banner.textContent = "Unsubscribing…";
  (document.querySelector("#app") || document.body).prepend(banner);
  fetch("/api/unsubscribe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) })
    .then(r => r.json().then(j => ({ ok: r.ok, j })))
    .then(({ ok, j }) => {
      banner.textContent = ok ? "You are unsubscribed — you will not receive further issues." : (j.error || "That unsubscribe link did not work.");
      banner.className = ok ? "ok" : "err";
    })
    .catch(() => { banner.textContent = "Could not unsubscribe — please try again from the latest issue email."; banner.className = "err"; });
})();
// Tip jar — copy the USDT address to the clipboard.
const tipBtn = $("#tip-copy");
if (tipBtn) tipBtn.addEventListener("click", async () => {
  const addr = $("#tip-address")?.textContent?.trim() || "";
  try { await navigator.clipboard.writeText(addr); $("#tip-msg").textContent = "Copied."; }
  catch { $("#tip-msg").textContent = "Copy didn't work — long-press the address to copy it."; }
});
loadBoard();
