import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ replacementId: string }> }
) {
  const { replacementId } = await params
  const supabase = createAdminClient()

  try {
    const { clientId } = await request.json()
    if (!clientId) {
      return NextResponse.json({ error: 'Missing clientId' }, { status: 400 })
    }

    if (!replacementId || replacementId.length !== 36) {
      return NextResponse.json({ error: 'Invalid reign' }, { status: 400 })
    }

    // Grab the exact reign to ensure it exists and to get its URL
    const { data: replacement } = await supabase
      .from('replacements')
      .select('new_website_url')
      .eq('id', replacementId)
      .single()
      
    if (!replacement || !replacement.new_website_url) {
      return NextResponse.json({ error: 'Reign not found' }, { status: 404 })
    }

    const { error } = await supabase
      .from('reign_events')
      .insert({
        website_url: replacement.new_website_url,
        replacement_id: replacementId,
        event_type: 'view',
        client_id: clientId,
      })

    if (!error) {
      await supabase.rpc('increment_view', { p_replacement_id: replacementId })
    } else if (error.code !== '23505') {
      console.error('View tracking insert error:', error)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('View tracking error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
