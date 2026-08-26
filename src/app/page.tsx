'use client'

import { Suspense, useEffect, useState, FormEvent, useCallback } from 'react'
import { Header } from '@/components/Header'
import { CheckoutModal } from '@/components/CheckoutModal'
import { createClient } from '@/utils/supabase/client'
import { useSearchParams, useRouter } from 'next/navigation'
import { Clock, Globe } from 'lucide-react'
import { getClientId } from '@/utils/analytics'

// --- HELPER COMPONENTS ---

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

function HeroSection({
  quickWebsiteUrl,
  setQuickWebsiteUrl,
  quickMessage,
  setQuickMessage,
  triggerCheckout,
  quickError
}: any) {
  return (
    <section className="text-center w-full max-w-3xl flex flex-col items-center mb-12 md:mb-16">
      <div className="text-[11px] md:text-[12px] font-bold text-[var(--muted)] uppercase tracking-[0.1em] mb-4 md:mb-5">
        The Open Leaderboard
      </div>
      <h1 className="text-[44px] md:text-[64px] font-bold tracking-tight text-[var(--foreground)] leading-[1.05] mb-4">
        Join the ranking.
      </h1>
      <p className="text-[18px] md:text-[22px] text-[var(--secondary)] font-medium max-w-lg mb-8 md:mb-10">
        Bid any amount. Highest bid takes #1.
      </p>

      <form 
        onSubmit={triggerCheckout}
        noValidate
        className="w-full max-w-2xl bg-[var(--surface)] border border-[var(--border)] rounded-[16px] p-1.5 flex flex-col md:flex-row gap-1.5 shadow-sm focus-within:border-[var(--accent)] transition-all mb-3 relative"
      >
        <input 
          type="url" 
          placeholder="https://yourwebsite.com" 
          value={quickWebsiteUrl}
          onChange={(e) => setQuickWebsiteUrl(e.target.value)}
          className="flex-[1.5] bg-transparent px-4 py-3 outline-none text-[15px] placeholder-[var(--muted)] font-medium"
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
          className="bg-[var(--accent)] text-white px-8 py-3 rounded-[12px] text-[15px] font-bold tracking-wide hover:opacity-90 transition-all active:scale-[0.98] mt-1.5 md:mt-0 uppercase shrink-0"
        >
          JOIN NOW
        </button>
      </form>
      
      {quickError && (
        <div className="text-red-500 font-bold text-[13px] mb-3 animate-in fade-in zoom-in-95">
          {quickError}
        </div>
      )}
      
      <p className="text-[14px] text-[var(--secondary)] font-medium mt-4">
        No minimums. No maximums. Claim your spot.
      </p>
    </section>
  )
}

