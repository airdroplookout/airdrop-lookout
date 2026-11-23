// scripts/weekly-issue.mjs — reference for the Muse weekly job.
// Not run by the site itself. A Muse scheduled job calls the admin API
// directly (see DEPLOY.md §6); this script is the same flow, runnable by hand.
// Usage:
//   SITE_URL=https://airdroplookout.com ADMIN_API_KEY=... \
//     node scripts/weekly-issue.mjs --test-email you@example.com
// Without --test-email it will PUBLISH and SEND to all subscribers — only run
// it after the preview step has been checked.
import { readFileSync } from "node:fs";

const SITE = process.env.SITE_URL || "https://airdroplookout.com";
const KEY = process.env.ADMIN_API_KEY;
if (!KEY) { console.error("ADMIN_API_KEY is required"); process.exit(1); }
const testEmail = process.argv.find((a, i, arr) => a === "--test-email" && arr[i + 1]) &&
  process.argv[process.argv.indexOf("--test-email") + 1];

const api = async (path, method = "GET", body) => {
  const r = await fetch(`${SITE}${path}`, {
    method,
    headers: { "content-type": "application/json", "x-admin-key": KEY },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status}: ${JSON.stringify(j)}`);
  return j;
};

// 1. Issue content is supplied by Dexter after researching + verifying drops.
//    Pass it as JSON on stdin, e.g. echo '{"title":...}' | node scripts/weekly-issue.mjs
//    Shape: { title, week_label, intro, safety_tip, airdrops: [{name,token,chain,effort,deadline_at,eligibility,steps,source_url,verified,notes}] }
let input = "";
process.stdin.on("data", (c) => (input += c));
process.stdin.on("end", async () => {
  try {
    const issue = JSON.parse(input || "{}");
    if (!issue.title || !Array.isArray(issue.airdrops)) throw new Error("stdin must be issue JSON with title + airdrops[]");
    const ids = [];
    for (const d of issue.airdrops) {
      const created = await api("/api/admin/airdrops", "POST", d);
      await api(`/api/admin/airdrops?id=${created.airdrop.id}&status=active`, "PATCH");
      ids.push(created.airdrop.id);
    }
    const createdIssue = await api("/api/admin/issues", "POST", { ...issue, airdrop_ids: ids });
    const id = createdIssue.issue.id;
    await api(`/api/admin/issues/${id}/publish`, "POST");
    const preview = await api(`/api/admin/issues/${id}/preview`);
    console.log("PREVIEW:", JSON.stringify(preview, null, 2));
    if (testEmail) {
      const sent = await api(`/api/admin/issues/${id}/send`, "POST", { test_email: testEmail });
      console.log("TEST SEND:", JSON.stringify(sent));
    } else {
      console.log("STOP — preview checked above. Re-run with --test-email to test, or call /send to send to all.");
    }
  } catch (e) { console.error("FAILED:", e.message); process.exit(1); }
});
