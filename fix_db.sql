-- Add columns if they don't exist
ALTER TABLE public.replacements ADD COLUMN IF NOT EXISTS logo_source text default 'fallback' not null;
ALTER TABLE public.current_holder ADD COLUMN IF NOT EXISTS logo_source text default 'fallback' not null;

-- Drop all versions of the function to resolve overloading conflicts
DROP FUNCTION IF EXISTS public.process_payment_and_replace(text, text, text, text, numeric, text, jsonb);
DROP FUNCTION IF EXISTS public.process_payment_and_replace(text, text, text, text, numeric, text, jsonb, text);

-- Recreate the correct function with 8 arguments
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
  -- 1. Idempotency Check
  if exists (select 1 from public.payments where dodo_payment_id = p_payment_id) then
    return json_build_object('status', 'already_processed');
  end if;

  -- 2. Insert history record
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

  -- 3. FIRST BLOOD
  if not exists (select 1 from public.website_achievements where website_url = p_new_website_url and achievement_id = 'first_blood') then
    insert into public.website_achievements (website_url, achievement_id, earned_at)
    values (p_new_website_url, 'first_blood', now())
    on conflict do nothing;
  end if;

  -- 4. SERIAL REPLACER
  if (select count(*) from public.replacements where new_website_url = p_new_website_url) >= 10 then
    if not exists (select 1 from public.website_achievements where website_url = p_new_website_url and achievement_id = 'serial_replacer') then
      insert into public.website_achievements (website_url, achievement_id, earned_at)
      values (p_new_website_url, 'serial_replacer', now())
      on conflict do nothing;
    end if;
  end if;

  -- 5. BIG SPENDER
  if (select coalesce(sum(amount_paid), 0) from public.replacements where new_website_url = p_new_website_url) >= 100.00 then
    if not exists (select 1 from public.website_achievements where website_url = p_new_website_url and achievement_id = 'big_spender') then
      insert into public.website_achievements (website_url, achievement_id, earned_at)
      values (p_new_website_url, 'big_spender', now())
      on conflict do nothing;
    end if;
  end if;

  -- 6. Insert successful payment record atomically
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
    return json_build_object('status', 'already_processed');
end;
$$ language plpgsql security definer;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
