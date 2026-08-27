import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ replacementId: string }> }
) {
  const { replacementId } = await params;
  const { searchParams } = new URL(request.url)
  let targetUrl = searchParams.get('url')

  if (!targetUrl) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Ensure url has protocol
  if (!/^https?:\/\//i.test(targetUrl)) {
    targetUrl = 'https://' + targetUrl
  }

  try {
    const supabase = createAdminClient()
    
    // Call the RPC to increment click
    await supabase.rpc('increment_click', {
      p_replacement_id: replacementId
    })

    return NextResponse.redirect(targetUrl)
  } catch (error) {
    console.error('Failed to process click:', error)
    return NextResponse.redirect(targetUrl)
  }
}
