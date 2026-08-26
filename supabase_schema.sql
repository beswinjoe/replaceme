-- Supabase Schema for ReplaceMe application

-- Enable uuid-ossp extension
create extension if not exists "uuid-ossp";

-- 1. USERS TABLE
create table public.users (
  id uuid references auth.users on delete cascade primary key,
  username text unique not null,
  display_name text,
  avatar_url text,
  bio text,
  website_url text,
  created_at timestamptz default now() not null
);

-- Enable RLS for users
alter table public.users enable row level security;

-- Policies for users
create policy "Allow public read access to profiles"
  on public.users for select
  using (true);

create policy "Allow users to update their own profile"
  on public.users for update
  using (auth.uid() = id)
  with check (auth.uid() = id);


-- 2. CURRENT HOLDER TABLE (exactly one row holds the active #1)
create table public.current_holder (
  id uuid primary key default '00000000-0000-0000-0000-000000000000'::uuid,
  user_id uuid references public.users(id) not null,
  current_price numeric(12, 2) not null check (current_price >= 0),
  replaced_at timestamptz default now() not null,
  custom_message text,
  website_url text,
  created_at timestamptz default now() not null,
  -- Ensure only a single row can ever exist in this table
  constraint sole_row check (id = '00000000-0000-0000-0000-000000000000'::uuid)
);

-- Enable RLS for current_holder
alter table public.current_holder enable row level security;

-- Policies for current_holder
create policy "Allow public read access to current holder"
  on public.current_holder for select
  using (true);


-- 3. REPLACEMENTS TABLE (history of all replacements)
create table public.replacements (
  id uuid primary key default gen_random_uuid(),
  previous_user_id uuid references public.users(id),
  new_user_id uuid references public.users(id) not null,
  amount_paid numeric(12, 2) not null,
  price_before numeric(12, 2) not null,
  price_after numeric(12, 2) not null,
  previous_holder_duration numeric, -- in seconds
  custom_message text,
  website_url text,
  created_at timestamptz default now() not null
);

-- Enable RLS for replacements
alter table public.replacements enable row level security;

-- Policies for replacements
create policy "Allow public read access to replacements history"
  on public.replacements for select
  using (true);


-- 4. PAYMENTS TABLE (Dodo Payments transactions tracking)
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) not null,
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
  using (auth.uid() = user_id);


-- 5. ACHIEVEMENTS TABLE
create table public.achievements (
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


-- 6. USER ACHIEVEMENTS TABLE
create table public.user_achievements (
  user_id uuid references public.users(id) on delete cascade not null,
  achievement_id text references public.achievements(id) on delete cascade not null,
  earned_at timestamptz default now() not null,
  primary key (user_id, achievement_id)
);

-- Enable RLS for user_achievements
alter table public.user_achievements enable row level security;

-- Policies for user_achievements
create policy "Allow public read access to earned achievements"
  on public.user_achievements for select
  using (true);


-- 7. NOTIFICATIONS TABLE
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade not null,
  type text not null, -- 'replaced', 'achievement', etc.
  title text not null,
  message text not null,
  action_url text,
  read boolean default false not null,
  created_at timestamptz default now() not null
);

-- Enable RLS for notifications
alter table public.notifications enable row level security;

-- Policies for notifications
create policy "Allow users to read their own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

create policy "Allow users to update/read-status their own notifications"
  on public.notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- 8. SYSTEM USER AND SEED DATA SETUP
-- Insert system user into auth.users first to satisfy foreign key constraint
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at)
values (
  '00000000-0000-0000-0000-000000000000'::uuid,
  '00000000-0000-0000-0000-000000000000'::uuid,
  'authenticated',
  'authenticated',
  'system@replaceme.lol',
  'placeholder_password_hash',
  now()
) on conflict (id) do nothing;

-- Insert system user (for initial state)
insert into public.users (id, username, display_name, avatar_url, bio, website_url)
values (
  '00000000-0000-0000-0000-000000000000'::uuid,
  'replaceme',
  'ReplaceMe',
  '/replaceme-avatar.svg',
  'Someone has to be first. Replace me to start the game.',
  'https://replaceme.lol'
) on conflict (id) do nothing;

