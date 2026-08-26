-- Migration to Open Leaderboard Architecture
-- Removes the concept of a single "current_holder" and stale pricing.

-- 1. Refactor process_payment_and_replace RPC to simply insert successful bids
CREATE OR REPLACE FUNCTION public.process_payment_and_replace(
  p_payment_id text,
  p_new_website_url text,
  p_new_website_name text,
  p_new_website_logo text,
  p_amount_paid numeric,
  p_custom_message text,
  p_metadata jsonb,
  p_logo_source text default 'fallback'
) RETURNS json AS $$
DECLARE
  v_replacement_id uuid;
  v_response json;
BEGIN
  -- 1. Idempotency Check: if payment already processed, safely return
  IF EXISTS (SELECT 1 FROM public.payments WHERE dodo_payment_id = p_payment_id) THEN
    RETURN json_build_object('status', 'already_processed');
  END IF;

  -- 2. Insert history record (this is now the bid record in the leaderboard)
  -- We leave previous_website fields null since they no longer make sense.
  INSERT INTO public.replacements (
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
  ) VALUES (
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
  ) RETURNING id INTO v_replacement_id;

  -- PROCESS ACHIEVEMENTS (Simplified for Open Leaderboard)
  
  -- 1. FIRST BLOOD (Participate for the first time)
  IF NOT EXISTS (SELECT 1 FROM public.website_achievements WHERE website_url = p_new_website_url AND achievement_id = 'first_blood') THEN
    INSERT INTO public.website_achievements (website_url, achievement_id, earned_at)
    VALUES (p_new_website_url, 'first_blood', now())
    ON CONFLICT DO NOTHING;
  END IF;

  -- 3. SERIAL REPLACER (Now: SERIAL BIDDER - Bid 10 times)
  IF (SELECT count(*) FROM public.replacements WHERE new_website_url = p_new_website_url) >= 10 THEN
    IF NOT EXISTS (SELECT 1 FROM public.website_achievements WHERE website_url = p_new_website_url AND achievement_id = 'serial_replacer') THEN
      INSERT INTO public.website_achievements (website_url, achievement_id, earned_at)
      VALUES (p_new_website_url, 'serial_replacer', now())
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  -- 5. BIG SPENDER (Spend over $100 total)
  IF (SELECT coalesce(sum(amount_paid), 0) FROM public.replacements WHERE new_website_url = p_new_website_url) >= 100.00 THEN
    IF NOT EXISTS (SELECT 1 FROM public.website_achievements WHERE website_url = p_new_website_url AND achievement_id = 'big_spender') THEN
      INSERT INTO public.website_achievements (website_url, achievement_id, earned_at)
      VALUES (p_new_website_url, 'big_spender', now())
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  -- 8. Insert successful payment record atomically
  INSERT INTO public.payments (website_url, dodo_payment_id, amount, status, replacement_id, metadata)
  VALUES (
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

  RETURN v_response;
EXCEPTION
  WHEN unique_violation THEN
    -- A concurrent webhook successfully inserted this payment already
    RETURN json_build_object('status', 'already_processed');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