function LeaderboardItem({ participant, rank, liveViewers }: { participant: any, rank: number, liveViewers: number }) {
  const isNumberOne = rank === 1;
  return (
    <div className={`w-full bg-[var(--surface-featured)] border ${isNumberOne ? 'border-[var(--accent)] shadow-md' : 'border-[var(--border-featured)] shadow-sm'} rounded-[16px] p-5 md:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 transition-all mb-4`}>
      {/* LEFT: Rank & Identity */}
      <div className="flex items-center gap-4 w-full md:w-auto md:min-w-[260px] flex-shrink-0">
        <div className="flex flex-col items-center justify-center w-10 shrink-0">
          <span className={`text-[20px] md:text-[24px] font-bold ${isNumberOne ? 'text-[var(--accent)]' : 'text-[var(--muted)]'}`}>
            #{rank}
          </span>
          {isNumberOne && <span className="text-xl leading-none mt-1">👑</span>}
        </div>
        
        {participant.new_website_logo ? (
          <img
            src={participant.new_website_logo}
            alt={participant.new_website_name}
            className="w-14 h-14 md:w-[72px] md:h-[72px] rounded-[16px] object-contain border border-[var(--border)] shrink-0 bg-[var(--surface)]"
          />
        ) : (
          <div className="w-14 h-14 md:w-[72px] md:h-[72px] rounded-[16px] border border-[var(--border)] shrink-0 bg-[var(--surface)] flex items-center justify-center text-gray-400 font-bold text-xs">
            URL
          </div>
        )}

        <div className="flex flex-col min-w-0">
          <span className="text-[18px] md:text-[20px] font-bold text-[var(--foreground)] leading-tight tracking-tight truncate max-w-[180px] md:max-w-[220px]">
            {participant.new_website_name}
          </span>
          <span className="text-[13px] md:text-[14px] text-[var(--secondary)] font-medium mt-0.5 truncate max-w-[180px] md:max-w-[220px]">
            {participant.new_website_url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
          </span>
        </div>
      </div>
      
      {/* MIDDLE: Claim & Meta */}
      <div className="flex-1 flex flex-col justify-center w-full min-w-0 md:px-4 py-2 md:py-0">
        {participant.custom_message && (
          <div className="text-[15px] md:text-[16px] text-[var(--foreground)] font-medium leading-snug line-clamp-2 break-words mb-3 italic">
            &quot;{participant.custom_message}&quot;
          </div>
        )}
        
        <div className="flex flex-wrap items-center gap-3 md:gap-4 text-[12px] md:text-[13px] text-[var(--secondary)] font-medium tabular-nums">
          <a
            href={`/api/click/${participant.id}?client_id=${typeof window !== 'undefined' ? getClientId() : ''}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-[var(--accent)] font-semibold hover:opacity-80 transition-opacity truncate max-w-[160px]"
          >
            <Globe className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{participant.new_website_url.replace(/^https?:\/\//, '').replace(/\/$/, '')}</span>
          </a>

          <span className="flex items-center gap-1.5 whitespace-nowrap text-[var(--muted)]">
            👁 {(participant.views_count || 0).toLocaleString()} views
          </span>
          <span className="flex items-center gap-1.5 whitespace-nowrap text-[var(--muted)]">
            🔥 {(participant.clicks_count || 0).toLocaleString()} clicks
          </span>
          <span className="flex items-center gap-1.5 whitespace-nowrap text-[var(--muted)]">
            <span className="text-[var(--success)] h-1.5 w-1.5 rounded-full inline-block animate-pulse bg-current" /> {liveViewers} live
          </span>
          <span className="flex items-center gap-1.5 whitespace-nowrap text-[var(--muted)]">
            <Clock className="w-3.5 h-3.5 shrink-0" /> {timeAgo(participant.created_at)}
          </span>
        </div>
      </div>

      {/* RIGHT: Price */}
      <div className="flex flex-col items-start md:items-end flex-shrink-0 w-full md:w-[140px] pt-4 md:pt-0 border-t md:border-t-0 border-[var(--border)]">
        <span className="text-[10px] md:text-[11px] font-bold text-[var(--muted)] uppercase tracking-wider mb-1 pt-2 md:pt-0">
          BID AMOUNT
        </span>
        <span className="text-[28px] md:text-[32px] font-bold text-[var(--foreground)] tabular-nums tracking-tight leading-none">
          ${Number(participant.amount_paid).toFixed(2)}
        </span>
      </div>
    </div>
  )
}

function PageSkeleton() {
  return (
    <div className="flex-1 flex flex-col items-center pt-12 md:pt-16 pb-24 px-4 md:px-6 lg:px-8 max-w-[1240px] mx-auto w-full animate-pulse">
      <div className="w-48 h-3 bg-[var(--border)] rounded mb-4" />
      <div className="w-64 h-12 bg-[var(--border)] rounded mb-3" />
      <div className="w-full max-w-3xl h-16 bg-[var(--border)] rounded-[16px] mb-12" />
      <div className="w-full max-w-5xl h-[120px] bg-[var(--border)] rounded-[16px] mb-4" />
      <div className="w-full max-w-5xl h-[120px] bg-[var(--border)] rounded-[16px] mb-4" />
    </div>
  )
}

// --- MAIN PAGE CONTENT ---

function HomeContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [leaderboard, setLeaderboard] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)

  // Quick form state
  const [quickWebsiteUrl, setQuickWebsiteUrl] = useState('')
  const [quickMessage, setQuickMessage] = useState('')
  const [quickError, setQuickError] = useState('')

  const [liveViewersMap, setLiveViewersMap] = useState<Record<string, number>>({})

  const fetchGameState = useCallback(async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('replacements')
        .select('*')
        .order('amount_paid', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(100)

      if (fetchError) throw fetchError

      setLeaderboard(data || [])
      setError(false)
    } catch (err: any) {
      console.error(err)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    fetchGameState()

    const channel = supabase
      .channel('replacements-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'replacements' }, () => {
        setTimeout(fetchGameState, 0)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchGameState, supabase])

  // Track Views & Live Presence
  useEffect(() => {
    const trackPresence = async () => {
      const clientId = getClientId()
      
      // We ping presence for ALL visible reigns
      for (const p of leaderboard) {
        // Track view
        await fetch(`/api/view/${p.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId })
        }).catch(() => {})

        // Presence heartbeat
        const ping = async () => {
          try {
            const res = await fetch('/api/presence', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ clientId, reignId: p.id })
            })
            const data = await res.json()
            if (data.liveViewers !== undefined) {
              setLiveViewersMap(prev => ({ ...prev, [p.id]: data.liveViewers }))
            }
          } catch (e) {}
        }
        ping()
      }
    }

    if (leaderboard.length > 0) {
      trackPresence()
      const interval = setInterval(trackPresence, 30000)
      return () => clearInterval(interval)
    }
  }, [leaderboard])

  useEffect(() => {
    if (searchParams.get('checkout') === 'true') {
      setTimeout(() => setCheckoutOpen(true), 0)
      router.replace('/')
    }
  }, [searchParams, router])

  const triggerCheckout = (e?: FormEvent) => {
    if (e) e.preventDefault()
    setQuickError('')
    
    if (!quickWebsiteUrl) {
      setQuickError('Please enter a website URL.')
      return
    }
    
    try {
      const urlToTest = quickWebsiteUrl.startsWith('http') ? quickWebsiteUrl : `https://${quickWebsiteUrl}`
      new URL(urlToTest)
    } catch {
      setQuickError('Please enter a valid website URL.')
      return
    }
    
    if (!quickMessage) {
      setQuickError('Please enter a claim message.')
      return
    }
    
    setCheckoutOpen(true)
  }

  if (loading) {
    return <PageSkeleton />
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center pt-24 pb-24 text-center px-4">
        <h2 className="text-[20px] font-bold text-[var(--foreground)] mb-2">We couldn&apos;t load the leaderboard.</h2>
        <button onClick={fetchGameState} className="bg-[var(--surface)] border border-[var(--border)] px-6 py-2 rounded-[10px] font-semibold text-[14px] hover:bg-[var(--border)] transition-colors">
          Refresh Page
        </button>
      </div>
    )
  }

  return (
    <>
      <Header />

      <main className="flex-1 flex flex-col items-center pt-8 md:pt-10 pb-24 px-4 md:px-6 lg:px-8 max-w-[1240px] mx-auto w-full">
        
        <HeroSection 
          quickWebsiteUrl={quickWebsiteUrl}
          setQuickWebsiteUrl={(val: string) => { setQuickWebsiteUrl(val); setQuickError(''); }}
          quickMessage={quickMessage}
          setQuickMessage={(val: string) => { setQuickMessage(val); setQuickError(''); }}
          triggerCheckout={triggerCheckout}
          quickError={quickError}
        />

        <section className="w-full max-w-5xl">
          {leaderboard.length === 0 ? (
            <div className="text-center py-12 text-[var(--secondary)]">
              No bids yet. Be the first to join the leaderboard!
            </div>
          ) : (
            leaderboard.map((participant, index) => (
              <LeaderboardItem 
                key={participant.id} 
                participant={participant} 
                rank={index + 1} 
                liveViewers={liveViewersMap[participant.id] || 0}
              />
            ))
          )}
        </section>

        <div className="pt-8 w-full flex justify-center">
          <p className="text-[13px] text-[var(--muted)] font-medium">
            Built by <a href="https://x.com/beswinjoee" target="_blank" rel="noreferrer" className="hover:text-[var(--foreground)] transition-colors">@beswinjoee</a>
          </p>
        </div>

      </main>

      <CheckoutModal
        isOpen={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        leaderboard={leaderboard}
        prefilledData={{
          websiteUrl: quickWebsiteUrl,
          message: quickMessage
        }}
      />
    </>
  )
}

export default function Home() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <HomeContent />
    </Suspense>
  )
}