-- Seed the initial holder row
insert into public.current_holder (id, user_id, current_price, custom_message, website_url, replaced_at)
values (
  '00000000-0000-0000-0000-000000000000'::uuid,
  '00000000-0000-0000-0000-000000000000'::uuid,
  1.00,
  'Someone has to be first. Replace me!',
  'https://replaceme.lol',
  now()
) on conflict (id) do nothing;

-- Seed Achievements
insert into public.achievements (id, name, description, icon) values
  ('first_blood', 'FIRST BLOOD', 'Become #1 for the first time.', '👶'),
  ('revenge', 'REVENGE', 'Replace the person who replaced you.', '🔁'),
  ('untouchable', 'UNTOUCHABLE', 'Hold #1 for 24 hours.', '👑'),
  ('serial_replacer', 'SERIAL REPLACER', 'Replace 10 people.', '💀'),
  ('unemployed', 'UNEMPLOYED', 'Get replaced 10 times.', '😭'),
  ('big_spender', 'BIG SPENDER', 'Spend over $100 total.', '💸'),
  ('internet_menace', 'INTERNET MENACE', 'Replace the same person multiple times in a public battle.', '🔥')
on conflict (id) do nothing;


-- 9. ATOMIC REPLACEMENT AND PAYMENT PROCESSING
create or replace function public.process_payment_and_replace(
  p_payment_id text,
  p_new_user_id uuid,
  p_amount_paid numeric,
  p_custom_message text,
  p_website_url text,
  p_metadata jsonb
) returns json as $$
declare
  v_prev_user_id uuid;
  v_prev_username text;
  v_new_username text;
  v_current_price numeric;
  v_replaced_at timestamptz;
  v_duration numeric;
  v_growth_multiplier numeric := 1.20; -- Price grows by 20%
  v_new_price numeric;
  v_replacement_id uuid;
  v_response json;
