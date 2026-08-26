-- Run this in your Supabase SQL Editor to wipe the old user-based tables 
-- and cleanly install the new website-based schema.

-- 1. DROP EVERYTHING OLD
DROP TABLE IF EXISTS public.reign_events CASCADE;
DROP TABLE IF EXISTS public.live_presence CASCADE;
DROP TABLE IF EXISTS public.payments CASCADE;
DROP TABLE IF EXISTS public.user_achievements CASCADE;
DROP TABLE IF EXISTS public.website_achievements CASCADE;
DROP TABLE IF EXISTS public.achievements CASCADE;
DROP TABLE IF EXISTS public.replacements CASCADE;
DROP TABLE IF EXISTS public.current_holder CASCADE;

-- 2. RECREATE NEW WEBSITE-BASED SCHEMA
CREATE TABLE public.current_holder (
  id uuid primary key default '00000000-0000-0000-0000-000000000000'::uuid,
  current_price numeric(12, 2) not null check (current_price >= 0),
  replaced_at timestamptz default now() not null,
  custom_message text,
  website_url text not null default 'replaceme.lol',
  website_name text not null default 'ReplaceMe',
  website_logo text not null default '/replaceme-avatar.svg',
  logo_source text default 'fallback' not null,
  active_reign_id uuid,
  constraint sole_row check (id = '00000000-0000-0000-0000-000000000000'::uuid)
);

CREATE TABLE public.replacements (
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
  previous_holder_duration numeric not null,
  views_count integer default 0 not null,
  clicks_count integer default 0 not null,
  custom_message text,
  logo_source text default 'fallback' not null,
  created_at timestamptz default now() not null
);

CREATE TABLE public.payments (
  id uuid primary key default gen_random_uuid(),
  website_url text not null,
  dodo_payment_id text unique not null,
  amount numeric(12, 2) not null,
  status text not null,
  replacement_id uuid references public.replacements(id),
  metadata jsonb,
  created_at timestamptz default now() not null
);

CREATE TABLE public.achievements (
  id text primary key,
  name text not null,
  description text not null,
  icon text not null,
  color text not null
);

CREATE TABLE public.website_achievements (
  website_url text not null,
  achievement_id text references public.achievements(id) on delete cascade not null,
  earned_at timestamptz default now() not null,
  primary key (website_url, achievement_id)
);

CREATE TABLE public.reign_events (
  id uuid primary key default gen_random_uuid(),
  website_url text not null,
  replacement_id uuid,
  event_type text not null check (event_type in ('view', 'click')),
  client_id text not null,
  created_at timestamptz default now() not null,
  constraint unique_event_per_client unique (replacement_id, client_id, event_type)
);

-- 3. CREATE LIVE PRESENCE TABLE
CREATE TABLE public.live_presence (
  reign_id uuid not null,
  client_id text not null,
  last_seen_at timestamptz default now() not null,
  primary key (reign_id, client_id)
);

CREATE INDEX idx_live_presence_reign_time on public.live_presence(reign_id, last_seen_at);

-- 4. ENABLE RLS
ALTER TABLE public.current_holder ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access to current holder" on public.current_holder for select using (true);

ALTER TABLE public.replacements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access to replacements" on public.replacements for select using (true);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access to achievements" on public.achievements for select using (true);

ALTER TABLE public.website_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access to website achievements" on public.website_achievements for select using (true);

ALTER TABLE public.reign_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access to reign_events" on public.reign_events for select using (true);

ALTER TABLE public.live_presence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access to live_presence" on public.live_presence for select using (true);

-- 4. INSERT BASE DATA
DO $$
DECLARE
  v_genesis_reign_id uuid;
BEGIN
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

    INSERT INTO public.current_holder (id, current_price, replaced_at, custom_message, website_url, website_name, website_logo, logo_source, active_reign_id)
    VALUES (
      '00000000-0000-0000-0000-000000000000',
      1.00,
      now(),
      'Someone has to be first. Replace me to start the game.',
      'replaceme.lol',
      'ReplaceMe',
      '/replaceme-avatar.svg',
      'fallback',
      v_genesis_reign_id
    ) ON CONFLICT DO NOTHING;
  END IF;
END $$;

INSERT INTO public.achievements (id, name, description, icon, color) VALUES
  ('first_blood', 'First Blood', 'Became #1 for the very first time.', '🩸', 'red'),
  ('revenge', 'Revenge', 'Replaced the website that replaced you.', '🗡️', 'orange'),
  ('serial_replacer', 'Serial Replacer', 'Replaced 10 websites.', '🔪', 'purple'),
  ('unemployed', 'Unemployed', 'Got replaced 10 times.', '📦', 'gray'),
  ('big_spender', 'Big Spender', 'Spent over $100 total securing #1.', '💸', 'green'),
  ('untouchable', 'Untouchable', 'Held #1 for a full 24 hours.', '👑', 'yellow'),
  ('internet_menace', 'Internet Menace', 'Replaced the same website 3 times.', '🦹', 'pink')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color;
