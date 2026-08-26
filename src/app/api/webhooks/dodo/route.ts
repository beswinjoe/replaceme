import { NextResponse } from 'next/server'
import DodoPayments from 'dodopayments'
import { createAdminClient } from '@/utils/supabase/admin'

export async function POST(req: Request) {
  try {
    const webhookSecret = process.env.DODO_WEBHOOK_SECRET
    if (!webhookSecret) {
      console.warn('DODO_WEBHOOK_SECRET is not configured.')
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
    }

    const webhookId = req.headers.get('webhook-id')
    const webhookSignature = req.headers.get('webhook-signature')
    const webhookTimestamp = req.headers.get('webhook-timestamp')

    if (!webhookId || !webhookSignature || !webhookTimestamp) {
      return NextResponse.json({ error: 'Missing webhook headers' }, { status: 400 })
    }

    const rawBody = await req.text()

    // Initialize Dodo client with the secret key to verify signatures
    const dodo = new DodoPayments({
      bearerToken: process.env.DODO_PAYMENTS_API_KEY || '',
      webhookKey: webhookSecret,
      environment: (process.env.DODO_ENVIRONMENT as any) || (process.env.NEXT_PUBLIC_DEMO_MODE === 'true' ? 'test_mode' : 'live_mode'),
    })

    // Verify signature using the SDK's unwrap helper
    let payload: any
    try {
      payload = dodo.webhooks.unwrap(rawBody, {
        headers: {
          'webhook-id': webhookId,
          'webhook-signature': webhookSignature,
          'webhook-timestamp': webhookTimestamp,
        },
      })
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message)
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 })
    }

    console.log('Received Dodo webhook event:', payload?.type)

    if (payload?.type === 'payment.succeeded') {
      const data = payload.data
      if (!data) {
        return NextResponse.json({ error: 'Missing payload data' }, { status: 400 })
      }

      // Metadata can be on the payment object or on the customer details
      const metadata = data.metadata || data.customer?.metadata

      if (!metadata || !metadata.website_url) {
        console.error('Webhook payment.succeeded missing metadata or website_url')
        return NextResponse.json({ error: 'Missing metadata' }, { status: 400 })
      }

      const amountPaid = Number(data.amount) / 100 // Convert cents back to dollars
      const websiteUrl = metadata.website_url
      const websiteName = metadata.website_name || websiteUrl
      const websiteLogo = metadata.website_logo || ''
      const customMessage = metadata.custom_message

      const supabaseAdmin = createAdminClient()

      // 1. Call the atomic database replacement transaction
      const paymentId = data.payment_id || data.transaction_id || data.session_id || 'unknown'
      const { data: replaceData, error: replaceError } = await supabaseAdmin.rpc(
        'process_payment_and_replace',
        {
          p_payment_id: paymentId,
          p_new_website_url: websiteUrl,
          p_new_website_name: websiteName,
          p_new_website_logo: websiteLogo,
          p_amount_paid: amountPaid,
          p_custom_message: customMessage || null,
          p_metadata: metadata
        }
      )

      if (replaceError) {
        console.error('Atomic replacement failed in webhook:', replaceError)
        return NextResponse.json({ error: 'Atomic replacement failed' }, { status: 500 })
      }

      if (replaceData?.status === 'already_processed') {
        console.log(`Payment ${paymentId} already processed (idempotent success).`)
        return NextResponse.json({ success: true, status: 'already_processed' })
      }

      if (replaceData?.status === 'stale_price') {
        console.warn(`Stale price race condition: User paid ${amountPaid} but ${replaceData.required_price} was required.`)
        
        // 2. Initiate Dodo Refund
        try {
          const refund = await dodo.refunds.create({
            payment_id: paymentId,
            reason: 'Stale price checkout race condition. User did not secure #1.',
          }, {
            idempotencyKey: paymentId
          })
          
          if (refund.status) {
            await supabaseAdmin.from('payments')
              .update({ 
                status: 'refund_pending',
                metadata: { ...metadata, reason: 'stale_price', required_price: replaceData.required_price, refund_id: refund.refund_id }
              })
              .eq('dodo_payment_id', paymentId)
          }
        } catch (refundError: any) {
          console.error('Failed to automatically issue refund:', refundError.message)
          // Status remains 'refund_pending' in DB as inserted by RPC so admin can resolve manually
        }

        return NextResponse.json({ success: true, status: 'stale_price' })
      }

      console.log('Successfully replaced holder via webhook. New price:', replaceData?.new_price)
    } else if (payload?.type === 'refund.succeeded') {
      const data = payload.data
      if (data && data.payment_id) {
        const supabaseAdmin = createAdminClient()
        await supabaseAdmin.from('payments')
          .update({ status: 'refunded' })
          .eq('dodo_payment_id', data.payment_id)
        console.log(`Refund succeeded for payment ${data.payment_id}`)
      }
    } else if (payload?.type === 'refund.failed') {
      const data = payload.data
      if (data && data.payment_id) {
        const supabaseAdmin = createAdminClient()
        await supabaseAdmin.from('payments')
          .update({ status: 'refund_failed' })
          .eq('dodo_payment_id', data.payment_id)
        console.log(`Refund failed for payment ${data.payment_id}`)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Webhook error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