begin
  -- 1. Idempotency Check: if payment already processed, safely return
  if exists (select 1 from public.payments where dodo_payment_id = p_payment_id) then
    return json_build_object('status', 'already_processed');
  end if;

  -- 2. Lock current_holder for update to prevent concurrent updates
  select user_id, current_price, replaced_at
  into v_prev_user_id, v_current_price, v_replaced_at
  from public.current_holder
  where id = '00000000-0000-0000-0000-000000000000'::uuid
  for update;

  -- 3. Verify payment amount matches/exceeds current price (Stale Price Check)
  if p_amount_paid < v_current_price then
    -- Atomically log the payment as refund_pending to block retries and prep for refund
    insert into public.payments (user_id, dodo_payment_id, amount, status, metadata)
    values (
      p_new_user_id, 
      p_payment_id, 
      p_amount_paid, 
      'refund_pending', 
      p_metadata || jsonb_build_object('reason', 'stale_price', 'required_price', v_current_price)
    );

    return json_build_object(
      'status', 'stale_price',
      'required_price', v_current_price,
      'amount_paid', p_amount_paid
    );
  end if;

  -- Get usernames
  select username into v_new_username from public.users where id = p_new_user_id;
  select username into v_prev_username from public.users where id = v_prev_user_id;

  -- Calculate duration in seconds
  v_duration := extract(epoch from (now() - v_replaced_at));

  -- Calculate new price (rounded to 2 decimal places)
  v_new_price := round((v_current_price * v_growth_multiplier)::numeric, 2);

  -- Insert history record
  insert into public.replacements (
    previous_user_id,
    new_user_id,
    amount_paid,
    price_before,
    price_after,
    previous_holder_duration,
    custom_message,
    website_url,
    created_at
  ) values (
    v_prev_user_id,
    p_new_user_id,
    p_amount_paid,
    v_current_price,
    v_new_price,
    v_duration,
    p_custom_message,
    p_website_url,
    now()
  ) returning id into v_replacement_id;

  -- Update current holder state
  update public.current_holder
  set user_id = p_new_user_id,
      current_price = v_new_price,
      replaced_at = now(),
      custom_message = p_custom_message,
      website_url = p_website_url
  where id = '00000000-0000-0000-0000-000000000000'::uuid;

  -- Send notification to previous user (unless it's the system user)
  if v_prev_user_id != '00000000-0000-0000-0000-000000000000'::uuid then
    insert into public.notifications (
      user_id,
      type,
      title,
      message,
      action_url,
      created_at
    ) values (
      v_prev_user_id,
      'replaced',
      '💀 YOU GOT REPLACED',
      concat('@', coalesce(v_new_username, 'someone'), ' paid $', p_amount_paid::text, ' to take your #1 spot.'),
      '/',
      now()
    );
  end if;

  -- PROCESS ACHIEVEMENTS
  
  -- 1. FIRST BLOOD (Become #1 for first time)
  if not exists (select 1 from public.user_achievements where user_id = p_new_user_id and achievement_id = 'first_blood') then
    insert into public.user_achievements (user_id, achievement_id, earned_at)
    values (p_new_user_id, 'first_blood', now())
    on conflict do nothing;

    insert into public.notifications (user_id, type, title, message, action_url)
    values (
      p_new_user_id, 
      'achievement', 
      '👶 ACHIEVEMENT UNLOCKED: FIRST BLOOD', 
      'You became #1 for the first time!', 
      concat('/@', coalesce(v_new_username, ''))
    );
  end if;

  -- 2. REVENGE (Replace the person who replaced you)
  -- Checks if there is a replacement where p_new_user_id was the previous holder and v_prev_user_id was the new holder
  if exists (
    select 1 from public.replacements
    where previous_user_id = p_new_user_id
    and new_user_id = v_prev_user_id
    order by created_at desc
    limit 1
  ) then
    insert into public.user_achievements (user_id, achievement_id, earned_at)
    values (p_new_user_id, 'revenge', now())
    on conflict do nothing;

    insert into public.notifications (user_id, type, title, message, action_url)
    values (
      p_new_user_id, 
      'achievement', 
      '🔁 ACHIEVEMENT UNLOCKED: REVENGE', 
      concat('You took back #1 from @', coalesce(v_prev_username, 'someone'), '!'), 
      concat('/@', coalesce(v_new_username, ''))
    );
  end if;

  -- 3. SERIAL REPLACER (Replace 10 people)
  if (select count(*) from public.replacements where new_user_id = p_new_user_id) >= 10 then
    if not exists (select 1 from public.user_achievements where user_id = p_new_user_id and achievement_id = 'serial_replacer') then
      insert into public.user_achievements (user_id, achievement_id, earned_at)
      values (p_new_user_id, 'serial_replacer', now())
      on conflict do nothing;

      insert into public.notifications (user_id, type, title, message, action_url)
      values (
        p_new_user_id, 
        'achievement', 
        '💀 ACHIEVEMENT UNLOCKED: SERIAL REPLACER', 
        'You have replaced 10 people!', 
        concat('/@', coalesce(v_new_username, ''))
      );
    end if;
  end if;

  -- 4. UNEMPLOYED (Get replaced 10 times)
  if v_prev_user_id != '00000000-0000-0000-0000-000000000000'::uuid then
    if (select count(*) from public.replacements where previous_user_id = v_prev_user_id) >= 10 then
      if not exists (select 1 from public.user_achievements where user_id = v_prev_user_id and achievement_id = 'unemployed') then
        insert into public.user_achievements (user_id, achievement_id, earned_at)
        values (v_prev_user_id, 'unemployed', now())
        on conflict do nothing;

        insert into public.notifications (user_id, type, title, message, action_url)
        values (
          v_prev_user_id, 
          'achievement', 
          '😭 ACHIEVEMENT UNLOCKED: UNEMPLOYED', 
          'You got replaced 10 times! Get some help...', 
          concat('/@', coalesce(v_prev_username, ''))
        );
      end if;
    end if;
  end if;

  -- 5. BIG SPENDER (Spend over $100 total)
  if (select coalesce(sum(amount_paid), 0) from public.replacements where new_user_id = p_new_user_id) >= 100.00 then
    if not exists (select 1 from public.user_achievements where user_id = p_new_user_id and achievement_id = 'big_spender') then
      insert into public.user_achievements (user_id, achievement_id, earned_at)
      values (p_new_user_id, 'big_spender', now())
      on conflict do nothing;

      insert into public.notifications (user_id, type, title, message, action_url)
      values (
        p_new_user_id, 
        'achievement', 
        '💸 ACHIEVEMENT UNLOCKED: BIG SPENDER', 
        'You have spent over $100 becoming #1!', 
        concat('/@', coalesce(v_new_username, ''))
      );
    end if;
  end if;

  -- 6. UNTOUCHABLE (Hold #1 for 24 hours - 86400 seconds)
  if v_duration >= 86400.0 and v_prev_user_id != '00000000-0000-0000-0000-000000000000'::uuid then
    if not exists (select 1 from public.user_achievements where user_id = v_prev_user_id and achievement_id = 'untouchable') then
      insert into public.user_achievements (user_id, achievement_id, earned_at)
      values (v_prev_user_id, 'untouchable', now())
      on conflict do nothing;

      insert into public.notifications (user_id, type, title, message, action_url)
      values (
        v_prev_user_id, 
        'achievement', 
        '👑 ACHIEVEMENT UNLOCKED: UNTOUCHABLE', 
        'You held #1 for over 24 hours!', 
        concat('/@', coalesce(v_prev_username, ''))
      );
    end if;
  end if;

  -- 7. INTERNET MENACE (Replace same user 3 times in total history)
  if (select count(*) from public.replacements where new_user_id = p_new_user_id and previous_user_id = v_prev_user_id) >= 3 then
    if not exists (select 1 from public.user_achievements where user_id = p_new_user_id and achievement_id = 'internet_menace') then
      insert into public.user_achievements (user_id, achievement_id, earned_at)
      values (p_new_user_id, 'internet_menace', now())
      on conflict do nothing;

      insert into public.notifications (user_id, type, title, message, action_url)
      values (
        p_new_user_id, 
        'achievement', 
        '🔥 ACHIEVEMENT UNLOCKED: INTERNET MENACE', 
        concat('You replaced @', coalesce(v_prev_username, 'someone'), ' 3 times. Savage.'), 
        concat('/@', coalesce(v_new_username, ''))
      );
    end if;
  end if;

  -- 8. Insert successful payment record atomically
  insert into public.payments (user_id, dodo_payment_id, amount, status, replacement_id, metadata)
  values (
    p_new_user_id,
    p_payment_id,
    p_amount_paid,
    'succeeded',
    v_replacement_id,
    p_metadata
  );

  v_response := json_build_object(
    'success', true,
    'replacement_id', v_replacement_id,
    'new_price', v_new_price,
    'previous_duration', v_duration
  );

  return v_response;
exception
  when unique_violation then
    -- A concurrent webhook successfully inserted this payment already
    return json_build_object('status', 'already_processed');
end;
$$ language plpgsql security definer;


-- 10. AUTHENTICATED USER SYNC TRIGGER
-- This automatically creates a public.users row whenever a user signs up.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, username, display_name, avatar_url, bio, website_url)
  values (
    new.id,
    coalesce(
      (new.raw_user_meta_data->>'username'), 
      substring(new.email from '([^@]+)') || '_' || substring(gen_random_uuid()::text from 1 for 4)
    ),
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'name', substring(new.email from '([^@]+)')),
    new.raw_user_meta_data->>'avatar_url',
    coalesce(new.raw_user_meta_data->>'bio', 'Building cool stuff on the internet.'),
    coalesce(new.raw_user_meta_data->>'website_url', '')
  )
  on conflict (id) do update
  set
    username = excluded.username,
    display_name = excluded.display_name,
    avatar_url = excluded.avatar_url;
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
