CREATE OR REPLACE FUNCTION get_leaderboard_stats()
RETURNS json AS $$
DECLARE
  total numeric;
  first_date timestamptz;
BEGIN
  SELECT COALESCE(SUM(amount_paid), 0) INTO total FROM public.replacements;
  SELECT MIN(created_at) INTO first_date FROM public.replacements;
  
  RETURN json_build_object(
    'total_amount', total,
    'launch_date', first_date
  );
END;
$$ LANGUAGE plpgsql;
