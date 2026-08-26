import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ replacementId: string }> }
) {
  const { replacementId } = await params
  const supabase = createAdminClient()

  let targetUrl = ''
  let websiteUrlId = ''
  let isActiveReign = false
  let dbReplacementId: string | null = replacementId

  // Genesis reign comes in as 'genesis' string
  if (replacementId === 'genesis') {
    dbReplacementId = null
    isActiveReign = true
    
    // Fetch genesis URL directly from current_holder
    const { data: current } = await supabase
      .from('current_holder')
      .select('website_url, active_reign_id')
      .single()
      
    if (current && current.active_reign_id === null) {
      targetUrl = current.website_url
      websiteUrlId = current.website_url
    }
  } else {
    // Normal reign with a UUID
    // First, check if this is the ACTIVE reign
    const { data: current } = await supabase
      .from('current_holder')
      .select('website_url, active_reign_id')
      .single()

    if (current && current.active_reign_id === replacementId) {
      isActiveReign = true
      targetUrl = current.website_url
      websiteUrlId = current.website_url
    } else {
      // Historical reign
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
  }

  if (!targetUrl) {
    return NextResponse.redirect(new URL('/', request.url))
  }

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
  if (clientId && websiteUrlId) {
    const { error } = await supabase
      .from('reign_events')
      .insert({
        website_url: websiteUrlId,
        replacement_id: dbReplacementId,
        event_type: 'click',
        client_id: clientId,
      })

    if (!error || error.code !== '23505') {
      // If active reign, we increment current_holder. If historical, we increment replacements.
      // We'll update the RPC logic slightly by handling it in JS for exactness without schema churn,
      // or we can use an RPC. Since we have Admin Client, we can just update directly.
      if (isActiveReign) {
        await supabase.rpc('increment_click', { p_replacement_id: '00000000-0000-0000-0000-000000000000' })
      } else if (dbReplacementId) {
        await supabase.rpc('increment_click', { p_replacement_id: dbReplacementId })
      }
    }
  }

  // Redirect to target URL
  return NextResponse.redirect(targetUrl)
}
