const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function test() {
  const { data, error } = await supabase
    .from('replacements')
    .select(`
      amount_paid,
      previous_holder_duration,
      previous_user_id,
      new_user_id,
      new_user:users!replacements_new_user_id_fkey(*),
      previous_user:users!replacements_previous_user_id_fkey(*)
    `)

  console.log('Error:', error)
  console.log('Data:', data?.length)
}

test()
