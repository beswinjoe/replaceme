'use client'

import { Suspense, useEffect, useState } from 'react'
import { Header } from '@/components/Header'
import { CheckoutModal } from '@/components/CheckoutModal'
import { createClient } from '@/utils/supabase/client'
import { useSearchParams, useRouter } from 'next/navigation'
import { Clock } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

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
  const [reignTime, setReignTime] = useState('0s')

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
        setReignTime('0s')
        return
      }

      const diffSec = Math.floor(diffMs / 1000)
      const hours = Math.floor(diffSec / 3600)
      const minutes = Math.floor((diffSec % 3600) / 60)
      const seconds = diffSec % 60

      if (hours > 0) {
        setReignTime(`${hours}h ${minutes}m`)
      } else if (minutes > 0) {
        setReignTime(`${minutes}m ${seconds}s`)
      } else {
        setReignTime(`${seconds}s`)
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
        <div className="text-[15px] font-semibold animate-pulse text-[var(--secondary)]">Loading...</div>
      </div>
    )
  }

  // Derive initial/empty states safely
  const isInitialState = replacementsCount === 0;
  const holderUser = currentHolder?.user;
  const currentPrice = currentHolder ? Number(currentHolder.current_price) : 1.0;
  
  const holderUsername = isInitialState ? 'replaceme' : (holderUser?.username || 'replaceme');
  const holderDisplayName = isInitialState ? 'ReplaceMe' : (holderUser?.display_name || holderUsername);
  const holderAvatar = isInitialState 
    ? 'https://api.dicebear.com/7.x/avataaars/svg?seed=replaceme' 
    : (holderUser?.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=fallback');
  const holderMessage = isInitialState ? 'Someone has to be first.' : (currentHolder?.custom_message || 'I am the reigning #1.');

  return (
    <>
      <Header />

      <main className="flex-1 flex flex-col items-center pt-12 md:pt-16 pb-24 px-4 md:px-6 lg:px-8 max-w-[1240px] mx-auto w-full">
        
        {/* HERO SECTION */}
        <section className="text-center w-full max-w-3xl flex flex-col items-center mb-12">
          <div className="text-[12px] font-bold text-[var(--muted)] uppercase tracking-[0.1em] mb-4">
            The Internet's #1 Spot
          </div>
          <h1 className="text-[44px] md:text-[56px] font-bold tracking-tight text-[var(--foreground)] leading-[1.05] mb-2">
            Replace #1 for
          </h1>
          <h2 className="text-[40px] md:text-[48px] font-bold text-[var(--accent)] tracking-tight tabular-nums mb-5">
            ${currentPrice.toFixed(2)}
          </h2>
          <p className="text-[15px] md:text-[16px] text-[var(--secondary)] font-medium max-w-lg mb-8">
            One person holds the spot. Replace them and become #1.
          </p>

          {/* Replacement Input Bar */}
          <form 
            onSubmit={triggerCheckout}
            className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-[14px] p-1.5 flex flex-col md:flex-row gap-1.5 shadow-[0_2px_8px_rgba(0,0,0,0.02)] focus-within:border-[var(--accent)] transition-all"
          >
            <input 
              type="text" 
              placeholder="@yourusername" 
              value={quickUsername}
              onChange={(e) => setQuickUsername(e.target.value)}
              className="flex-1 bg-transparent px-4 py-3 outline-none text-[15px] placeholder-[var(--muted)] font-medium"
            />
            <div className="hidden md:block w-px bg-[var(--border)] my-2" />
            <input 
              type="text" 
              placeholder="Your claim..." 
              value={quickMessage}
              onChange={(e) => setQuickMessage(e.target.value)}
              className="flex-[2] bg-transparent px-4 py-3 outline-none text-[15px] placeholder-[var(--muted)] font-medium border-t md:border-t-0 border-[var(--border)]"
            />
            <button 
              type="submit"
              className="bg-[var(--accent)] text-white px-8 py-3 rounded-[12px] text-[15px] font-semibold tracking-wide hover:opacity-90 transition-opacity active:scale-[0.98]"
            >
              Replace #1
            </button>
          </form>
          <div className="flex items-center gap-3 mt-4 text-[13px] text-[var(--muted)] font-medium">
            <span>Price increases after every successful replacement.</span>
          </div>
        </section>

        {/* CURRENT #1 ROW */}
        <section className="w-full max-w-5xl mb-14">
          <h3 className="text-[14px] font-bold text-[var(--muted)] uppercase tracking-[0.05em] mb-4 pl-1">CURRENT #1</h3>
          
          <div className="w-full bg-[#FFF9F5] dark:bg-[#1A1513] border border-[var(--accent)] rounded-[16px] p-5 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 md:gap-8 transition-all min-h-[180px]">
            
            {/* LEFT: Rank & User */}
            <div className="flex items-center gap-4 w-full md:w-auto md:min-w-[240px] flex-shrink-0">
              <span className="text-[20px] md:text-[24px] font-bold text-[var(--accent)] w-8 text-center">#1</span>
              <img
                src={holderAvatar}
                alt={holderUsername}
                className="w-14 h-14 md:w-16 md:h-16 rounded-full object-cover border border-[#E8E3DE] dark:border-[#2A2A2A] flex-shrink-0 bg-white"
              />
              <div className="flex flex-col">
                <span className="text-[22px] md:text-[28px] font-bold text-[var(--foreground)] leading-tight tracking-tight line-clamp-1">
                  {holderDisplayName}
                </span>
                <span className="text-[15px] text-[var(--secondary)] font-medium mt-0.5">@{holderUsername}</span>
              </div>
            </div>
            
            {/* MIDDLE: Claim & Meta */}
            <div className="flex-1 flex flex-col justify-center w-full min-w-0 md:px-4">
              <div className="text-[16px] md:text-[18px] text-[var(--foreground)] font-medium leading-snug">
                {holderMessage}
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-3 text-[13px] text-[var(--secondary)] font-medium tabular-nums">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> Held #1 for {isInitialState ? '0s' : reignTime}
                </span>
                {!isInitialState && currentHolder?.website_url && (
                  <>
                    <span className="text-[var(--muted)]">•</span>
                    <a
                      href={currentHolder.website_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[var(--accent)] hover:underline truncate max-w-[200px]"
                    >
                      {currentHolder.website_url.replace(/^https?:\/\//, '')}
                    </a>
                  </>
                )}
              </div>
            </div>

            {/* RIGHT: Price & CTA */}
            <div className="flex flex-col items-start md:items-end flex-shrink-0 w-full md:w-[180px]">
              <span className="text-[12px] font-bold text-[var(--muted)] uppercase tracking-wider mb-1">
                CURRENT PRICE
              </span>
              <span className="text-[32px] md:text-[38px] font-bold text-[var(--foreground)] tabular-nums tracking-tight leading-none mb-1">
                ${currentPrice.toFixed(2)}
              </span>
              <span className="text-[13px] font-medium text-[var(--secondary)] mb-4 md:mb-5">
                to replace
              </span>
              <button 
                onClick={triggerCheckout}
                className="w-full bg-[var(--accent)] text-white px-5 py-3 md:py-2.5 rounded-[12px] font-semibold text-[15px] hover:opacity-90 transition-all active:scale-[0.98]"
              >
                Replace #1
              </button>
            </div>
          </div>
        </section>

        {/* MAIN GRID: RECENT & ACTIVITY */}
        <section className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(280px,0.8fr)] gap-10 lg:gap-16 items-start">
          
          {/* RECENT REPLACEMENTS */}
          <div className="w-full">
            <h3 className="text-[24px] md:text-[28px] font-bold text-[var(--foreground)] tracking-tight mb-5">Recent Replacements</h3>
            
            <div className="space-y-3">
              {recentReplacements.map((rep, idx) => (
                <div 
                  key={rep.id} 
                  className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-[var(--surface)] border border-[var(--border)] rounded-[16px] hover:border-[var(--muted)] transition-colors gap-4"
                >
                  <div className="flex items-center gap-4 w-full sm:w-auto flex-shrink-0">
                    <span className="text-[15px] font-bold text-[var(--muted)] w-8 text-center tabular-nums">
                      #{idx + 2}
                    </span>
                    <img 
                      src={rep.new_user?.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=fallback'}
                      alt={rep.new_user?.username || 'user'}
                      className="w-10 h-10 rounded-full border border-[var(--border)] object-cover bg-white"
                    />
                    <div className="flex flex-col">
                      <span className="text-[15px] font-bold text-[var(--foreground)] leading-tight">
                        {rep.new_user?.display_name || rep.new_user?.username || 'Anonymous'}
                      </span>
                      <span className="text-[13px] text-[var(--secondary)] font-medium">@{rep.new_user?.username || 'anon'}</span>
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col justify-center sm:px-4 w-full sm:w-auto pl-14 sm:pl-0 min-w-0">
                    <span className="text-[14px] text-[var(--foreground)] font-medium truncate">
                      replaced @{rep.previous_user?.username || 'someone'}
                    </span>
                    <span className="text-[12px] text-[var(--muted)] font-medium mt-0.5">
                      {timeAgo(rep.created_at)}
                    </span>
                  </div>

                  <div className="flex items-center sm:justify-end flex-shrink-0 pl-14 sm:pl-0">
                    <span className="text-[16px] md:text-[18px] font-bold text-[var(--foreground)] tabular-nums">
                      ${Number(rep.amount_paid).toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}

              {recentReplacements.length === 0 && (
                <div className="flex flex-col items-center justify-center h-[180px] md:h-[200px] text-center bg-[var(--surface)] border border-[var(--border)] rounded-[16px] px-6">
                  <h4 className="text-[16px] font-bold text-[var(--foreground)] mb-1">No replacements yet.</h4>
                  <p className="text-[14px] text-[var(--secondary)] font-medium max-w-sm">
                    The first person to replace #1 will appear here.
                  </p>
                  <p className="text-[13px] text-[var(--muted)] font-medium mt-3">History starts with the first replacement.</p>
                </div>
              )}
            </div>
            
            {recentReplacements.length > 0 && (
              <div className="pt-5 flex justify-center">
                <button onClick={() => router.push('/history')} className="text-[14px] font-semibold text-[var(--secondary)] hover:text-[var(--foreground)] transition-colors">
                  View full history →
                </button>
              </div>
            )}
          </div>

          {/* SIDEBAR: Live Activity */}
          <div className="w-full lg:pt-1">
            <h3 className="text-[14px] font-bold text-[var(--muted)] uppercase tracking-[0.05em] mb-6">Live Activity</h3>
            
            {recentReplacements.length > 0 ? (
              <div className="space-y-4 border-l border-[var(--border)] pl-4">
                {recentReplacements.slice(0, 6).map(rep => (
                  <div key={rep.id} className="relative text-[13px] text-[var(--secondary)] font-medium leading-relaxed">
                    <div className="absolute -left-[21px] top-2 w-2 h-2 rounded-full bg-[var(--border)]" />
                    <p>
                      <span className="font-semibold text-[var(--foreground)]">@{rep.new_user?.username}</span> replaced <span className="font-semibold text-[var(--foreground)]">@{rep.previous_user?.username}</span> for <span className="tabular-nums">${Number(rep.amount_paid).toFixed(0)}</span> <span className="text-[var(--muted)] block mt-0.5">{timeAgo(rep.created_at)}</span>
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-[var(--surface)] border border-[var(--border)] rounded-full mb-2 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)] animate-pulse" />
                  <span className="text-[11px] font-bold text-[var(--secondary)] uppercase tracking-widest">Listening</span>
                </div>
                <h4 className="text-[15px] font-bold text-[var(--foreground)]">Waiting for the first battle.</h4>
                <p className="text-[13px] text-[var(--secondary)] font-medium leading-relaxed">
                  The next replacement will appear here in real time.
                </p>
              </div>
            )}
          </div>

        </section>

        {/* STATS STRIP */}
        <section className="w-full max-w-5xl py-12 border-t border-[var(--border)] mt-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center md:text-left">
            <div>
              <div className="text-[28px] md:text-[32px] font-bold text-[var(--foreground)] tabular-nums">
                {replacementsCount.toLocaleString()}
              </div>
              <div className="text-[12px] font-bold text-[var(--muted)] uppercase tracking-wider mt-1">
                Replacements
              </div>
            </div>
            <div>
              <div className="text-[28px] md:text-[32px] font-bold text-[var(--foreground)] tabular-nums">
                ${(replacementsCount > 0 ? (recentReplacements.reduce((acc, curr) => acc + Number(curr.amount_paid), 0) + 100) : 0).toFixed(0)}
              </div>
              <div className="text-[12px] font-bold text-[var(--muted)] uppercase tracking-wider mt-1">
                Total Spent
              </div>
            </div>
            <div>
              <div className="text-[28px] md:text-[32px] font-bold text-[var(--foreground)] tabular-nums">
                {isInitialState ? '0s' : '4h 21m'}
              </div>
              <div className="text-[12px] font-bold text-[var(--muted)] uppercase tracking-wider mt-1">
                Longest Reign
              </div>
            </div>
            <div>
              <div className="text-[28px] md:text-[32px] font-bold text-[var(--foreground)] tabular-nums flex justify-center md:justify-start items-center gap-2.5">
                 <span className="h-2.5 w-2.5 rounded-full bg-[var(--success)] animate-pulse" />
                 248
              </div>
              <div className="text-[12px] font-bold text-[var(--muted)] uppercase tracking-wider mt-1">
                Online Now
              </div>
            </div>
          </div>
        </section>

      </main>

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
        <div className="text-[15px] font-semibold animate-pulse text-[var(--secondary)]">Loading ReplaceMe...</div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  )
}
