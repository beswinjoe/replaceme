import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const sessionId = searchParams.get('payment_id')

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing payment_id' }, { status: 400 })
    }

    const supabase = await createClient()

    // Handle array of payment IDs if Dodo appended its own
    const idArray = sessionId.split(',')
    let paymentRecord = null

    // Check if any of the IDs match either dodo_payment_id or metadata->>payment_id
    for (const id of idArray) {
      const { data } = await supabase
        .from('payments')
        .select('*')
        .or(`dodo_payment_id.eq.${id},metadata->>payment_id.eq.${id}`)
        .maybeSingle()
      
      if (data) {
        paymentRecord = data
        break
      }
    }

    if (!paymentRecord) {
      return NextResponse.json(
        { status: 'pending' },
        { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' } }
      )
    }

    if (paymentRecord.status === 'succeeded') {
      const amountNum = Number(paymentRecord.amount)
      
      // Fetch replacement details
      const { data: replacement } = await supabase
        .from('replacements')
        .select('new_website_name, custom_message')
        .eq('id', paymentRecord.replacement_id)
        .single()

      // Calculate final rank
      let rank = 1
      if (Number.isFinite(amountNum)) {
        const { count } = await supabase
          .from('replacements')
          .select('*', { count: 'exact', head: true })
          .gt('amount_paid', amountNum)
        
        if (count !== null) {
          rank = count + 1
        }
      }

      return NextResponse.json(
        {
          status: 'succeeded',
          data: {
            rank,
            isNumberOne: rank === 1,
            websiteName: replacement?.new_website_name || 'Your Website',
            customMessage: replacement?.custom_message || '',
            amountPaid: Number.isFinite(amountNum) ? amountNum.toFixed(2) : null
          }
        },
        { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' } }
      )
    }

    // Fallback for failed, cancelled, etc.
    return NextResponse.json(
      { status: paymentRecord.status },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' } }
    )
  } catch (err: any) {
    console.error('Status check error:', err)
    return NextResponse.json(
      { error: 'Failed to check status' },
      { status: 500, headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' } }
    )
  }
}
