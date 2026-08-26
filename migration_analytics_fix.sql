-- Drop views/clicks from current_holder as replacements is now the source of truth
ALTER TABLE public.current_holder DROP COLUMN IF EXISTS views_count;
ALTER TABLE public.current_holder DROP COLUMN IF EXISTS clicks_count;

-- Insert a Genesis row into replacements (if it doesn't already exist for the genesis)
-- We'll just create a dummy row for the very first reign
DO $$
DECLARE
  v_genesis_reign_id uuid;
BEGIN
  -- Insert a reign for the genesis holder
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
    logo_source
  ) VALUES (
    'genesis',
    'Genesis',
    '',
    'replaceme.lol',
    'ReplaceMe',
    '/replaceme-avatar.svg',
    0.00,
    0.00,
    1.00,
    0,
    0,
    0,
    'Someone has to be first. Replace me to start the game.',
    'fallback'
  ) RETURNING id INTO v_genesis_reign_id;

  -- Update current_holder to point to this new reign ONLY if it is currently null
  UPDATE public.current_holder 
  SET active_reign_id = v_genesis_reign_id 
  WHERE active_reign_id IS NULL;
END $$;


-- Simplify the analytics RPCs: they now just target the replacements table
CREATE OR REPLACE FUNCTION public.increment_view(p_replacement_id uuid) RETURNS void AS $$
BEGIN
  UPDATE public.replacements SET views_count = views_count + 1 WHERE id = p_replacement_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.increment_click(p_replacement_id uuid) RETURNS void AS $$
BEGIN
  UPDATE public.replacements SET clicks_count = clicks_count + 1 WHERE id = p_replacement_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Update process_payment_and_replace to create a fresh reign for the NEW holder, starting at 0/0
DROP FUNCTION IF EXISTS public.process_payment_and_replace(text, text, text, text, numeric, text, jsonb, text);

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
  v_prev_website_url text;
  v_prev_website_name text;
  v_prev_website_logo text;
  v_current_price numeric;
  v_replaced_at timestamptz;
  v_duration numeric;
  v_growth_multiplier numeric := 1.20; -- Price grows by 20%
  v_new_price numeric;
  v_replacement_id uuid;
  v_response json;
