import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get total earned and oldest record (launch time)
    // We use the payments table for confirmed revenue, or replacements table since replacements only happen on successful payments
    const { data: replacements, error } = await supabase
      .from('replacements')
      .select('amount_paid, created_at')
      
    if (error) {
      throw error
    }
    
    let total = 0
    let oldestDate = new Date()
    
    if (replacements && replacements.length > 0) {
      total = replacements.reduce((sum, r) => sum + Number(r.amount_paid || 0), 0)
      
      // Find oldest date
      oldestDate = new Date(replacements[0].created_at)
      for (const r of replacements) {
        const d = new Date(r.created_at)
        if (d < oldestDate) oldestDate = d
      }
    }
    
    const now = new Date()
    const diffMs = now.getTime() - oldestDate.getTime()
    const hours = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60)))
    
    return NextResponse.json({
      totalEarned: total,
      launchAgeHours: hours
    })
  } catch (err: any) {
    console.error('Stats error:', err)
    return NextResponse.json({ totalEarned: 0, launchAgeHours: 0 }, { status: 500 })
  }
}
