-- Airdrop Lookout — Supabase schema
-- Run in Supabase Dashboard → SQL Editor. Postgres. Idempotent-ish: safe to run once on a fresh project.
-- Tables mirror the Muse site (airdrop-watch-2): subscribers, issues, airdrops,
-- issue_airdrops, payments, settings.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- subscribers
create table if not exists public.subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  status text not null default 'free_trial'
    check (status in ('free_trial','paid','unsubscribed')),
  free_trial_ends_at timestamptz,
  paid_until timestamptz,
  txid text,
  notes text,
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_subscribers_status on public.subscribers (status);
create index if not exists idx_subscribers_email on public.subscribers (email);

-- ---------------------------------------------------------------- issues
create table if not exists public.issues (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  week_label text,
  intro text,
  safety_tip text,
  status text not null default 'draft'
    check (status in ('draft','published')),
  published_at timestamptz,
  send_count int not null default 0,
  send_failed int not null default 0,
  last_send_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_issues_status on public.issues (status, published_at desc);

-- ---------------------------------------------------------------- airdrops
create table if not exists public.airdrops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  token text,
  chain text,
  effort text check (effort in ('easy','medium','hard')),
  deadline_at timestamptz,
  status text not null default 'draft_review'
    check (status in ('draft_review','active','expired','archived')),
  eligibility text,
  steps jsonb not null default '[]'::jsonb,   -- array of strings, in order
  source_url text,
  verified boolean not null default false,
  trust_score int check (trust_score between 0 and 100),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_airdrops_status_deadline on public.airdrops (status, deadline_at);

-- ---------------------------------------------------------------- issue_airdrops (many-to-many)
create table if not exists public.issue_airdrops (
  issue_id uuid not null references public.issues (id) on delete cascade,
  airdrop_id uuid not null references public.airdrops (id) on delete cascade,
  position int not null default 0,
  primary key (issue_id, airdrop_id)
);

-- ---------------------------------------------------------------- payments (USDT, manual)
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  subscriber_id uuid references public.subscribers (id) on delete set null,
  email text not null,
  amount_usdt numeric(10,2) not null default 5.00,
  txid text not null,
  network text,          -- TRC20 / ERC20 / BEP20
  verified boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_payments_email on public.payments (email);
create index if not exists idx_payments_txid on public.payments (txid);

-- ---------------------------------------------------------------- settings (single-row key/value)
create table if not exists public.settings (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);
insert into public.settings (key, value) values
  ('usdt_wallet_address', ''),
  ('usdt_network', ''),
  ('notification_email', ''),
  ('telegram_link', ''),
  ('site_domain', 'airdroplookout.com')
on conflict (key) do nothing;

-- ---------------------------------------------------------------- updated_at trigger
create or replace function public.set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;
drop trigger if exists trg_subscribers_updated on public.subscribers;
create trigger trg_subscribers_updated before update on public.subscribers for each row execute function public.set_updated_at();
drop trigger if exists trg_issues_updated on public.issues;
create trigger trg_issues_updated before update on public.issues for each row execute function public.set_updated_at();
drop trigger if exists trg_airdrops_updated on public.airdrops;
create trigger trg_airdrops_updated before update on public.airdrops for each row execute function public.set_updated_at();
drop trigger if exists trg_settings_updated on public.settings;
create trigger trg_settings_updated before update on public.settings for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- Row Level Security
-- Public (anon) may: read active airdrops + published issues, insert a subscriber
-- (signup), update only their own unsubscribe via the server function.
-- Everything else goes through the service-role key, which the Netlify
-- Functions use server-side. Never expose the service-role key in the browser.
alter table public.subscribers enable row level security;
alter table public.issues enable row level security;
alter table public.airdrops enable row level security;
alter table public.issue_airdrops enable row level security;
alter table public.payments enable row level security;
alter table public.settings enable row level security;

drop policy if exists "public read active airdrops" on public.airdrops;
create policy "public read active airdrops" on public.airdrops
  for select using (status = 'active');

drop policy if exists "public read published issues" on public.issues;
create policy "public read published issues" on public.issues
  for select using (status = 'published');

drop policy if exists "public read issue links" on public.issue_airdrops;
create policy "public read issue links" on public.issue_airdrops
  for select using (true);

drop policy if exists "public signup" on public.subscribers;
create policy "public signup" on public.subscribers
  for insert with check (true);

-- No public select/insert/update/delete on payments or settings.
-- (Service role bypasses RLS, so the Functions can still read/write them.)
