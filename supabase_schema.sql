-- Supabase Schema for ReplaceMe application

-- Enable uuid-ossp extension
create extension if not exists "uuid-ossp";

-- 1. CURRENT HOLDER TABLE (exactly one row holds the active #1)
create table if not exists public.current_holder (
  id uuid primary key default '00000000-0000-0000-0000-000000000000'::uuid,
  current_price numeric(12, 2) not null check (current_price >= 0),
  replaced_at timestamptz default now() not null,
  custom_message text,
  website_url text not null default 'replaceme.lol',
  website_name text not null default 'ReplaceMe',
  website_logo text not null default '/replaceme-avatar.svg',
  logo_source text default 'fallback' not null,
  created_at timestamptz default now() not null,
  active_reign_id uuid references public.replacements(id),
  -- Ensure only a single row can ever exist in this table
  constraint sole_row check (id = '00000000-0000-0000-0000-000000000000'::uuid)
);

-- Enable RLS for current_holder
alter table public.current_holder enable row level security;

-- Policies for current_holder
create policy "Allow public read access to current holder"
  on public.current_holder for select
  using (true);

-- 2. REPLACEMENTS TABLE (history of all replacements)
create table if not exists public.replacements (
  id uuid primary key default gen_random_uuid(),
  previous_website_url text,
  previous_website_name text,
  previous_website_logo text,
  new_website_url text not null,
  new_website_name text not null,
  new_website_logo text not null,
  amount_paid numeric(12, 2) not null,
  price_before numeric(12, 2) not null,
  price_after numeric(12, 2) not null,
  previous_holder_duration numeric, -- in seconds
  views_count integer default 0 not null,
  clicks_count integer default 0 not null,
  custom_message text,
  logo_source text default 'fallback' not null,
  created_at timestamptz default now() not null
);

-- Enable RLS for replacements
alter table public.replacements enable row level security;

-- Policies for replacements
create policy "Allow public read access to replacements history"
  on public.replacements for select
  using (true);


-- 3. PAYMENTS TABLE (Dodo Payments transactions tracking)
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  website_url text not null,
  dodo_payment_id text unique not null,
  amount numeric(12, 2) not null,
  status text not null,
  replacement_id uuid references public.replacements(id),
  metadata jsonb,
  created_at timestamptz default now() not null
);

-- Safely apply status constraint for migrations
alter table public.payments drop constraint if exists payments_status_check;
alter table public.payments add constraint payments_status_check check (status in ('pending', 'processing', 'succeeded', 'failed', 'refund_pending', 'refunded', 'refund_failed'));

-- Enable RLS for payments
alter table public.payments enable row level security;

-- Policies for payments
create policy "Allow users to view their own payments"
  on public.payments for select
  using (true); -- No longer locked to auth


-- 4. ACHIEVEMENTS TABLE
create table if not exists public.achievements (
  id text primary key,
  name text not null,
  description text not null,
  icon text not null
);

-- Enable RLS for achievements
alter table public.achievements enable row level security;

-- Policies for achievements
create policy "Allow public read access to achievements"
  on public.achievements for select
  using (true);


-- 5. WEBSITE ACHIEVEMENTS TABLE
create table if not exists public.website_achievements (
  website_url text not null,
  achievement_id text references public.achievements(id) on delete cascade not null,
  earned_at timestamptz default now() not null,
  primary key (website_url, achievement_id)
);

-- Enable RLS for website_achievements
alter table public.website_achievements enable row level security;

-- Policies for website_achievements
create policy "Allow public read access to earned achievements"
  on public.website_achievements for select
  using (true);


-- 6. REIGN EVENTS TABLE (Tracking views and clicks per reign)
create table if not exists public.reign_events (
  id uuid primary key default gen_random_uuid(),
  website_url text not null,
  replacement_id uuid, -- null if it's the genesis '00000000...' holder
  event_type text not null check (event_type in ('view', 'click')),
  client_id text not null,
  created_at timestamptz default now() not null,
  constraint unique_event_per_client unique (replacement_id, client_id, event_type)
);

create index idx_reign_events_website_type on public.reign_events(website_url, event_type);
create index idx_reign_events_replacement_id on public.reign_events(replacement_id);

alter table public.reign_events enable row level security;
create policy "Allow public read access to reign_events" on public.reign_events for select using (true);


-- 7. LIVE PRESENCE TABLE
create table if not exists public.live_presence (
  reign_id uuid not null,
  client_id text not null,
  last_seen_at timestamptz default now() not null,
  primary key (reign_id, client_id)
);

create index idx_live_presence_reign_time on public.live_presence(reign_id, last_seen_at);

alter table public.live_presence enable row level security;
create policy "Allow public read access to live_presence" on public.live_presence for select using (true);
create policy "Allow public insert to live_presence" on public.live_presence for insert with check (true);
create policy "Allow public update to live_presence" on public.live_presence for update using (true);


-- 8. SEED DATA SETUP
-- Insert genesis row into replacements
DO $$
DECLARE
  v_genesis_reign_id uuid;
