import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const ids: string[] = body?.ids || []

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ success: true }) // Silent ignore
    }

    const supabase = createAdminClient()
    
    // Increment view for all valid UUIDs
    const validIds = ids.filter(id => id && id.length === 36)
    
    // Run them in parallel using the existing increment_view RPC
    await Promise.all(
      validIds.map(id => supabase.rpc('increment_view', { p_replacement_id: id }))
    )

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Batch view tracking error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
