const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://ljvjjemdoobzptbhhmsd.supabase.co', 'sb_publishable_UfjZWvhQqGDuE4AnZOMrjw_1zc9kDsY');
supabase.from('replacements').insert([{
  new_website_url: 'test',
  new_website_name: 'test',
  new_website_logo: 'test',
  amount_paid: 1,
  price_before: null,
  price_after: null,
  previous_holder_duration: null
}]).then(console.log);
