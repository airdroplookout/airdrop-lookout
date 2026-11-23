-- Airdrop Lookout — seed: Issue 1 (real, checked 22 Nov 2026)
-- Run AFTER supabase/schema.sql, in Supabase Dashboard → SQL Editor.
-- Drops are inserted as 'active' (they were verified on 22 Nov 2026).
-- NOTE: deadlines in this seed are now historical for later runs — they are
-- the real Issue 1 record, not live advice. Do not re-run as "current" drops.

with ins as (
  insert into public.airdrops (name, token, chain, effort, deadline_at, status, eligibility, steps, source_url, verified, trust_score, notes) values
  ('Treehouse','TREE','Ethereum','easy','2026-11-25 07:00:00+00','active',
   'Any ONE of: held at least 500 “Final Nuts” at the Apr 25, 2026, 02:00 UTC snapshot; cast at least one vote in a Season 2 governance poll; hold a Treehouse Squirrel Council NFT. Wallets flagged in the Sybil check receive less or nothing.',
   '["Open the Season 2 claim on the gaiafoundation.xyz portal linked from Treehouse''s own site and docs.","Connect the same wallet you used in the campaign.","Claim once — anything unclaimed after Nov 25, 07:00 UTC returns to the treasury. 23.1 million TREE; the 180-day linear release finished Oct 26, so claiming now pays the full allocation at once."]'::jsonb,
   'https://www.treehouse.finance/', true, 92,
   'No DM links: Treehouse says it does not send claim links by direct message. 07:00 UTC Nov 25 is 2:00 a.m. Eastern — in practice, Tuesday night is your deadline.'),
  ('Doppler Finance','XDP','Base / XRP Ledger','easy','2026-11-28 12:00:00+00','active',
   'You must have registered a Base address by July 30, 2026. Registration is closed — this cannot be farmed now.',
   '["Open the Doppler claim portal from the project''s official site.","Connect the registered Base wallet — another address will not work; the allocation is tied to it.","Claim before Nov 28, 12:00 UTC. Unclaimed allocations expire. 100 million XDP — 1% of the 10 billion total supply. Fully unlocked, no vesting."]'::jsonb,
   'https://www.doppler.finance/', true, 90, 'Genesis airdrop claim ends Sat Nov 28, 12:00 UTC.'),
  ('Aster','ASTER','BNB Chain','medium','2026-12-04 12:00:00+00','active',
   'Stage 6 “Convergence”: only for participants who chose the full-allocation (100% vested) option back in April. That choice can no longer be changed. Took the half payout in spring? This window is not yours.',
   '["Open Aster''s official allocation page.","Connect the wallet you used in April.","Claim before Dec 4, 12:00 UTC. 64M ASTER in Stage 6."]'::jsonb,
   'https://www.asterdex.com/', true, 88, ''),
  ('Midnight','NIGHT','Cardano','medium','2026-12-04 12:00:00+00','active',
   'Glacier Drop: Cardano''s privacy-focused partner chain. Allocation arrives in four instalments, 25% each, 90 days apart.',
   '["Check the portal at midnight.gd — unclaimed instalments show a countdown to the next release.","Thaw ends Dec 4, then a 90-day grace period."]'::jsonb,
   'https://midnight.gd/', true, 88, ''),
  ('Predict.fun','PREDICT','—','medium','2026-12-18 09:00:00+00','active',
   'Season 1. Claim window opened Nov 18 at 09:00 UTC, 30-day window. Pick BEFORE you claim: A — Instant unlock, 35% now, you forfeit the other 65%; B — Vesting, 100% later after staking for 12 months. No choice? You get B by default.',
   '["Claim only at the airdrop page on predict.fun itself.","Confirm the live status on predict.fun before you act — some roundups reported a postponement."]'::jsonb,
   'https://predict.fun/', true, 82, 'The vesting choice is the whole decision.'),
  ('StandX','DUSD','BNB Chain / Solana','medium','2026-12-31 08:00:00+00','active',
   'Based on pre-deposits, mainnet volume, market making and referrals, with Sybil screening. Token launch cancelled, so rewards are paid in the DUSD stablecoin — one payment, no lockup.',
   '["Claim with the same wallet, on BNB Chain or Solana, only on the StandX website.","Claim before Dec 31, 08:00 UTC. Open since Nov 2."]'::jsonb,
   'https://standx.com/', true, 80, ''),
  ('Grass — Stage 2','USDC','Solana','easy','2027-01-22 00:00:00+00','active',
   'Supplied bandwidth during epochs 1 to 19.',
   '["Claim in USDC through the Grass dashboard.","Window ends Jan 22, 2027 — or sooner if all allocations are claimed first. Do not leave it to January."]'::jsonb,
   'https://www.grass.io/', true, 85, '')
  returning id, name
)
insert into public.issues (title, week_label, intro, safety_tip, status, published_at)
values (
  'Issue 1 — The deadline issue',
  'Week 1 · Sunday, November 22, 2026',
  'Three claim windows close in the next six days, and two of the most-shared “airdrops” online right now are not real. Work down the deadline board in date order. Every deadline is UTC. This is information, not financial advice. Rewards are never guaranteed. Airdrop Lookout lists eligibility rules, deadlines and steps. You check your own wallet yourself. We never ask for your wallet address, seed phrase or private key — and neither does any legitimate project. FAKES BUSTED: No Hyperliquid Season 2. No MetaMask MASK claim. Any site offering either is a scam. Farm now (points only, no token guaranteed): Monad, LayerZero v2. Just closed: Fables (FABLES) — points claim + PROLOGUE redemption closed Fri Nov 20, 23:59 UTC; unclaimed FABLES will not be minted later.',
  'Deadline weeks are when drainers work hardest. The closer a real claim gets to closing, the more fake copies of it appear. The 30-second rule: start from the project''s official website or verified account — never a DM — read what you are about to sign, and if anything feels rushed, close the tab and check again later. A real deadline is on the official page, not in a DM. Myth-buster: “A real claim might ask for my seed phrase to verify me.” False — always. No legitimate project ever needs your seed phrase or private key.',
  'published', '2026-11-22 12:00:00+00'
);

-- Link the 7 drops to Issue 1, in deadline order.
insert into public.issue_airdrops (issue_id, airdrop_id, position)
select i.id, a.id, row_number() over (order by a.deadline_at)
from public.issues i
join public.airdrops a on a.name in ('Treehouse','Doppler Finance','Aster','Midnight','Predict.fun','StandX','Grass — Stage 2')
where i.title = 'Issue 1 — The deadline issue'
on conflict do nothing;
