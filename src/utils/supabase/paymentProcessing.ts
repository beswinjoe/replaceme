import { createAdminClient } from '@/utils/supabase/admin'

export async function processPaymentAndReplace(params: {
  paymentId: string
  newWebsiteUrl: string
  newWebsiteName: string
  newWebsiteLogo: string
  amountPaid: number
  customMessage: string | null
  metadata: any
}) {
  const supabase = createAdminClient()

  // 1. Idempotency Check
  const { data: existingPayment } = await supabase
    .from('payments')
    .select('id')
    .eq('dodo_payment_id', params.paymentId)
    .single()

  if (existingPayment) {
    return { success: true, status: 'already_processed' }
  }

  // 2. Insert into replacements
  const { data: replacement, error: replaceError } = await supabase
    .from('replacements')
    .insert({
      new_website_url: params.newWebsiteUrl,
      new_website_name: params.newWebsiteName,
      new_website_logo: params.newWebsiteLogo,
      amount_paid: params.amountPaid,
      price_before: 0,
      price_after: 0,
      previous_holder_duration: 0,
      views_count: 0,
      clicks_count: 0,
      custom_message: params.customMessage
    })
    .select('id')
    .single()

  if (replaceError || !replacement) {
    console.error('Failed to insert replacement:', replaceError)
    throw new Error('Failed to insert replacement')
  }

  // 3. Process Achievements asynchronously (don't block the payment success)
  const processAchievements = async () => {
    try {
      // First Blood
      const { data: fb } = await supabase
        .from('website_achievements')
        .select('website_url')
        .eq('website_url', params.newWebsiteUrl)
        .eq('achievement_id', 'first_blood')
        .single()
      
      if (!fb) {
        await supabase.from('website_achievements').insert({
          website_url: params.newWebsiteUrl,
          achievement_id: 'first_blood'
        })
      }

      // Serial Replacer
      const { count: replaceCount } = await supabase
        .from('replacements')
        .select('*', { count: 'exact', head: true })
        .eq('new_website_url', params.newWebsiteUrl)
        
      if (replaceCount && replaceCount >= 10) {
        const { error: err1 } = await supabase.from('website_achievements').insert({
          website_url: params.newWebsiteUrl,
          achievement_id: 'serial_replacer'
        })
      }

      // Big Spender
      const { data: spends } = await supabase
        .from('replacements')
        .select('amount_paid')
        .eq('new_website_url', params.newWebsiteUrl)
        
      const totalSpent = spends?.reduce((sum, row) => sum + Number(row.amount_paid), 0) || 0
      if (totalSpent >= 100) {
        const { error: err2 } = await supabase.from('website_achievements').insert({
          website_url: params.newWebsiteUrl,
          achievement_id: 'big_spender'
        })
      }
    } catch (err) {
      console.error('Failed to process achievements:', err)
    }
  }
  
  // Fire and forget achievements
  processAchievements()

  // 4. Insert into payments
  const { error: paymentError } = await supabase
    .from('payments')
    .insert({
      website_url: params.newWebsiteUrl,
      dodo_payment_id: params.paymentId,
      amount: params.amountPaid,
      status: 'succeeded',
      replacement_id: replacement.id,
      metadata: params.metadata
    })

  if (paymentError) {
    // If it fails on unique constraint, it means a concurrent webhook beat us to it.
    if (paymentError.code === '23505') {
      return { success: true, status: 'already_processed' }
    }
    console.error('Failed to insert payment:', paymentError)
    throw new Error('Failed to insert payment')
  }

  return { success: true, replacement_id: replacement.id }
}
