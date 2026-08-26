import { createClient } from '@/utils/supabase/server'
import { InitialsAvatar } from '@/components/InitialsAvatar'
import { Header } from '@/components/Header'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Globe, Clock } from 'lucide-react'

import { isValidUsername } from '@/utils/validation'

interface ProfilePageProps {
  params: Promise<{ username: string }>
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
  const { username: rawUsername } = await params
  
  // Clean the username (supports both /@username and /username)
  const decoded = decodeURIComponent(rawUsername)
  const username = decoded.startsWith('@') ? decoded.slice(1) : decoded

  if (!isValidUsername(username)) {
    notFound()
  }

  const supabase = await createClient()

  // 1. Fetch user profile
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('*')
    .ilike('username', username)
    .single()

  if (userError || !user) {
    notFound()
  }

  // 2. Fetch current holder status
  const { data: currentHolder } = await supabase
    .from('current_holder')
    .select('*')
    .single()

  const isCurrentlyNumberOne = currentHolder?.user_id === user.id
  
  // 3. Fetch past reign stats if they aren't currently #1, or total reign time
  const { data: replacements } = await supabase
    .from('replacements')
    .select('previous_holder_duration')
    .eq('previous_user_id', user.id)

  const totalPastReignSeconds = replacements?.reduce((acc, curr) => acc + Number(curr.previous_holder_duration || 0), 0) || 0
  const totalReplacements = replacements?.length || 0

  return (
    <>
      <Header />
      <main className="flex-1 flex flex-col items-center pt-16 md:pt-24 pb-24 px-4 max-w-2xl mx-auto w-full text-center">
        
        {/* AVATAR */}
        <div className="mb-6 relative">
          {user.avatar_url ? (
            <img 
              src={user.avatar_url} 
              alt={user.username} 
              className="w-24 h-24 md:w-32 md:h-32 rounded-full object-cover border-4 border-[var(--surface)] shadow-lg bg-[var(--surface)]"
            />
          ) : (
            <InitialsAvatar 
              name={user.display_name || user.username} 
              className="w-24 h-24 md:w-32 md:h-32 border-4 border-[var(--surface)] text-3xl shadow-lg"
            />
          )}
          {isCurrentlyNumberOne && (
            <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-[var(--accent)] text-white flex items-center justify-center rounded-full text-xl shadow-md border-4 border-[var(--background)]" title="Currently #1">
              👑
            </div>
          )}
        </div>

        {/* IDENTITY */}
        <h1 className="text-3xl md:text-4xl font-bold text-[var(--foreground)] tracking-tight leading-tight">
          {user.display_name || user.username}
        </h1>
        <p className="text-lg text-[var(--secondary)] font-medium mt-1">
          @{user.username}
        </p>

        {/* CLAIM */}
        {user.bio && (
          <div className="mt-8 text-xl md:text-2xl font-medium text-[var(--foreground)] leading-snug">
            &quot;{user.bio}&quot;
          </div>
        )}

        {/* WEBSITE */}
        {user.website_url && (
          <a
            href={user.website_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-[var(--accent)] font-bold mt-6 hover:opacity-80 transition-opacity bg-[var(--surface-elevated)] px-5 py-2.5 rounded-full"
          >
            <Globe className="w-4 h-4" />
            {user.website_url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
          </a>
        )}

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
