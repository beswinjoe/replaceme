import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ replacementId: string }> }
) {
  const { replacementId } = await params
  const supabase = createAdminClient()

  if (!replacementId || replacementId.length !== 36) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Find the target URL from the exact reign
  const { data: replacement } = await supabase
    .from('replacements')
    .select('new_website_url')
    .eq('id', replacementId)
    .single()
    
  if (!replacement || !replacement.new_website_url) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  let targetUrl = replacement.new_website_url

  // Ensure protocol
  if (!targetUrl.startsWith('http')) {
    targetUrl = `https://${targetUrl}`
  }

  // Get client ID securely
  const searchParams = request.nextUrl.searchParams
  let clientId = searchParams.get('client_id')
  
  if (!clientId) {
    clientId = request.cookies.get('rm_client_id')?.value || 'anonymous-click'
  }

  // Record click
  if (clientId) {
    const { error } = await supabase
      .from('reign_events')
      .insert({
        website_url: replacement.new_website_url,
        replacement_id: replacementId,
        event_type: 'click',
        client_id: clientId,
      })

    // If it's not a duplicate, increment the count
    if (!error) {
      await supabase.rpc('increment_click', { p_replacement_id: replacementId })
    } else if (error.code !== '23505') {
      console.error('Click tracking error:', error)
    }
  }

  // Redirect to target URL
  return NextResponse.redirect(targetUrl)
}
