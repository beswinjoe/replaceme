'use client'

import { Suspense, useEffect, useState, FormEvent, useCallback, useRef } from 'react'
import { Header } from '@/components/Header'
import { CheckoutModal } from '@/components/CheckoutModal'
import { createClient } from '@/utils/supabase/client'
import { useSearchParams, useRouter } from 'next/navigation'
import { Clock, Globe, ArrowRight } from 'lucide-react'
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
  quickBidAmount,
  setQuickBidAmount,
  triggerCheckout,
  quickError,
  leaderboard
}: any) {
  // Estimate rank dynamically
  const estimatedRank = (() => {
    const amount = Number(quickBidAmount)
    if (isNaN(amount) || amount <= 0) return null
    let rank = 1
    for (const participant of leaderboard) {
      if (Number(participant.amount_paid) >= amount) {
        rank++
      }
    }
    return rank
  })()

  return (
    <section className="w-full max-w-4xl flex flex-col items-center mt-6 md:mt-10 mb-12 md:mb-16">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
        <span className="text-xs font-bold text-[var(--muted)] uppercase tracking-widest">
          The Open Leaderboard
        </span>
      </div>
      
      <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-[var(--foreground)] mb-3">
        Join the ranking.
      </h1>
      <p className="text-base md:text-lg text-[var(--secondary)] font-medium max-w-lg text-center mb-8">
        Bid any amount. Higher bids rank higher. No limits.
      </p>

      <form 
        onSubmit={triggerCheckout}
        noValidate
        className="w-full bg-[var(--surface-elevated)] border border-[var(--border-soft)] rounded-2xl p-2 flex flex-col md:flex-row gap-2 shadow-sm focus-within:border-[var(--border)] transition-colors relative"
      >
        <div className="flex-1 flex items-center bg-[var(--surface)] border border-[var(--border-soft)] rounded-xl px-4 py-2.5">
          <Globe className="w-4 h-4 text-gray-400 mr-2 shrink-0" />
          <input 
            type="url" 
            placeholder="https://yourwebsite.com" 
            value={quickWebsiteUrl}
            onChange={(e) => setQuickWebsiteUrl(e.target.value)}
            className="w-full bg-transparent outline-none text-sm text-[var(--foreground)] placeholder-gray-400 font-medium"
          />
        </div>

        <div className="flex-[1.5] flex items-center bg-[var(--surface)] border border-[var(--border-soft)] rounded-xl px-4 py-2.5">
          <input 
            type="text" 
            placeholder="Your claim (optional)" 
            value={quickMessage}
            onChange={(e) => setQuickMessage(e.target.value)}
            className="w-full bg-transparent outline-none text-sm text-[var(--foreground)] placeholder-gray-400 font-medium"
            maxLength={100}
          />
        </div>

        <div className="w-full md:w-32 flex items-center bg-[var(--surface)] border border-[var(--border-soft)] rounded-xl px-4 py-2.5 relative">
          <span className="text-gray-400 font-medium mr-1">$</span>
          <input 
            type="number" 
            min="1.00"
            step="1.00"
            placeholder="5.00" 
            value={quickBidAmount}
            onChange={(e) => setQuickBidAmount(e.target.value)}
            className="w-full bg-transparent outline-none text-sm font-bold text-[var(--foreground)] placeholder-gray-400"
          />
        </div>

        <button 
          type="submit"
          className="bg-[var(--foreground)] text-[var(--background)] px-6 py-2.5 rounded-xl text-sm font-bold tracking-wide hover:opacity-90 transition-opacity whitespace-nowrap flex items-center justify-center gap-2"
        >
          Outbid <ArrowRight className="w-4 h-4" />
        </button>
      </form>
      
      <div className="mt-3 flex flex-col items-center justify-center min-h-[24px]">
        {quickError ? (
          <div className="text-red-500 font-semibold text-xs animate-in fade-in zoom-in-95">
            {quickError}
          </div>
        ) : estimatedRank ? (
          <div className="text-[var(--secondary)] text-sm font-medium animate-in fade-in">
            This would place you at <strong className="text-[var(--foreground)]">#{estimatedRank}</strong>
          </div>
        ) : (
          <div className="text-transparent text-sm">Spacer</div>
        )}
      </div>
    </section>
  )
}

