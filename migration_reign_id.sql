-- Add active_reign_id to current_holder
ALTER TABLE public.current_holder ADD COLUMN IF NOT EXISTS active_reign_id uuid references public.replacements(id);

-- Modify live_presence table to use reign_id instead of website_url
-- We will drop the table and recreate it since it's just ephemeral data
DROP TABLE IF EXISTS public.live_presence;

create table public.live_presence (
  reign_id uuid not null, -- this will be '00000000-0000-0000-0000-000000000000' for genesis
  client_id text not null,
  last_seen_at timestamptz default now() not null,
  primary key (reign_id, client_id)
);

create index idx_live_presence_reign_time on public.live_presence(reign_id, last_seen_at);

alter table public.live_presence enable row level security;
create policy "Allow public read access to live_presence" on public.live_presence for select using (true);
create policy "Allow public insert to live_presence" on public.live_presence for insert with check (true);
create policy "Allow public update to live_presence" on public.live_presence for update using (true);

-- Update the process_payment_and_replace RPC to set active_reign_id
DROP FUNCTION IF EXISTS public.process_payment_and_replace(uuid, text, text, text, numeric, text, jsonb, text);

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
  v_prev_website_url text;
  v_prev_website_name text;
  v_prev_website_logo text;
  v_current_price numeric;
  v_replaced_at timestamptz;
  v_views_count integer;
  v_clicks_count integer;
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
  select website_url, website_name, website_logo, current_price, replaced_at, views_count, clicks_count
  into v_prev_website_url, v_prev_website_name, v_prev_website_logo, v_current_price, v_replaced_at, v_views_count, v_clicks_count
  from public.current_holder
  where id = '00000000-0000-0000-0000-000000000000'::uuid
  for update;

  -- 3. Verify payment amount matches/exceeds current price (Stale Price Check)
  if p_amount_paid < v_current_price then
    -- Atomically log the payment as refund_pending to block retries and prep for refund
    insert into public.payments (website_url, dodo_payment_id, amount, status, metadata)
    values (
      p_new_website_url, 
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

  -- Calculate duration in seconds
  v_duration := extract(epoch from (now() - v_replaced_at));

  -- Calculate new price (rounded to 2 decimal places)
  v_new_price := round((v_current_price * v_growth_multiplier)::numeric, 2);

  -- Insert history record
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
    v_prev_website_url,
    v_prev_website_name,
    v_prev_website_logo,
    p_new_website_url,
    p_new_website_name,
    p_new_website_logo,
    p_amount_paid,
    v_current_price,
    v_new_price,
    v_duration,
    coalesce(v_views_count, 0),
    coalesce(v_clicks_count, 0),
    p_custom_message,
    now(),
    p_logo_source
  ) returning id into v_replacement_id;

  -- Update current holder state and reset counts
  update public.current_holder
  set website_url = p_new_website_url,
      website_name = p_new_website_name,
      website_logo = p_new_website_logo,
      current_price = v_new_price,
      replaced_at = now(),
      custom_message = p_custom_message,
      views_count = 0,
      clicks_count = 0,
      logo_source = p_logo_source,
      active_reign_id = v_replacement_id
  where id = '00000000-0000-0000-0000-000000000000'::uuid;

  -- PROCESS ACHIEVEMENTS
  
  -- 1. FIRST BLOOD (Become #1 for first time)
  if not exists (select 1 from public.website_achievements where website_url = p_new_website_url and achievement_id = 'first_blood') then
    insert into public.website_achievements (website_url, achievement_id, earned_at)
    values (p_new_website_url, 'first_blood', now())
    on conflict do nothing;
  end if;

  -- 2. REVENGE (Replace the website that replaced you)
  if exists (
    select 1 from public.replacements
    where previous_website_url = p_new_website_url
    and new_website_url = v_prev_website_url
    order by created_at desc
    limit 1
  ) then
    insert into public.website_achievements (website_url, achievement_id, earned_at)
    values (p_new_website_url, 'revenge', now())
    on conflict do nothing;
  end if;

  -- 3. SERIAL REPLACER (Replace 10 websites)
  if (select count(*) from public.replacements where new_website_url = p_new_website_url) >= 10 then
    if not exists (select 1 from public.website_achievements where website_url = p_new_website_url and achievement_id = 'serial_replacer') then
      insert into public.website_achievements (website_url, achievement_id, earned_at)
      values (p_new_website_url, 'serial_replacer', now())
      on conflict do nothing;
    end if;
  end if;

  -- 4. UNEMPLOYED (Get replaced 10 times)
  if v_prev_website_url != 'replaceme.lol' then
    if (select count(*) from public.replacements where previous_website_url = v_prev_website_url) >= 10 then
      if not exists (select 1 from public.website_achievements where website_url = v_prev_website_url and achievement_id = 'unemployed') then
        insert into public.website_achievements (website_url, achievement_id, earned_at)
        values (v_prev_website_url, 'unemployed', now())
        on conflict do nothing;
      end if;
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

  -- 6. UNTOUCHABLE (Hold #1 for 24 hours - 86400 seconds)
  if v_duration >= 86400.0 and v_prev_website_url != 'replaceme.lol' then
    if not exists (select 1 from public.website_achievements where website_url = v_prev_website_url and achievement_id = 'untouchable') then
      insert into public.website_achievements (website_url, achievement_id, earned_at)
      values (v_prev_website_url, 'untouchable', now())
      on conflict do nothing;
    end if;
  end if;

  -- 7. INTERNET MENACE (Replace same website 3 times in total history)
  if (select count(*) from public.replacements where new_website_url = p_new_website_url and previous_website_url = v_prev_website_url) >= 3 then
    if not exists (select 1 from public.website_achievements where website_url = p_new_website_url and achievement_id = 'internet_menace') then
      insert into public.website_achievements (website_url, achievement_id, earned_at)
      values (p_new_website_url, 'internet_menace', now())
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
