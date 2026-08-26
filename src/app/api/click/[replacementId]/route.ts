import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ replacementId: string }> }
) {
  const { replacementId } = await params
  const supabase = createAdminClient()

  // Find the target URL based on whether it's the current holder or a historical replacement
  let targetUrl = ''
  let websiteUrlId = ''

  if (replacementId === '00000000-0000-0000-0000-000000000000' || replacementId === 'current') {
    const { data: current } = await supabase
      .from('current_holder')
      .select('website_url')
      .single()
    if (current) {
      targetUrl = current.website_url
      websiteUrlId = current.website_url
    }
  } else {
    const { data: replacement } = await supabase
      .from('replacements')
      .select('new_website_url')
      .eq('id', replacementId)
      .single()
    if (replacement) {
      targetUrl = replacement.new_website_url
      websiteUrlId = replacement.new_website_url
    }
  }

  if (!targetUrl) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Ensure protocol
  if (!targetUrl.startsWith('http')) {
    targetUrl = `https://${targetUrl}`
  }

  // Get client ID securely (we expect it as a query param to avoid relying solely on cookies for a redirect link)
  const searchParams = request.nextUrl.searchParams
  let clientId = searchParams.get('client_id')
  
  if (!clientId) {
    // Attempt to grab from cookies if omitted in URL
    clientId = request.cookies.get('rm_client_id')?.value || 'anonymous-click'
  }

  // Record click
  if (clientId && websiteUrlId) {
    const actualReplacementId = replacementId === 'current' ? '00000000-0000-0000-0000-000000000000' : replacementId
    
    // We attempt insert, ignoring if they already clicked during this reign
    const { error } = await supabase
      .from('reign_events')
      .insert({
        website_url: websiteUrlId,
        replacement_id: actualReplacementId,
        event_type: 'click',
        client_id: clientId,
      })

    if (!error || error.code !== '23505') {
      // Successfully inserted a new unique click, so increment the counter
      await supabase.rpc('increment_click', { p_replacement_id: actualReplacementId })
    }
  }

  // Redirect to target URL
  return NextResponse.redirect(targetUrl)
}
