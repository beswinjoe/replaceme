-- Add logo_source column to track how logos were resolved
ALTER TABLE public.current_holder ADD COLUMN IF NOT EXISTS logo_source text default 'fallback' not null;
ALTER TABLE public.replacements ADD COLUMN IF NOT EXISTS logo_source text default 'fallback' not null;

-- Update the process_payment_and_replace RPC to accept p_logo_source
DROP FUNCTION IF EXISTS public.process_payment_and_replace(uuid, text, text, text, numeric, text, jsonb);

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
  v_current_price numeric(12, 2);
  v_new_price numeric(12, 2);
  v_replacement_id uuid;
  v_replaced_at timestamptz;
  v_duration numeric;
  v_views_count integer;
  v_clicks_count integer;
begin
  -- 1. Check idempotency (has this payment been processed already?)
  if exists (select 1 from public.payments where dodo_payment_id = p_payment_id and status = 'completed') then
    return json_build_object('success', false, 'error', 'already_processed');
  end if;

  -- 2. Lock the current_holder row for update to prevent concurrent replacements
  select website_url, website_name, website_logo, current_price, replaced_at, views_count, clicks_count
  into v_prev_website_url, v_prev_website_name, v_prev_website_logo, v_current_price, v_replaced_at, v_views_count, v_clicks_count
  from public.current_holder
  where id = '00000000-0000-0000-0000-000000000000'::uuid
  for update;

  -- 3. Verify payment amount matches/exceeds current price (Stale Price Check)
  if p_amount_paid < v_current_price then
    return json_build_object(
      'success', false,
      'error', 'price_stale',
      'current_price', v_current_price,
      'amount_paid', p_amount_paid
    );
  end if;

  -- Calculate the new price (20% increase)
  v_new_price := v_current_price * 1.20;
  
  -- Calculate duration in seconds
  v_duration := extract(epoch from (now() - v_replaced_at));

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

  -- Update current holder
  update public.current_holder
  set website_url = p_new_website_url,
      website_name = p_new_website_name,
      website_logo = p_new_website_logo,
      current_price = v_new_price,
      replaced_at = now(),
      custom_message = p_custom_message,
      views_count = 0,
      clicks_count = 0,
      logo_source = p_logo_source
  where id = '00000000-0000-0000-0000-000000000000'::uuid;

  -- Record the payment as completed
  insert into public.payments (
    dodo_payment_id,
    website_url,
    amount,
    status,
    replacement_id,
    metadata
  ) values (
    p_payment_id,
    p_new_website_url,
    p_amount_paid,
    'completed',
    v_replacement_id,
    p_metadata
  );

  return json_build_object(
    'success', true,
    'replacement_id', v_replacement_id,
    'new_price', v_new_price,
    'previous_duration', v_duration
  );
exception
  when unique_violation then
    -- If multiple webhooks fire for the same payment simultaneously
    return json_build_object('success', false, 'error', 'already_processed');
  when others then
    -- Rollback everything and return the error
    return json_build_object('success', false, 'error', sqlerrm);
end;
$$ language plpgsql security definer;
