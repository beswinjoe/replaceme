import { createClient } from '@/utils/supabase/server'
import { Header } from '@/components/Header'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Globe, Clock } from 'lucide-react'

interface ProfilePageProps {
  params: Promise<{ domain: string }>
}

function formatDuration(sec: number) {
  if (sec < 60) return `${Math.round(sec)} seconds`
  const mins = Math.floor(sec / 60)
  if (mins < 60) return `${mins} minutes`
  const hours = Math.floor(mins / 60)
  const remainingMins = mins % 60
  return `${hours}h ${remainingMins}m`
}

export default async function PublicProfilePage({ params }: ProfilePageProps) {
  const { domain: rawDomain } = await params
  
  const decoded = decodeURIComponent(rawDomain)
  // Remove @ if it exists
  const domain = decoded.startsWith('@') ? decoded.slice(1) : decoded

  const supabase = await createClient()

  // 1. Check if this domain is the current holder
  const { data: currentHolder } = await supabase
    .from('current_holder')
    .select('*')
    .single()

  const isCurrentlyNumberOne = currentHolder?.website_url === domain

  // 2. Fetch past reign stats from replacements
  const { data: replacements } = await supabase
    .from('replacements')
    .select('previous_holder_duration, previous_website_url, previous_website_name, previous_website_logo, new_website_url, new_website_name, new_website_logo')
    .or(`previous_website_url.eq.${domain},new_website_url.eq.${domain}`)

  if (!isCurrentlyNumberOne && (!replacements || replacements.length === 0)) {
    // Domain has never participated
    notFound()
  }

  // Calculate total reign time (when they were the previous_website_url)
  const pastReigns = replacements?.filter(r => r.previous_website_url === domain) || []
  const totalPastReignSeconds = pastReigns.reduce((acc, curr) => acc + Number(curr.previous_holder_duration || 0), 0)
  
  // Find latest metadata (name/logo)
  let websiteName = domain
  let websiteLogo = ''
  
  if (isCurrentlyNumberOne) {
    websiteName = currentHolder.website_name || domain
    websiteLogo = currentHolder.website_logo || ''
  } else {
    // Find the most recent entry where they were the new holder
    const recentAsNew = replacements?.filter(r => r.new_website_url === domain).pop()
    if (recentAsNew) {
      websiteName = recentAsNew.new_website_name || domain
      websiteLogo = recentAsNew.new_website_logo || ''
    } else {
      // Or when they were previous holder
      const recentAsPrev = pastReigns.pop()
      if (recentAsPrev) {
        websiteName = recentAsPrev.previous_website_name || domain
        websiteLogo = recentAsPrev.previous_website_logo || ''
      }
    }
  }

  return (
    <>
      <Header />
      <main className="flex-1 flex flex-col items-center pt-16 md:pt-24 pb-24 px-4 max-w-2xl mx-auto w-full text-center">
        
        {/* AVATAR */}
        <div className="mb-6 relative">
          {websiteLogo ? (
            <img 
              src={websiteLogo} 
              alt={websiteName} 
              className="w-24 h-24 md:w-32 md:h-32 rounded-[20px] object-cover border-4 border-[var(--surface)] shadow-lg bg-[var(--surface)]"
            />
          ) : (
            <div className="w-24 h-24 md:w-32 md:h-32 rounded-[20px] border-4 border-[var(--surface)] bg-[var(--surface-elevated)] flex items-center justify-center font-bold text-3xl shadow-lg">W</div>
          )}
          {isCurrentlyNumberOne && (
            <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-[var(--accent)] text-white flex items-center justify-center rounded-full text-xl shadow-md border-4 border-[var(--background)]" title="Currently #1">
              👑
            </div>
          )}
        </div>

        {/* IDENTITY */}
        <h1 className="text-3xl md:text-4xl font-bold text-[var(--foreground)] tracking-tight leading-tight">
          {websiteName}
        </h1>
        <p className="text-lg text-[var(--secondary)] font-medium mt-1">
          {domain}
        </p>

        {/* WEBSITE */}
        <a
          href={`https://${domain}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 text-[var(--accent)] font-bold mt-6 hover:opacity-80 transition-opacity bg-[var(--surface-elevated)] px-5 py-2.5 rounded-full"
        >
          <Globe className="w-4 h-4" />
          Visit Website
        </a>

        {/* REIGN INFO */}
        <div className="mt-12 w-full pt-10 border-t border-[var(--border-soft)]">
          {isCurrentlyNumberOne ? (
            <div className="bg-[var(--surface-elevated)] rounded-3xl p-8 border border-[var(--border-soft)] shadow-sm">
              <h2 className="text-xl font-bold tracking-tight text-[var(--foreground)] mb-2">
                Currently holding the #1 spot.
              </h2>
              <p className="text-[var(--secondary)] mb-6 font-medium">
                They can be replaced for <span className="text-[var(--foreground)] font-bold">${Number(currentHolder.current_price).toFixed(2)}</span>.
              </p>
              <Link 
                href="/?checkout=true"
                className="inline-block w-full sm:w-auto bg-[var(--accent)] text-white px-8 py-3.5 rounded-xl font-bold text-[15px] hover:opacity-90 transition-all uppercase tracking-wide"
              >
                REPLACE THEM
              </Link>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
              {totalPastReignSeconds > 0 ? (
                <div className="flex items-center gap-3 bg-[var(--surface)] border border-[var(--border)] px-6 py-4 rounded-2xl">
                  <Clock className="w-5 h-5 text-[var(--muted)]" />
                  <div className="text-left">
                    <p className="text-[12px] font-bold text-[var(--muted)] uppercase tracking-wider mb-0.5">Total Reign</p>
                    <p className="text-[16px] font-bold text-[var(--foreground)] tabular-nums">{formatDuration(totalPastReignSeconds)}</p>
                  </div>
                </div>
              ) : (
                <p className="text-[var(--secondary)] font-medium">Has not held the #1 spot yet.</p>
              )}
            </div>
          )}
        </div>
      </main>
    </>
  )
}
