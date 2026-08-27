import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const amountStr = searchParams.get('amount')

    if (!amountStr || isNaN(Number(amountStr)) || Number(amountStr) < 1) {
      return NextResponse.json({ error: 'Valid amount is required (minimum $1)' }, { status: 400 })
    }

    const amount = Number(amountStr)
    const supabase = await createClient()

    // Count how many participants have amount_paid strictly greater than the entered bid.
    // Those participants will all rank above this bid.
    // For equal amounts, earlier created_at wins, so in the worst case the new bid
    // would be placed after all equal-amount entries — we add those too.
    const { count: higherCount, error: err1 } = await supabase
      .from('replacements')
      .select('*', { count: 'exact', head: true })
      .gt('amount_paid', amount)

    if (err1) throw err1

    const { count: equalCount, error: err2 } = await supabase
      .from('replacements')
      .select('*', { count: 'exact', head: true })
      .eq('amount_paid', amount)

    if (err2) throw err2

    // Estimated rank = all higher bids + all equal bids (they were created earlier) + 1
    const estimatedRank = (higherCount ?? 0) + (equalCount ?? 0) + 1

    return NextResponse.json({ estimatedRank })
  } catch (err: any) {
    console.error('Estimated rank error:', err)
    return NextResponse.json({ error: 'Failed to estimate rank' }, { status: 500 })
  }
}
