import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'

export async function GET(request: NextRequest) {
  // Simple auth for admin route
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.DODO_PAYMENTS_API_KEY}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  // 1. Fetch all replacements that need logo checking
  // We'll just fetch all replacements, it's a small dataset early on.
  const { data: replacements, error: repError } = await supabase
    .from('replacements')
    .select('id, new_website_url, new_website_logo, logo_source')
    
  if (repError) {
    return NextResponse.json({ error: repError.message }, { status: 500 })
  }

  const { data: currentHolder, error: chError } = await supabase
    .from('current_holder')
    .select('id, website_url, website_logo, logo_source')
    .single()

  const allRecords = [
    ...(replacements || []).map(r => ({ ...r, type: 'replacement' })),
    ...(currentHolder ? [{ ...currentHolder, type: 'current_holder', new_website_url: currentHolder.website_url, new_website_logo: currentHolder.website_logo }] : [])
  ]

  const fixed = []
  
  // Create a local metadata fetcher equivalent since we can't easily call our own API route locally during this script without knowing the absolute URL
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.NEXT_PUBLIC_VERCEL_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` : 'http://localhost:3000')

  for (const record of allRecords) {
    const isGeneric = 
      record.new_website_logo.includes('t2.gstatic.com') ||
      record.new_website_logo.includes('/api/avatar') ||
      record.new_website_logo.includes('vercel.svg') ||
      record.logo_source === 'fallback'
      
    if (isGeneric) {
      try {
        const res = await fetch(`${appUrl}/api/metadata?url=${encodeURIComponent(record.new_website_url)}`)
        const meta = await res.json()
        
        if (meta && meta.logoUrl && meta.logoSource === 'detected') {
          // Found a real logo! Let's update it.
          if (record.type === 'replacement') {
            await supabase
              .from('replacements')
              .update({
                new_website_logo: meta.logoUrl,
                logo_source: 'detected'
              })
              .eq('id', record.id)
          } else {
            await supabase
              .from('current_holder')
              .update({
                website_logo: meta.logoUrl,
                logo_source: 'detected'
              })
              .eq('id', record.id)
          }
          
          fixed.push({ id: record.id, old: record.new_website_logo, new: meta.logoUrl })
        } else if (meta.logoSource === 'fallback' && record.logo_source !== 'fallback') {
           // Ensure it's correctly labeled as fallback in DB if it is one
           if (record.type === 'replacement') {
             await supabase.from('replacements').update({ logo_source: 'fallback' }).eq('id', record.id)
           } else {
             await supabase.from('current_holder').update({ logo_source: 'fallback' }).eq('id', record.id)
           }
        }
      } catch (e) {
        console.error(`Failed to migrate logo for ${record.new_website_url}:`, e)
      }
    }
  }

  return NextResponse.json({ success: true, fixedCount: fixed.length, fixed })
}