BEGIN
  -- 1. Idempotency Check: if payment already processed, safely return
  IF EXISTS (SELECT 1 FROM public.payments WHERE dodo_payment_id = p_payment_id) THEN
    RETURN json_build_object('status', 'already_processed');
  END IF;

  -- 2. Lock current_holder for update to prevent concurrent updates
  SELECT website_url, website_name, website_logo, current_price, replaced_at
  INTO v_prev_website_url, v_prev_website_name, v_prev_website_logo, v_current_price, v_replaced_at
  FROM public.current_holder
  WHERE id = '00000000-0000-0000-0000-000000000000'::uuid
  FOR UPDATE;

  -- 3. Verify payment amount matches/exceeds current price (Stale Price Check)
  IF p_amount_paid < v_current_price THEN
    -- Atomically log the payment as refund_pending to block retries and prep for refund
    INSERT INTO public.payments (website_url, dodo_payment_id, amount, status, metadata)
    VALUES (
      p_new_website_url, 
      p_payment_id, 
      p_amount_paid, 
      'refund_pending', 
      p_metadata || jsonb_build_object('reason', 'stale_price', 'required_price', v_current_price)
    );

    RETURN json_build_object(
      'status', 'stale_price',
      'required_price', v_current_price,
      'amount_paid', p_amount_paid
    );
  END IF;

  -- Calculate duration in seconds
  v_duration := EXTRACT(EPOCH FROM (now() - v_replaced_at));

  -- Calculate new price (rounded to 2 decimal places)
  v_new_price := ROUND((v_current_price * v_growth_multiplier)::numeric, 2);

  -- Insert history record representing the NEW REIGN.
  -- Notice views_count and clicks_count start strictly at 0!
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
    0, 
    0,
    p_custom_message,
    now(),
    p_logo_source
  ) RETURNING id INTO v_replacement_id;

  -- Update current holder state to point to the new reign
  UPDATE public.current_holder
  SET website_url = p_new_website_url,
      website_name = p_new_website_name,
      website_logo = p_new_website_logo,
      current_price = v_new_price,
      replaced_at = now(),
      custom_message = p_custom_message,
      logo_source = p_logo_source,
      active_reign_id = v_replacement_id
  WHERE id = '00000000-0000-0000-0000-000000000000'::uuid;

  -- PROCESS ACHIEVEMENTS
  
  -- 1. FIRST BLOOD (Become #1 for first time)
  IF NOT EXISTS (SELECT 1 FROM public.website_achievements WHERE website_url = p_new_website_url AND achievement_id = 'first_blood') THEN
    INSERT INTO public.website_achievements (website_url, achievement_id, earned_at)
    VALUES (p_new_website_url, 'first_blood', now())
    ON CONFLICT DO NOTHING;
  END IF;

  -- 2. REVENGE (Replace the website that replaced you)
  IF EXISTS (
    SELECT 1 FROM public.replacements
    WHERE previous_website_url = p_new_website_url
    AND new_website_url = v_prev_website_url
    ORDER BY created_at DESC
    LIMIT 1
  ) THEN
    INSERT INTO public.website_achievements (website_url, achievement_id, earned_at)
    VALUES (p_new_website_url, 'revenge', now())
    ON CONFLICT DO NOTHING;
  END IF;

  -- 3. SERIAL REPLACER (Replace 10 websites)
  IF (SELECT count(*) FROM public.replacements WHERE new_website_url = p_new_website_url) >= 10 THEN
    IF NOT EXISTS (SELECT 1 FROM public.website_achievements WHERE website_url = p_new_website_url AND achievement_id = 'serial_replacer') THEN
      INSERT INTO public.website_achievements (website_url, achievement_id, earned_at)
      VALUES (p_new_website_url, 'serial_replacer', now())
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  -- 4. UNEMPLOYED (Get replaced 10 times)
  IF v_prev_website_url != 'replaceme.lol' THEN
    IF (SELECT count(*) FROM public.replacements WHERE previous_website_url = v_prev_website_url) >= 10 THEN
      IF NOT EXISTS (SELECT 1 FROM public.website_achievements WHERE website_url = v_prev_website_url AND achievement_id = 'unemployed') THEN
        INSERT INTO public.website_achievements (website_url, achievement_id, earned_at)
        VALUES (v_prev_website_url, 'unemployed', now())
        ON CONFLICT DO NOTHING;
      END IF;
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

  -- 6. UNTOUCHABLE (Hold #1 for 24 hours - 86400 seconds)
  IF v_duration >= 86400.0 AND v_prev_website_url != 'replaceme.lol' THEN
    IF NOT EXISTS (SELECT 1 FROM public.website_achievements WHERE website_url = v_prev_website_url AND achievement_id = 'untouchable') THEN
      INSERT INTO public.website_achievements (website_url, achievement_id, earned_at)
      VALUES (v_prev_website_url, 'untouchable', now())
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  -- 7. INTERNET MENACE (Replace same website 3 times in total history)
  IF (SELECT count(*) FROM public.replacements WHERE new_website_url = p_new_website_url AND previous_website_url = v_prev_website_url) >= 3 THEN
    IF NOT EXISTS (SELECT 1 FROM public.website_achievements WHERE website_url = p_new_website_url AND achievement_id = 'internet_menace') THEN
      INSERT INTO public.website_achievements (website_url, achievement_id, earned_at)
      VALUES (p_new_website_url, 'internet_menace', now())
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
    'replacement_id', v_replacement_id,
    'new_price', v_new_price,
    'previous_duration', v_duration
  );

  RETURN v_response;
EXCEPTION
  WHEN unique_violation THEN
    -- A concurrent webhook successfully inserted this payment already
    RETURN json_build_object('status', 'already_processed');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
