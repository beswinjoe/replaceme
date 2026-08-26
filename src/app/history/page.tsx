'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/Header'
import { createClient } from '@/utils/supabase/client'
import Link from 'next/link'
import { ExternalLink, Clock } from 'lucide-react'
import { InitialsAvatar } from '@/components/InitialsAvatar'

export default function HistoryPage() {
  const supabase = createClient()
  const [replacements, setReplacements] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('replacements')
        .select(`
          id,
          amount_paid,
          price_before,
          price_after,
          previous_holder_duration,
          custom_message,
          website_url,
          created_at,
          previous_user:users!replacements_previous_user_id_fkey(*),
          new_user:users!replacements_new_user_id_fkey(*)
        `)
        .order('created_at', { ascending: false })

      if (!error && data) {
        setReplacements(data)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchHistory()

    const channel = supabase
      .channel('history-page-updates')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'replacements' },
        () => {
          fetchHistory()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const formatRelativeTime = (dateInput: string) => {
    const date = new Date(dateInput)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffSec = Math.floor(diffMs / 1000)

    if (diffSec < 60) return 'Just now'
    const diffMin = Math.floor(diffSec / 60)
    if (diffMin < 60) return `${diffMin}m ago`
    const diffHr = Math.floor(diffMin / 60)
    if (diffHr < 24) return `${diffHr}h ago`
    const diffDays = Math.floor(diffHr / 24)
    return `${diffDays}d ago`
  }

  const formatDuration = (sec: number | null) => {
    if (!sec) return '0s'
    if (sec < 60) return `${Math.round(sec)}s`
    const mins = Math.floor(sec / 60)
    if (mins < 60) return `${mins}m`
    const hours = Math.floor(mins / 60)
    const remainingMins = mins % 60
    return `${hours}h ${remainingMins}m`
  }

  return (
    <>
      <Header />
      <main className="flex-1 max-w-3xl mx-auto w-full py-12 px-4 space-y-12">
        
        {/* Title */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-[var(--foreground)]">
            The History of #1
          </h1>
          <p className="text-lg text-gray-500 font-medium">
            The complete chain of throne holders.
          </p>
        </div>

        {loading ? (
          <div className="text-center py-20 font-semibold text-lg animate-pulse text-gray-500">
            Loading History...
          </div>
        ) : replacements.length === 0 ? (
          <div className="bg-[var(--surface)] border border-[var(--border-soft)] rounded-2xl p-8 text-center text-gray-500 font-medium">
            No replacements registered yet. Go take the crown!
          </div>
        ) : (
          <div className="space-y-6 relative before:absolute before:inset-0 before:ml-6 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-[var(--border-soft)] before:to-transparent">
            {replacements.map((rep) => {
              const previousUser = rep.previous_user
              const newUser = rep.new_user
              const isFirstUser = !previousUser || previousUser.id === '00000000-0000-0000-0000-000000000000'

              return (
                <div key={rep.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                  
                  {/* Timeline Dot */}
                  <div className="flex items-center justify-center w-12 h-12 rounded-full border-4 border-[var(--background)] bg-[var(--surface)] text-gray-400 group-hover:text-[var(--accent)] group-hover:border-[var(--accent)] shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm transition-colors z-10 overflow-hidden">
                    {newUser?.avatar_url ? (
                      <img src={newUser.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                    ) : (
                      <InitialsAvatar name={newUser?.display_name || newUser?.username || 'Y N'} className="w-full h-full text-xl" />
                    )}
                  </div>

                  <div className="w-[calc(100%-4rem)] md:w-[calc(50%-3rem)] bg-[var(--surface)] border border-[var(--border-soft)] rounded-2xl p-5 hover:border-gray-300 dark:hover:border-gray-600 transition-colors shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Link href={`/@${newUser?.username}`} className="font-bold text-[var(--foreground)] hover:text-[var(--accent)] transition-colors">
                          @{newUser?.username || 'someone'}
                        </Link>
                      </div>
                      <span className="font-bold text-[var(--accent)]">
                        ${Number(rep.amount_paid).toFixed(2)}
                      </span>
                    </div>

                    <div className="text-sm text-gray-500 font-medium mb-3">
                      Replaced {isFirstUser ? 'the official account' : (
                        <Link href={`/@${previousUser?.username}`} className="text-[var(--foreground)] hover:text-[var(--accent)] transition-colors font-semibold">
                          @{previousUser?.username}
                        </Link>
                      )}
                    </div>

                    {rep.custom_message && (
                      <div className="bg-[var(--surface-elevated)] p-3 rounded-xl mb-4">
                        <p className="text-gray-600 dark:text-gray-300 text-sm italic font-medium break-words">
                          &ldquo;{rep.custom_message}&rdquo;
                        </p>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-gray-400">
                      <span>{formatRelativeTime(rep.created_at)}</span>
                      {rep.previous_holder_duration > 0 && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Held for {formatDuration(rep.previous_holder_duration)}
                        </span>
                      )}
                      {rep.website_url && (
                        <a href={rep.website_url} target="_blank" rel="noreferrer" className="text-[var(--accent)] hover:underline inline-flex items-center gap-1">
                          Link <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>

                </div>
              )
            })}
          </div>
        )}
      </main>
    </>
  )
}
