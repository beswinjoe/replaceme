import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import DodoPayments from 'dodopayments'

export async function POST(req: Request) {
  try {
    const supabase = await createClient()

    const body = await req.json()
    const { website_url, website_name, website_logo, custom_message, logo_source, bid_amount } = body

    if (!website_url) {
      return NextResponse.json({ error: 'Website URL is required' }, { status: 400 })
    }

    if (!bid_amount || isNaN(Number(bid_amount)) || Number(bid_amount) < 0.10) {
      return NextResponse.json({ error: 'Valid bid amount is required (minimum $0.10)' }, { status: 400 })
    }

    // Convert bid to cents for Dodo Payments (multiply by 100)
    const amountInCents = Math.round(Number(bid_amount) * 100)

    // 2. Initialize Dodo Payments
    const apiKey = process.env.DODO_PAYMENTS_API_KEY
    const productId = process.env.DODO_PAYMENTS_PRODUCT_ID

    if (!apiKey || !productId) {
      return NextResponse.json({
        error: 'Dodo Payments not configured. Configure DODO_PAYMENTS_API_KEY and DODO_PAYMENTS_PRODUCT_ID in .env.local, or enable NEXT_PUBLIC_DEMO_MODE.'
      }, { status: 500 })
    }

    const dodo = new DodoPayments({
      bearerToken: apiKey,
      environment: (process.env.DODO_ENVIRONMENT as any) || (process.env.NEXT_PUBLIC_DEMO_MODE === 'true' ? 'test_mode' : 'live_mode'),
    })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 
                   (process.env.NEXT_PUBLIC_VERCEL_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` : null) || 
                   'http://localhost:3000'

    const paymentId = crypto.randomUUID()

    // 3. Create Checkout Session
    const session = await dodo.checkoutSessions.create({
      product_cart: [
        {
          product_id: productId,
          quantity: 1,
          amount: amountInCents, // PWYW Override
        },
      ],
      metadata: {
        payment_id: paymentId,
        website_url: website_url,
        website_name: website_name || website_url,
        website_logo: website_logo || '',
        logo_source: logo_source || 'fallback',
        custom_message: custom_message || '',
        quoted_price: Number(bid_amount).toString(),
        quote_created_at: new Date().toISOString(),
      },
      return_url: `${appUrl}/checkout/success?payment_id=${paymentId}`,
    })

    return NextResponse.json({ url: session.checkout_url, sessionId: session.session_id })
  } catch (error: any) {
    console.error('Checkout error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