function LeaderboardItem({ participant, rank, liveViewers }: { participant: any, rank: number, liveViewers: number }) {
  const isTopThree = rank <= 3;
  const isNumberOne = rank === 1;
  
  return (
    <div className={`group flex items-center justify-between p-4 sm:p-5 border-b border-[var(--border-soft)] bg-[var(--surface)] hover:bg-[var(--surface-elevated)] transition-colors ${isNumberOne ? 'bg-[var(--surface-featured)]' : ''}`}>
      
      <div className="flex items-center gap-4 sm:gap-6 min-w-0">
        <div className="flex flex-col items-center justify-center w-8 sm:w-10 shrink-0">
          <span className={`text-lg sm:text-xl font-bold ${isNumberOne ? 'text-[var(--accent)]' : 'text-[var(--muted)]'}`}>
            #{rank}
          </span>
        </div>
        
        {participant.new_website_logo ? (
          <img
            src={participant.new_website_logo}
            alt={participant.new_website_name}
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg object-contain border border-[var(--border-soft)] shrink-0 bg-white dark:bg-black"
          />
        ) : (
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg border border-[var(--border-soft)] shrink-0 bg-gray-50 dark:bg-gray-900 flex items-center justify-center text-gray-400 font-bold text-[10px]">
            URL
          </div>
        )}

        <div className="flex flex-col min-w-0">
          <div className="flex items-baseline gap-2 truncate">
            <span className="text-base sm:text-lg font-bold text-[var(--foreground)] truncate">
              {participant.new_website_name}
            </span>
            <span className="hidden sm:inline text-xs text-[var(--secondary)] truncate">
              {participant.new_website_url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
            </span>
          </div>
          
          <div className="flex items-center gap-2 mt-0.5 sm:mt-1 truncate">
            {participant.custom_message ? (
              <span className="text-sm text-[var(--foreground)] font-medium truncate max-w-[200px] sm:max-w-md">
                {participant.custom_message}
              </span>
            ) : (
              <a
                href={`/api/click/${participant.id}?client_id=${typeof window !== 'undefined' ? getClientId() : ''}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-[var(--accent)] hover:underline truncate"
              >
                {participant.new_website_url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
              </a>
            )}
          </div>

          {/* Real Metrics Row */}
          <div className="flex items-center gap-3 mt-1.5 text-[11px] text-[var(--muted)] font-medium">
             <span>{timeAgo(participant.created_at)}</span>
             
             {participant.views_count > 0 && (
               <span className="flex items-center gap-1"><span className="w-1 h-1 bg-current rounded-full opacity-50" /> {participant.views_count.toLocaleString()} views</span>
             )}
             
             {participant.clicks_count > 0 && (
               <span className="flex items-center gap-1"><span className="w-1 h-1 bg-current rounded-full opacity-50" /> {participant.clicks_count.toLocaleString()} clicks</span>
             )}
             
             {liveViewers > 0 && (
               <span className="flex items-center gap-1 text-[var(--success)]"><span className="w-1.5 h-1.5 bg-current rounded-full animate-pulse" /> {liveViewers} live</span>
             )}
          </div>
        </div>
      </div>
      
      <div className="flex flex-col items-end shrink-0 pl-4">
        <span className={`text-xl sm:text-2xl font-bold tabular-nums tracking-tight ${isTopThree ? 'text-[var(--accent)]' : 'text-[var(--foreground)]'}`}>
          ${Number(participant.amount_paid).toFixed(2)}
        </span>
      </div>
    </div>
  )
}

function PageSkeleton() {
  return (
    <div className="flex-1 flex flex-col items-center pt-12 md:pt-16 pb-24 px-4 md:px-6 lg:px-8 max-w-[1000px] mx-auto w-full animate-pulse">
      <div className="w-32 h-3 bg-[var(--border)] rounded mb-4" />
      <div className="w-64 h-12 bg-[var(--border)] rounded mb-3" />
      <div className="w-full max-w-4xl h-16 bg-[var(--border)] rounded-[16px] mb-12" />
      <div className="w-full bg-[var(--border-soft)] rounded-[16px] overflow-hidden">
         {[...Array(10)].map((_, i) => (
           <div key={i} className="h-[88px] border-b border-[var(--background)] bg-[var(--surface)]" />
         ))}
      </div>
    </div>
  )
}

// --- MAIN PAGE CONTENT ---

const PAGE_SIZE = 50;

function HomeContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [leaderboard, setLeaderboard] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  // Quick form state
  const [quickWebsiteUrl, setQuickWebsiteUrl] = useState('')
  const [quickMessage, setQuickMessage] = useState('')
  const [quickBidAmount, setQuickBidAmount] = useState('')
  const [quickError, setQuickError] = useState('')

  const [liveViewersMap, setLiveViewersMap] = useState<Record<string, number>>({})

  const fetchGameState = useCallback(async (start = 0, isLoadMore = false) => {
    try {
      if (isLoadMore) setLoadingMore(true)

      const { data, error: fetchError, count } = await supabase
        .from('replacements')
        .select('*', { count: 'exact' })
        .order('amount_paid', { ascending: false })
        .order('created_at', { ascending: true })
        .range(start, start + PAGE_SIZE - 1)

      if (fetchError) throw fetchError

      if (data) {
        if (isLoadMore) {
          setLeaderboard(prev => {
            // Filter out duplicates just in case real-time updates inserted new rows
            const existingIds = new Set(prev.map(p => p.id))
            const newRows = data.filter(d => !existingIds.has(d.id))
            return [...prev, ...newRows]
          })
        } else {
          setLeaderboard(data)
        }
        
        if (count !== null) {
          setHasMore(start + PAGE_SIZE < count)
        } else {
          setHasMore(data.length === PAGE_SIZE)
        }
      }
      setError(false)
    } catch (err: any) {
      console.error(err)
      if (!isLoadMore) setError(true)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [supabase])

  useEffect(() => {
    fetchGameState(0, false)

    // Listen for new inserts and refresh the first page so they see it instantly
    const channel = supabase
      .channel('replacements-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'replacements' }, () => {
        setTimeout(() => fetchGameState(0, false), 1000)
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
    
    const bidNum = Number(quickBidAmount)
    if (isNaN(bidNum) || bidNum < 1.00) {
      setQuickError('Minimum bid is $1.00.')
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
        <button onClick={() => fetchGameState(0, false)} className="bg-[var(--surface)] border border-[var(--border)] px-6 py-2 rounded-[10px] font-semibold text-[14px] hover:bg-[var(--border)] transition-colors">
          Refresh Page
        </button>
      </div>
    )
  }

  return (
    <>
      <Header />

      <main className="flex-1 flex flex-col items-center pt-2 pb-24 px-4 md:px-6 lg:px-8 max-w-[1000px] mx-auto w-full">
        
        <HeroSection 
          quickWebsiteUrl={quickWebsiteUrl}
          setQuickWebsiteUrl={(val: string) => { setQuickWebsiteUrl(val); setQuickError(''); }}
          quickMessage={quickMessage}
          setQuickMessage={(val: string) => { setQuickMessage(val); setQuickError(''); }}
          quickBidAmount={quickBidAmount}
          setQuickBidAmount={(val: string) => { setQuickBidAmount(val); setQuickError(''); }}
          triggerCheckout={triggerCheckout}
          quickError={quickError}
          leaderboard={leaderboard}
        />

        <section className="w-full">
          {leaderboard.length === 0 ? (
            <div className="text-center py-20 text-[var(--secondary)] border border-[var(--border-soft)] rounded-2xl bg-[var(--surface)]">
              The board is empty. Be the first to join the ranking!
            </div>
          ) : (
            <div className="bg-[var(--surface)] border border-[var(--border-soft)] rounded-2xl overflow-hidden shadow-sm">
              <div className="bg-[var(--surface-elevated)] border-b border-[var(--border-soft)] px-4 sm:px-5 py-3 flex items-center justify-between">
                <span className="text-[11px] font-bold text-[var(--muted)] uppercase tracking-wider">Rank & Claim</span>
                <span className="text-[11px] font-bold text-[var(--muted)] uppercase tracking-wider pr-2">Amount</span>
              </div>
              
              <div className="flex flex-col">
                {leaderboard.map((participant, index) => (
                  <LeaderboardItem 
                    key={participant.id} 
                    participant={participant} 
                    rank={index + 1} 
                    liveViewers={liveViewersMap[participant.id] || 0}
                  />
                ))}
              </div>
            </div>
          )}

          {hasMore && (
            <div className="mt-8 flex justify-center">
              <button
                onClick={() => fetchGameState(leaderboard.length, true)}
                disabled={loadingMore}
                className="bg-[var(--surface-elevated)] border border-[var(--border-soft)] text-[var(--foreground)] px-8 py-3 rounded-full font-bold text-sm hover:bg-[var(--border-soft)] transition-colors disabled:opacity-50"
              >
                {loadingMore ? 'Loading...' : 'Load More Rankings'}
              </button>
            </div>
          )}
        </section>

        <div className="pt-16 w-full flex justify-center">
          <p className="text-[13px] text-[var(--muted)] font-medium">
            Built by <a href="https://x.com/beswinjoee" target="_blank" rel="noreferrer" className="hover:text-[var(--foreground)] transition-colors underline underline-offset-4">@beswinjoee</a>
          </p>
        </div>

      </main>

      <CheckoutModal
        isOpen={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        leaderboard={leaderboard}
        prefilledData={{
          websiteUrl: quickWebsiteUrl,
          message: quickMessage,
          bidAmount: quickBidAmount
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
