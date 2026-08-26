'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { createClient } from '@/utils/supabase/client'
import { X, ArrowRight } from 'lucide-react'
import { useRouter } from 'next/navigation'

export function ReplacedOverlay() {
  const { notification, clearNotification, user } = useAuth()
  const [details, setDetails] = useState<{
    newUsername: string
    amountPaid: number
    durationSeconds: number
  } | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    if (!notification || notification.type !== 'replaced' || !user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDetails(null)
      return
    }

    const fetchReplacementDetails = async () => {
      const { data, error } = await supabase
        .from('replacements')
        .select(`
          amount_paid,
          previous_holder_duration,
          new_user:users!replacements_new_user_id_fkey(username)
        `)
        .eq('previous_user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (!error && data) {
        const newUser = data.new_user as unknown as { username: string }
        setDetails({
          newUsername: newUser?.username || 'someone',
          amountPaid: Number(data.amount_paid),
          durationSeconds: Number(data.previous_holder_duration || 0),
        })
      } else {
        setDetails({
          newUsername: 'someone',
          amountPaid: 0,
          durationSeconds: 0,
        })
      }
    }

    fetchReplacementDetails()
  }, [notification, user])

  if (!notification || notification.type !== 'replaced' || !details) return null

  const formatDuration = (sec: number) => {
    if (sec < 60) return `${Math.round(sec)} seconds`
    const mins = Math.floor(sec / 60)
    if (mins < 60) return `${mins} minutes`
    const hours = Math.floor(mins / 60)
    const remainingMins = mins % 60
    return `${hours}h ${remainingMins}m`
  }

  const handleRevenge = () => {
    clearNotification()
    router.push('/?checkout=true')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="relative w-full max-w-xl bg-[var(--surface)] border border-[var(--border-soft)] rounded-3xl p-8 md:p-12 text-center shadow-2xl animate-in zoom-in-95 duration-400">
        <button
          onClick={clearNotification}
          className="absolute right-6 top-6 p-2 text-gray-400 hover:text-[var(--foreground)] transition-colors rounded-full hover:bg-[var(--surface-elevated)]"
        >
          <X className="h-5 w-5" />
        </button>

        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-[var(--foreground)] mb-6">
          You got replaced.
        </h1>

        <div className="text-lg md:text-xl font-medium text-gray-600 dark:text-gray-300 mb-8 leading-relaxed">
          <span className="font-bold text-[var(--foreground)]">@{details.newUsername}</span> took your spot for{' '}
          <span className="font-bold text-[var(--accent)]">${details.amountPaid.toFixed(2)}</span>.
        </div>

        <div className="bg-[var(--surface-elevated)] border border-[var(--border-soft)] rounded-2xl p-6 mb-10 text-center">
          <p className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">You held #1 for:</p>
          <p className="text-3xl font-bold text-[var(--foreground)]">
            {formatDuration(details.durationSeconds)}
          </p>
        </div>

        <h3 className="text-lg md:text-xl font-semibold text-[var(--foreground)] mb-6">
          You going to let that happen?
        </h3>

        <div className="space-y-4">
          <button
            onClick={handleRevenge}
            className="w-full bg-[var(--foreground)] text-[var(--background)] font-bold text-lg py-4 rounded-xl hover:opacity-90 transition-opacity shadow-md"
          >
            REPLACE THEM BACK
          </button>
          
          <button
            onClick={clearNotification}
            className="flex items-center justify-center gap-1.5 w-full text-gray-500 hover:text-[var(--foreground)] font-semibold text-sm transition-colors py-2"
          >
            View new #1 <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
