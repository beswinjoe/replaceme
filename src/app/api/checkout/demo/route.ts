import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { processPaymentAndReplace } from '@/utils/supabase/paymentProcessing'

export async function POST(req: Request) {
  try {
    if (process.env.NEXT_PUBLIC_DEMO_MODE !== 'true') {
      return NextResponse.json({ error: 'Demo mode is not enabled' }, { status: 403 })
    }

    const body = await req.json()
    const { website_url, website_name, website_logo, custom_message, logo_source, bid_amount } = body

    if (!website_url) {
      return NextResponse.json({ error: 'Website URL is required' }, { status: 400 })
    }

    const amountPaid = Number(bid_amount)
    if (!bid_amount || isNaN(amountPaid) || amountPaid < 1) {
      return NextResponse.json({ error: 'Valid bid amount is required (minimum $1)' }, { status: 400 })
    }

    const supabaseAdmin = createAdminClient()
    const sessionId = `demo_${Math.random().toString(36).substring(7)}`

    // Call TS replacement processor directly
    let replaceData: any
    try {
      replaceData = await processPaymentAndReplace({
        paymentId: sessionId,
        newWebsiteUrl: website_url,
        newWebsiteName: website_name || website_url,
        newWebsiteLogo: website_logo || '',
        amountPaid,
        customMessage: custom_message || null,
        metadata: body
      })
    } catch (replaceError: any) {
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
