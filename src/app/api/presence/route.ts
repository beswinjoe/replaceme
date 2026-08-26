import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'

export async function POST(request: NextRequest) {
  const supabase = createAdminClient()

  try {
    const { clientId, websiteUrl } = await request.json()

    if (!clientId || !websiteUrl) {
      return NextResponse.json({ error: 'Missing clientId or websiteUrl' }, { status: 400 })
    }

    // Upsert presence (we'll just use insert on conflict update)
    // Wait, since we are doing an upsert, we need to handle conflict on (website_url, client_id)
    const { error } = await supabase
      .from('live_presence')
      .upsert(
        { website_url: websiteUrl, client_id: clientId, last_seen_at: new Date().toISOString() },
        { onConflict: 'website_url,client_id' }
      )
    
    if (error) {
      console.error('Error updating presence:', error)
    }

    // Return the current count of active viewers for this website (last 45 seconds)
    // Unfortunately Supabase count with a time filter in JS requires a select with a time filter.
    const fortyFiveSecondsAgo = new Date(Date.now() - 45 * 1000).toISOString()
    
    const { count, error: countError } = await supabase
      .from('live_presence')
      .select('*', { count: 'exact', head: true })
      .eq('website_url', websiteUrl)
      .gte('last_seen_at', fortyFiveSecondsAgo)

    if (countError) {
      console.error('Error counting presence:', countError)
      return NextResponse.json({ liveViewers: 0 }) // fallback to 0
    }

    return NextResponse.json({ liveViewers: count || 0 })
  } catch (err) {
    console.error('Presence tracking error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
