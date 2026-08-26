import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ replacementId: string }> }
) {
  const { replacementId } = await params
  const supabase = createAdminClient()

  try {
    const { clientId, websiteUrl } = await request.json()

    if (!clientId || !websiteUrl) {
      return NextResponse.json({ error: 'Missing clientId or websiteUrl' }, { status: 400 })
    }

    const actualReplacementId = replacementId === 'current' ? '00000000-0000-0000-0000-000000000000' : replacementId

    // Try to insert the view event
    const { error } = await supabase
      .from('reign_events')
      .insert({
        website_url: websiteUrl,
        replacement_id: actualReplacementId,
        event_type: 'view',
        client_id: clientId,
      })
    
    // Ignore unique violation (already viewed this reign)
    if (error && error.code !== '23505') {
      console.error('Error tracking view:', error)
      return NextResponse.json({ error: 'Failed to track view' }, { status: 500 })
    }

    if (!error || error.code !== '23505') {
       await supabase.rpc('increment_view', { p_replacement_id: actualReplacementId })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('View tracking error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