BEGIN
  -- We don't want to duplicate if it already exists, so we'll just check
  IF NOT EXISTS (SELECT 1 FROM public.replacements WHERE previous_website_url = 'genesis') THEN
    INSERT INTO public.replacements (
      previous_website_url, previous_website_name, previous_website_logo,
      new_website_url, new_website_name, new_website_logo,
      amount_paid, price_before, price_after, previous_holder_duration,
      views_count, clicks_count, custom_message, logo_source
    ) VALUES (
      'genesis', 'Genesis', '',
      'replaceme.lol', 'ReplaceMe', '/replaceme-avatar.svg',
      0.00, 0.00, 1.00, 0,
      0, 0, 'Someone has to be first. Replace me to start the game.', 'fallback'
    ) RETURNING id INTO v_genesis_reign_id;

    -- Seed the initial holder row pointing to genesis
    insert into public.current_holder (id, current_price, custom_message, website_url, website_name, website_logo, replaced_at, logo_source, active_reign_id)
    values (
      '00000000-0000-0000-0000-000000000000',
      1.00,
      'Someone has to be first. Replace me to start the game.',
      'replaceme.lol',
      'ReplaceMe',
      '/replaceme-avatar.svg',
      now(),
      'fallback',
      v_genesis_reign_id
    ) on conflict (id) do nothing;
  END IF;
END $$;

-- Seed Achievements
insert into public.achievements (id, name, description, icon) values
  ('first_blood', 'FIRST BLOOD', 'Become #1 for the first time.', '👶'),
  ('revenge', 'REVENGE', 'Replace the person who replaced you.', '🔁'),
  ('untouchable', 'UNTOUCHABLE', 'Hold #1 for 24 hours.', '👑'),
  ('serial_replacer', 'SERIAL REPLACER', 'Replace 10 websites.', '💀'),
  ('unemployed', 'UNEMPLOYED', 'Get replaced 10 times.', '😭'),
  ('big_spender', 'BIG SPENDER', 'Spend over $100 total.', '💸'),
  ('internet_menace', 'INTERNET MENACE', 'Replace the same website multiple times in a public battle.', '🔥')
on conflict (id) do nothing;


-- 9. ANALYTICS INCREMENT RPCs
create or replace function public.increment_view(p_replacement_id uuid) returns void as $$
begin
  update public.replacements set views_count = views_count + 1 where id = p_replacement_id;
end;
$$ language plpgsql security definer;

create or replace function public.increment_click(p_replacement_id uuid) returns void as $$
begin
  update public.replacements set clicks_count = clicks_count + 1 where id = p_replacement_id;
end;
$$ language plpgsql security definer;


-- 10. ATOMIC REPLACEMENT AND PAYMENT PROCESSING
create or replace function public.process_payment_and_replace(
  p_payment_id text,
  p_new_website_url text,
  p_new_website_name text,
  p_new_website_logo text,
  p_amount_paid numeric,
  p_custom_message text,
  p_metadata jsonb,
  p_logo_source text default 'fallback'
) returns json as $$
declare
  v_replacement_id uuid;
  v_response json;
begin
  -- 1. Idempotency Check: if payment already processed, safely return
  if exists (select 1 from public.payments where dodo_payment_id = p_payment_id) then
    return json_build_object('status', 'already_processed');
  end if;

  -- 2. Insert history record (this is now the bid record)
  insert into public.replacements (
    previous_website_url,
    previous_website_name,
    previous_website_logo,
    new_website_url,
    new_website_name,
    new_website_logo,
    amount_paid,
    price_before,
    price_after,
    previous_holder_duration,
    views_count,
    clicks_count,
    custom_message,
    created_at,
    logo_source
  ) values (
    null,
    null,
    null,
    p_new_website_url,
    p_new_website_name,
    p_new_website_logo,
    p_amount_paid,
    0,
    0,
    0,
    0,
    0,
    p_custom_message,
    now(),
    p_logo_source
  ) returning id into v_replacement_id;

  -- PROCESS ACHIEVEMENTS
  
  -- 1. FIRST BLOOD (Participate for first time)
  if not exists (select 1 from public.website_achievements where website_url = p_new_website_url and achievement_id = 'first_blood') then
    insert into public.website_achievements (website_url, achievement_id, earned_at)
    values (p_new_website_url, 'first_blood', now())
    on conflict do nothing;
  end if;

  -- 3. SERIAL REPLACER (Now: Bid 10 times)
  if (select count(*) from public.replacements where new_website_url = p_new_website_url) >= 10 then
    if not exists (select 1 from public.website_achievements where website_url = p_new_website_url and achievement_id = 'serial_replacer') then
      insert into public.website_achievements (website_url, achievement_id, earned_at)
      values (p_new_website_url, 'serial_replacer', now())
      on conflict do nothing;
    end if;
  end if;

  -- 5. BIG SPENDER (Spend over $100 total)
  if (select coalesce(sum(amount_paid), 0) from public.replacements where new_website_url = p_new_website_url) >= 100.00 then
    if not exists (select 1 from public.website_achievements where website_url = p_new_website_url and achievement_id = 'big_spender') then
      insert into public.website_achievements (website_url, achievement_id, earned_at)
      values (p_new_website_url, 'big_spender', now())
      on conflict do nothing;
    end if;
  end if;

  -- 8. Insert successful payment record atomically
  insert into public.payments (website_url, dodo_payment_id, amount, status, replacement_id, metadata)
  values (
    p_new_website_url,
    p_payment_id,
    p_amount_paid,
    'succeeded',
    v_replacement_id,
    p_metadata
  );

  v_response := json_build_object(
    'success', true,
    'replacement_id', v_replacement_id
  );

  return v_response;
exception
  when unique_violation then
    -- A concurrent webhook successfully inserted this payment already
    return json_build_object('status', 'already_processed');
end;
$$ language plpgsql security definer;
