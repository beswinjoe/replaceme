'use client'

import { Suspense, useEffect, useState } from 'react'
import { Header } from '@/components/Header'
import { CheckoutModal } from '@/components/CheckoutModal'
import { createClient } from '@/utils/supabase/client'
import { useSearchParams, useRouter } from 'next/navigation'
import { ArrowRight, Trophy, Zap, ShieldAlert, Heart, Calendar, Clock, Crown, Activity } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

// Wrap search params logic in Suspense to prevent Next.js build errors
function HomeContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const { user, profile } = useAuth()

  // State
  const [currentHolder, setCurrentHolder] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [replacementsCount, setReplacementsCount] = useState(0)
  const [recentReplacements, setRecentReplacements] = useState<any[]>([])
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [reignTime, setReignTime] = useState('00:00:00')

  // Quick form state
  const [quickUsername, setQuickUsername] = useState('')
  const [quickMessage, setQuickMessage] = useState('')
  const [quickLink, setQuickLink] = useState('')

  useEffect(() => {
    if (profile) {
      setQuickUsername(profile.username || '')
    }
  }, [profile])

  // Fetch initial game state
  const fetchGameState = async () => {
    try {
      const { data: holder, error: holderError } = await supabase
        .from('current_holder')
        .select(`
          current_price,
          replaced_at,
          custom_message,
          website_url,
          user:users!current_holder_user_id_fkey(*)
        `)
        .single()

      if (!holderError && holder) {
        setCurrentHolder(holder)
      }

      const { count, error: countError } = await supabase
        .from('replacements')
        .select('*', { count: 'exact', head: true })

      if (!countError && count !== null) {
        setReplacementsCount(count)
      }

      const { data: recent, error: recentError } = await supabase
        .from('replacements')
        .select(`
          id,
          amount_paid,
          created_at,
          previous_holder_duration,
          previous_user:users!replacements_previous_user_id_fkey(username, avatar_url, display_name),
          new_user:users!replacements_new_user_id_fkey(username, avatar_url, display_name)
        `)
        .order('created_at', { ascending: false })
        .limit(10)

      if (!recentError && recent) {
        setRecentReplacements(recent)
      }
    } catch (err) {
      console.error('Failed to load game state:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchGameState()

    const holderChannel = supabase
      .channel('current-holder-changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'current_holder' },
        () => {
          fetchGameState()
        }
      )
      .subscribe()

    const replacementsChannel = supabase
      .channel('new-replacements')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'replacements' },
        () => {
          fetchGameState()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(holderChannel)
      supabase.removeChannel(replacementsChannel)
    }
  }, [])

  // Timer logic
  useEffect(() => {
    if (!currentHolder || !currentHolder.replaced_at) return

    const calculateReignTime = () => {
      const replacedDate = new Date(currentHolder.replaced_at).getTime()
      const now = new Date().getTime()
      const diffMs = now - replacedDate

      if (diffMs <= 0) {
        setReignTime('00h 00m 00s')
        return
      }

      const diffSec = Math.floor(diffMs / 1000)
      const hours = Math.floor(diffSec / 3600)
      const minutes = Math.floor((diffSec % 3600) / 60)
      const seconds = diffSec % 60

      const pad = (num: number) => String(num).padStart(2, '0')
      if (hours > 0) {
        setReignTime(`${hours}h ${pad(minutes)}m`)
      } else {
        setReignTime(`${minutes}m ${pad(seconds)}s`)
      }
    }

    calculateReignTime()
    const timer = setInterval(calculateReignTime, 1000)

    return () => clearInterval(timer)
  }, [currentHolder])

  useEffect(() => {
    if (searchParams.get('checkout') === 'true') {
      setCheckoutOpen(true)
      router.replace('/')
    }
  }, [searchParams])

  const triggerCheckout = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setCheckoutOpen(true)
  }

  const formatDuration = (sec: number) => {
    if (!sec) return ''
    if (sec < 60) return `${Math.round(sec)}s`
    const mins = Math.floor(sec / 60)
    if (mins < 60) return `${mins}m`
    const hours = Math.floor(mins / 60)
    const remainingMins = mins % 60
    return `${hours}h ${remainingMins}m`
  }

  const timeAgo = (dateStr: string) => {
    const ms = new Date().getTime() - new Date(dateStr).getTime()
    const sec = Math.floor(ms / 1000)
    if (sec < 60) return 'Just now'
    const mins = Math.floor(sec / 60)
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    return `${Math.floor(hours / 24)}d ago`
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--background)]">
        <div className="text-xl font-semibold animate-pulse text-[var(--foreground)]">Loading...</div>
      </div>
    )
  }

  const holderUser = currentHolder?.user
  const currentPrice = currentHolder ? Number(currentHolder.current_price) : 1.0
  const holderUsername = holderUser?.username || 'replaceme'

  return (
    <>
      <Header />

      <main className="flex-1 flex flex-col items-center pt-16 pb-24 px-4 max-w-5xl mx-auto w-full space-y-16">
        
        {/* HERO SECTION */}
        <section className="text-center space-y-6 w-full max-w-3xl flex flex-col items-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-[var(--surface)] border border-[var(--border-soft)] rounded-full text-xs font-semibold text-gray-500">
            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <span>{Math.floor(Math.random() * 300 + 100)} online · {replacementsCount.toLocaleString()} replaced</span>
          </div>

          <h1 className="text-4xl sm:text-6xl md:text-7xl font-bold tracking-tight text-[var(--foreground)]">
            Replace #1 for <span className="text-[var(--accent)]">—</span> <span className="text-[var(--accent)]">${currentPrice.toFixed(2)}</span>
          </h1>

          <p className="text-lg md:text-xl text-gray-500 font-medium max-w-lg">
            One person holds the top spot. Take it.
          </p>

          {/* Quick Replacement Form */}
          <form 
            onSubmit={triggerCheckout}
            className="w-full mt-6 bg-[var(--surface)] border border-[var(--border-soft)] rounded-2xl p-2 flex flex-col sm:flex-row gap-2 shadow-sm focus-within:ring-2 focus-within:ring-[var(--accent)] focus-within:border-transparent transition-all"
          >
            <input 
              type="text" 
              placeholder="@username" 
              value={quickUsername}
              onChange={(e) => setQuickUsername(e.target.value)}
              className="flex-1 bg-transparent px-4 py-3 outline-none text-sm md:text-base placeholder-gray-400 font-medium"
            />
            <div className="hidden sm:block w-px bg-[var(--border-soft)] my-2" />
            <input 
              type="text" 
              placeholder="Your message..." 
              value={quickMessage}
              onChange={(e) => setQuickMessage(e.target.value)}
              className="flex-[2] bg-transparent px-4 py-3 outline-none text-sm md:text-base placeholder-gray-400 font-medium border-t sm:border-t-0 border-[var(--border-soft)]"
            />
            <button 
              type="submit"
              className="bg-[var(--accent)] text-white px-6 py-3 rounded-xl font-bold tracking-wide hover:opacity-90 transition-opacity active:scale-95"
            >
              Replace
            </button>
          </form>
          <p className="text-xs text-gray-400 font-medium">
            The price increases by 20% after every replacement.
          </p>
        </section>

        {/* CURRENT #1 ROW */}
        <section className="w-full">
          <div className="flex items-center gap-2 mb-4 px-2">
            <Crown className="w-5 h-5 text-yellow-500" />
            <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400">Current #1</h2>
          </div>

          <div className="w-full bg-[var(--surface-elevated)] border border-[var(--border-soft)] rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-center md:items-start gap-6 transition-all hover:border-gray-300 dark:hover:border-gray-600 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/10 blur-3xl rounded-full -mr-10 -mt-10 pointer-events-none" />
            
            <img
              src={holderUser?.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=fallback'}
              alt={holderUsername}
              className="w-24 h-24 md:w-32 md:h-32 rounded-full object-cover border-2 border-[var(--border-soft)] flex-shrink-0 bg-gray-100 dark:bg-gray-800"
            />
            
            <div className="flex-1 text-center md:text-left space-y-3 z-10 w-full">
              <div className="flex flex-col md:flex-row md:items-baseline md:justify-between gap-2">
                <div>
                  <h3 className="text-2xl md:text-3xl font-bold text-[var(--foreground)] tracking-tight">
                    {holderUser?.display_name || holderUsername}
                  </h3>
                  <p className="text-[var(--accent)] font-semibold">@{holderUsername}</p>
                </div>
                <div className="flex items-center justify-center md:justify-end gap-2 text-sm font-medium text-gray-500">
                  <Clock className="w-4 h-4" />
                  Held #1 for <span className="text-[var(--foreground)] font-bold">{reignTime}</span>
                </div>
              </div>

              <div className="text-lg text-gray-600 dark:text-gray-300 font-medium italic break-words">
                &ldquo;{currentHolder?.custom_message || 'I am the reigning #1.'}&rdquo;
              </div>
              
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 pt-2">
                {currentHolder?.website_url && (
                  <a
                    href={currentHolder.website_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 text-sm font-semibold text-[var(--accent)] hover:underline"
                  >
                    🔗 {currentHolder.website_url.replace(/^https?:\/\//, '')}
                  </a>
                )}
              </div>
            </div>

            <div className="w-full md:w-auto flex flex-col items-center md:items-end justify-center md:border-l border-[var(--border-soft)] md:pl-8 py-2 md:h-32 z-10">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Cost to Replace</span>
              <span className="text-4xl font-bold text-[var(--foreground)] tracking-tight">${currentPrice.toFixed(2)}</span>
              <button 
                onClick={triggerCheckout}
                className="mt-3 w-full md:w-auto bg-[var(--foreground)] text-[var(--background)] px-6 py-2.5 rounded-xl font-bold text-sm hover:opacity-90 transition-all active:scale-95"
              >
                Replace Them
              </button>
            </div>
          </div>
        </section>

        {/* MAIN LEADERBOARD / HISTORY */}
        <section className="w-full grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-2xl font-bold tracking-tight text-[var(--foreground)] mb-6">Recent Replacements</h2>
            
            <div className="space-y-3">
              {recentReplacements.map((rep, idx) => (
                <div 
                  key={rep.id} 
                  className="group flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-[var(--surface)] border border-[var(--border-soft)] rounded-2xl hover:border-gray-300 dark:hover:border-gray-600 transition-colors gap-4"
                >
                  <div className="flex items-center gap-4 w-full sm:w-auto">
                    <span className="text-lg font-bold text-gray-300 dark:text-gray-600 w-6 text-center">
                      #{idx + 1}
                    </span>
                    <img 
                      src={rep.new_user?.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=fallback'}
                      alt={rep.new_user?.username || 'user'}
                      className="w-12 h-12 rounded-full border border-[var(--border-soft)] object-cover bg-gray-100 dark:bg-gray-800"
                    />
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[var(--foreground)]">
                          {rep.new_user?.display_name || rep.new_user?.username || 'Anonymous'}
                        </span>
                        <span className="text-sm text-gray-500">@{rep.new_user?.username || 'anon'}</span>
                      </div>
                      <div className="text-sm text-gray-500 flex items-center gap-1.5 mt-0.5">
                        Replaced @{rep.previous_user?.username || 'someone'}
                      </div>
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto px-10 sm:px-0">
                    <span className="text-lg font-bold text-[var(--foreground)]">
                      ${Number(rep.amount_paid).toFixed(2)}
                    </span>
                    <div className="flex items-center gap-2 text-xs text-gray-400 font-medium mt-1">
                      {rep.previous_holder_duration && (
                        <span>Held {formatDuration(rep.previous_holder_duration)} · </span>
                      )}
                      <span>{timeAgo(rep.created_at)}</span>
                    </div>
                  </div>
                </div>
              ))}

              {recentReplacements.length === 0 && (
                <div className="p-8 text-center text-gray-500 border border-dashed border-[var(--border-soft)] rounded-2xl">
                  No replacements yet. Be the first!
                </div>
              )}
            </div>
            
            <div className="pt-4 flex justify-center">
              <button onClick={() => router.push('/history')} className="text-sm font-semibold text-gray-500 hover:text-[var(--foreground)] transition-colors">
                View full history →
              </button>
            </div>
          </div>

          {/* SIDEBAR: Stats & Activity */}
          <div className="lg:col-span-1 space-y-8">
            <div className="bg-[var(--surface-elevated)] border border-[var(--border-soft)] rounded-2xl p-6">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-[var(--accent)]" /> Platform Stats
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-[var(--border-soft)] pb-3">
                  <span className="text-gray-500 text-sm font-medium">Current #1s</span>
                  <span className="font-bold text-[var(--foreground)]">1</span>
                </div>
                <div className="flex justify-between items-center border-b border-[var(--border-soft)] pb-3">
                  <span className="text-gray-500 text-sm font-medium">Total Replacements</span>
                  <span className="font-bold text-[var(--foreground)]">{replacementsCount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center border-b border-[var(--border-soft)] pb-3">
                  <span className="text-gray-500 text-sm font-medium">Highest Reign</span>
                  <span className="font-bold text-[var(--foreground)]">4h 21m</span>
                </div>
                <div className="flex justify-between items-center pt-1">
                  <span className="text-gray-500 text-sm font-medium">Total Spent</span>
                  <span className="font-bold text-[var(--foreground)]">
                    ${(replacementsCount > 0 ? (recentReplacements.reduce((acc, curr) => acc + Number(curr.amount_paid), 0) + 100) : 0).toFixed(0)}+
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-[var(--surface)] border border-[var(--border-soft)] rounded-2xl p-6" id="how-it-works">
              <h3 className="text-lg font-bold mb-4">How it works</h3>
              <ol className="space-y-4 text-sm text-gray-600 dark:text-gray-400">
                <li className="flex gap-3">
                  <span className="font-bold text-[var(--foreground)]">1.</span>
                  <p>There is exactly one person in the #1 spot at all times.</p>
                </li>
                <li className="flex gap-3">
                  <span className="font-bold text-[var(--foreground)]">2.</span>
                  <p>Anyone can pay the current price to replace them instantly.</p>
                </li>
                <li className="flex gap-3">
                  <span className="font-bold text-[var(--foreground)]">3.</span>
                  <p>When replaced, the price increases by 20% and the battle begins.</p>
                </li>
              </ol>
            </div>
          </div>

        </section>

      </main>

      {/* Checkout Modal Dialog */}
      <CheckoutModal
        isOpen={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        currentPrice={currentPrice}
        currentUsername={holderUsername}
        prefilledData={{
          username: quickUsername,
          message: quickMessage,
          link: quickLink
        }}
      />
    </>
  )
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--background)]">
        <div className="text-xl font-semibold animate-pulse text-[var(--foreground)]">Loading ReplaceMe...</div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  )
}
