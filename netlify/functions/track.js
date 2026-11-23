// Netlify Function — POST /api/track counts one visit for today.
// Public endpoint, but it only ever increments a counter and returns the
// new total for today — no visitor data is read, stored or exposed.
// Known bots are skipped by User-Agent, and the front-end calls it at most
// once per browser session, so refreshes do not inflate the count.
// Counts start the day this was added — earlier visits were never tracked.
import { json, sbJson, handlerFor, torontoToday } from "./_lib.js";
const BOT = /bot|crawl|spider|slurp|facebookexternal|twitterbot|linkedinbot|googlebot|bingbot|yandex|baidu|duckduckbot|ahrefs|screaming|semrush|mj12|petal|bytespider|gptbot|claudebot|ccbot|headless|phantomjs/i;
async function onPost(context) {
  const ua = context.request.headers.get("user-agent") || "";
  if (!ua || BOT.test(ua)) return json({ ok: true, counted: false });
  const today = torontoToday();
  try {
    const n = await sbJson(context, "rpc/bump_visit", { method: "POST", body: JSON.stringify({ p_day: today }) });
    return json({ ok: true, counted: true, today: n });
  } catch (e) { return json({ ok: false, error: String(e.message || e) }, 500); }
}
export const handler = handlerFor({ POST: onPost });
