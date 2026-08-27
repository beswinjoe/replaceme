-- Wipe everything cleanly
TRUNCATE TABLE public.website_achievements CASCADE;
TRUNCATE TABLE public.live_presence CASCADE;
TRUNCATE TABLE public.reign_events CASCADE;
TRUNCATE TABLE public.payments CASCADE;
TRUNCATE TABLE public.current_holder CASCADE;
TRUNCATE TABLE public.replacements CASCADE;

-- Reseed genesis
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
    );
  END IF;
END $$;
