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

    let websiteUrlId = ''
    let isActiveReign = false
    let dbReplacementId: string | null = replacementId

    if (replacementId === 'genesis') {
      dbReplacementId = null
      isActiveReign = true
      
      const { data: current } = await supabase
        .from('current_holder')
        .select('website_url, active_reign_id')
        .single()
        
      if (current && current.active_reign_id === null) {
        websiteUrlId = current.website_url
      }
    } else {
      const { data: current } = await supabase
        .from('current_holder')
        .select('website_url, active_reign_id')
        .single()

      if (current && current.active_reign_id === replacementId) {
        isActiveReign = true
        websiteUrlId = current.website_url
      } else {
        const { data: replacement } = await supabase
          .from('replacements')
          .select('new_website_url')
          .eq('id', replacementId)
          .single()
        
        if (replacement) {
          websiteUrlId = replacement.new_website_url
        }
      }
    }

    if (!websiteUrlId) {
      return NextResponse.json({ error: 'Reign not found' }, { status: 404 })
    }

    const { error } = await supabase
      .from('reign_events')
      .insert({
        website_url: websiteUrlId,
        replacement_id: dbReplacementId,
        event_type: 'view',
        client_id: clientId,
      })

    if (!error || error.code !== '23505') {
      if (isActiveReign) {
        await supabase.rpc('increment_view', { p_replacement_id: '00000000-0000-0000-0000-000000000000' })
      } else if (dbReplacementId) {
        await supabase.rpc('increment_view', { p_replacement_id: dbReplacementId })
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('View tracking error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
