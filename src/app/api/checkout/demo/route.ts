import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'

export async function POST(req: Request) {
  try {
    if (process.env.NEXT_PUBLIC_DEMO_MODE !== 'true') {
      return NextResponse.json({ error: 'Demo mode is not enabled' }, { status: 403 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { username, display_name, avatar_url, custom_message, website_url } = body

    // 1. Fetch current price
    const { data: holder, error: holderError } = await supabase
      .from('current_holder')
      .select('current_price')
      .single()

    if (holderError || !holder) {
      return NextResponse.json({ error: 'Failed to fetch current price' }, { status: 500 })
    }

    const currentPrice = Number(holder.current_price)

    // 2. Initialize Supabase Admin to execute profile update & replacement
    const supabaseAdmin = createAdminClient()

    // Update user profile details
    if (username) {
      const { error: updateError } = await supabaseAdmin
        .from('users')
        .update({
          username: username,
          display_name: display_name || null,
          avatar_url: avatar_url || null,
          website_url: website_url || null
        })
        .eq('id', user.id)

      if (updateError) {
        console.error('Failed to update user profile in demo checkout:', updateError)
      }
    }

    const sessionId = `demo_${Math.random().toString(36).substring(7)}`

    // Call atomic replacement function
    const { data: replaceData, error: replaceError } = await supabaseAdmin.rpc(
      'process_payment_and_replace',
      {
        p_payment_id: sessionId,
        p_new_user_id: user.id,
        p_amount_paid: currentPrice,
        p_custom_message: custom_message || null,
        p_website_url: website_url || null,
        p_metadata: body
      }
    )

    if (replaceError) {
      console.error('Atomic replacement failed in demo:', replaceError)
      return NextResponse.json({ error: replaceError.message }, { status: 500 })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    return NextResponse.json({
      url: `${appUrl}/checkout/success?session_id=${sessionId}`,
      sessionId: sessionId,
    })
  } catch (error: any) {
    console.error('Demo checkout error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
