'use client'

import { Suspense, useEffect, useState, FormEvent, useCallback } from 'react'
import { Header } from '@/components/Header'
import { CheckoutModal } from '@/components/CheckoutModal'
import { createClient } from '@/utils/supabase/client'
import { useSearchParams, useRouter } from 'next/navigation'
import { Clock, Globe } from 'lucide-react'
import { getClientId } from '@/utils/analytics'

// --- TYPES ---

interface HeroSectionProps {
  currentPrice: number
  quickWebsiteUrl: string
  setQuickWebsiteUrl: (val: string) => void
  quickMessage: string
  setQuickMessage: (val: string) => void
  triggerCheckout: (e?: FormEvent) => void
  quickError: string
}

interface CurrentHolderCardProps {
  currentHolder: any
  holderWebsiteUrl: string
  holderWebsiteName: string
  holderWebsiteLogo: string
  holderMessage: string
  reignTime: string
  currentPrice: number
  triggerCheckout: (e?: FormEvent) => void
  viewsCount: number
  clicksCount: number
  liveViewers: number
  activeReignId: string
}
// --- HELPER COMPONENTS ---

const formatDuration = (sec: number) => {
  if (!sec) return '0s'
  const diffSec = Math.floor(sec)
  const hours = Math.floor(diffSec / 3600)
  const minutes = Math.floor((diffSec % 3600) / 60)
  const seconds = diffSec % 60

  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
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

// --- SUB-COMPONENTS ---

function HeroSection({ currentPrice, quickWebsiteUrl, setQuickWebsiteUrl, quickMessage, setQuickMessage, triggerCheckout, quickError }: HeroSectionProps) {
  return (
    <section className="text-center w-full max-w-3xl flex flex-col items-center mb-16 md:mb-20">
      <div className="text-[11px] md:text-[12px] font-bold text-[var(--muted)] uppercase tracking-[0.1em] mb-4 md:mb-5">
        The Internet&apos;s #1 Spot
      </div>
      <h1 className="text-[44px] md:text-[64px] font-bold tracking-tight text-[var(--foreground)] leading-[1.05] mb-4">
        Replace whoever&apos;s #1.
      </h1>
      <p className="text-[18px] md:text-[22px] text-[var(--secondary)] font-medium max-w-lg mb-8 md:mb-10">
        No followers. No permission. No algorithm.
      </p>

      <h2 className="text-[32px] md:text-[40px] font-bold text-[var(--foreground)] tracking-tight tabular-nums mb-6">
        Replace #1 for <span className="text-[var(--accent)]">${currentPrice.toFixed(2)}</span>
      </h2>

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
          Replace #1
        </button>
      </form>
      
      {quickError && (
        <div className="text-red-500 font-bold text-[13px] mb-3 animate-in fade-in zoom-in-95">
          {quickError}
        </div>
      )}
      
      <div className="flex flex-wrap justify-center gap-2.5 mb-8 max-w-2xl w-full px-2">
        {['Built different.', 'Watch me take #1.', 'Someone has to replace me.', 'Try to replace me.', 'Your move.'].map(ex => (
          <button 
            key={ex}
            type="button"
            onClick={() => setQuickMessage(ex)}
            className="text-[13px] font-medium text-[var(--secondary)] hover:text-[var(--foreground)] bg-[var(--surface-elevated)] border border-[var(--border-soft)] px-3.5 py-1.5 rounded-full transition-colors active:scale-95"
          >
            {ex}
          </button>
        ))}
      </div>
      
      <p className="text-[14px] text-[var(--secondary)] font-medium">
        Take the spot. Hold it until someone replaces you.
      </p>
    </section>
  )
}

function HowItWorks() {
  return (
    <section className="w-full max-w-5xl mb-20 md:mb-24 px-4 md:px-0">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
        <div className="text-center md:text-left">
          <div className="text-[13px] font-bold text-[var(--muted)] uppercase tracking-wider mb-2">1. Replace</div>
          <p className="text-[16px] text-[var(--foreground)] font-medium">Pay the current price and take #1.</p>
        </div>
        <div className="text-center md:text-left">
          <div className="text-[13px] font-bold text-[var(--muted)] uppercase tracking-wider mb-2">2. Hold</div>
          <p className="text-[16px] text-[var(--foreground)] font-medium">You&apos;re now #1. Show whatever you want.</p>
        </div>
        <div className="text-center md:text-left">
          <div className="text-[13px] font-bold text-[var(--muted)] uppercase tracking-wider mb-2">3. Get Replaced</div>
          <p className="text-[16px] text-[var(--foreground)] font-medium">Someone else pays more and takes your spot.</p>
        </div>
      </div>
    </section>
  )
}

function CurrentHolderCard({ currentHolder, holderWebsiteUrl, holderWebsiteName, holderWebsiteLogo, holderMessage, reignTime, currentPrice, triggerCheckout, viewsCount, clicksCount, liveViewers, activeReignId }: CurrentHolderCardProps) {
  return (
    <section className="w-full max-w-5xl mb-16 md:mb-20">
      <h3 className="text-[12px] md:text-[14px] font-bold text-[var(--muted)] uppercase tracking-[0.05em] mb-4 pl-1">CURRENT #1</h3>
      
      <div className="w-full bg-[var(--surface-featured)] border border-[var(--border-featured)] rounded-[16px] p-5 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 md:gap-8 transition-all min-h-[180px] shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
        
        {/* LEFT: Rank & Identity */}
        <div className="flex items-center gap-4 w-full md:w-auto md:min-w-[260px] flex-shrink-0">
          <span className="text-[20px] md:text-[24px] font-bold text-[var(--accent)] w-8 text-center shrink-0">#1</span>
          
          {holderWebsiteLogo ? (
            <img
              src={holderWebsiteLogo}
              alt={holderWebsiteName}
              className="w-16 h-16 md:w-[88px] md:h-[88px] rounded-[16px] object-contain border border-[var(--border)] shrink-0 bg-[var(--surface)]"
            />
          ) : (
            <div className="w-16 h-16 md:w-[88px] md:h-[88px] rounded-[16px] border border-[var(--border)] shrink-0 bg-[var(--surface)] flex items-center justify-center text-gray-400 font-bold">
              URL
            </div>
          )}

          <div className="flex flex-col min-w-0">
            <span className="text-[22px] md:text-[26px] font-bold text-[var(--foreground)] leading-tight tracking-tight truncate max-w-[200px] md:max-w-[240px]">
              {holderWebsiteName}
            </span>
            <span className="text-[14px] md:text-[15px] text-[var(--secondary)] font-medium mt-0.5 truncate max-w-[200px] md:max-w-[240px]">
              {holderWebsiteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}
            </span>
          </div>
        </div>
        
        {/* MIDDLE: Claim & Meta */}
        <div className="flex-1 flex flex-col justify-center w-full min-w-0 md:px-4 py-2 md:py-0">
          {holderMessage && (
            <div className="text-[16px] md:text-[18px] text-[var(--foreground)] font-medium leading-snug line-clamp-3 md:line-clamp-2 break-words">
              &quot;{holderMessage}&quot;
            </div>
          )}
          
          <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-4 text-[13px] md:text-[14px] text-[var(--secondary)] font-medium tabular-nums">
            <a
              href={`/api/click/${activeReignId}?client_id=${typeof window !== 'undefined' ? getClientId() : ''}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-[var(--accent)] font-semibold hover:opacity-80 transition-opacity truncate max-w-full sm:max-w-[200px]"
            >
              <Globe className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{holderWebsiteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}</span>
            </a>
            
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 shrink-0" /> 
              Held #1 for {reignTime}
            </span>

            <span className="flex items-center gap-1.5 whitespace-nowrap text-[var(--muted)]">
              👁 {viewsCount.toLocaleString()} views · 🔥 {clicksCount.toLocaleString()} clicks · <span className="text-[var(--success)] ml-1 mr-0.5 h-1.5 w-1.5 rounded-full inline-block animate-pulse bg-current" /> {liveViewers} live
            </span>
          </div>
        </div>

        {/* RIGHT: Price & CTA */}
        <div className="flex flex-col items-start md:items-end flex-shrink-0 w-full md:w-[180px] pt-4 md:pt-0 border-t md:border-t-0 border-[var(--border)]">
          <span className="text-[11px] md:text-[12px] font-bold text-[var(--muted)] uppercase tracking-wider mb-1 pt-2 md:pt-0">
            CURRENT PRICE
          </span>
          <span className="text-[36px] md:text-[42px] font-bold text-[var(--foreground)] tabular-nums tracking-tight leading-none mb-4 md:mb-5">
            ${currentPrice.toFixed(2)}
          </span>
          <button 
            onClick={triggerCheckout}
            className="w-full bg-[var(--accent)] text-white px-5 py-3 rounded-[12px] font-bold text-[15px] hover:opacity-90 transition-all active:scale-[0.98] uppercase"
          >
            REPLACE #1
          </button>
        </div>
      </div>
    </section>
  )
}

function PageSkeleton() {
  return (
    <div className="flex-1 flex flex-col items-center pt-12 md:pt-16 pb-24 px-4 md:px-6 lg:px-8 max-w-[1240px] mx-auto w-full animate-pulse">
      {/* Hero Skeleton */}
      <div className="w-48 h-3 bg-[var(--border)] rounded mb-4" />
      <div className="w-64 h-12 bg-[var(--border)] rounded mb-3" />
      <div className="w-32 h-10 bg-[var(--border)] rounded mb-8" />
      <div className="w-full max-w-3xl h-16 bg-[var(--border)] rounded-[16px] mb-12" />
      
      {/* Current #1 Skeleton */}
      <div className="w-full max-w-5xl h-[180px] bg-[var(--border)] rounded-[16px] mb-14" />
    </div>
  )
}

// --- MAIN PAGE CONTENT ---

function HomeContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  // State
  const [currentHolder, setCurrentHolder] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [reignTime, setReignTime] = useState('0s')

  // Quick form state
  const [quickWebsiteUrl, setQuickWebsiteUrl] = useState('')
  const [quickMessage, setQuickMessage] = useState('')
  const [quickError, setQuickError] = useState('')

  const fetchGameState = useCallback(async () => {
    if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
      setCurrentHolder({
        current_price: 1.00,
        replaced_at: new Date().toISOString(),
        custom_message: 'Someone has to be first. Replace me to start the game.',
        website_url: 'replaceme.lol',
        website_name: 'ReplaceMe',
        website_logo: '/replaceme-avatar.svg'
      })
      setError(false)
      setLoading(false)
      return
    }

    try {
      const { data: holder, error: holderError } = await supabase
        .from('current_holder')
        .select('*')
        .maybeSingle()

      if (holderError) throw holderError

      let viewsCount = 0
      let clicksCount = 0

      if (holder?.active_reign_id) {
        const { data: reignData, error: reignError } = await supabase
          .from('replacements')
          .select('views_count, clicks_count')
          .eq('id', holder.active_reign_id)
          .single()

        if (!reignError && reignData) {
          viewsCount = reignData.views_count
          clicksCount = reignData.clicks_count
        }
      }

      setCurrentHolder({ ...holder, views_count: viewsCount, clicks_count: clicksCount })

      setError(false)
    } catch (err: any) {
      if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
        console.log('Falling back to local demo state for UI development...')
        setCurrentHolder({
          current_price: 1.00,
          replaced_at: new Date().toISOString(),
          custom_message: 'Someone has to be first. Replace me to start the game.',
          website_url: 'replaceme.lol',
          website_name: 'ReplaceMe',
          website_logo: '/replaceme-avatar.svg'
        })
        setError(false)
      } else {
        setError(true)
      }
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    fetchGameState()

    const holderChannel = supabase
      .channel('current-holder-changes')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'current_holder' }, () => {
        setTimeout(fetchGameState, 0)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(holderChannel)
    }
  }, [fetchGameState, supabase])

  useEffect(() => {
    if (!currentHolder || !currentHolder.replaced_at) return

    const calculateReignTime = () => {
      const replacedDate = new Date(currentHolder.replaced_at).getTime()
      const now = new Date().getTime()
      const diffMs = Math.max(0, now - replacedDate)
      setReignTime(formatDuration(diffMs / 1000))
    }

    calculateReignTime()
    const timer = setInterval(calculateReignTime, 1000)
    return () => clearInterval(timer)
  }, [currentHolder])

  const [liveViewers, setLiveViewers] = useState(0)

  useEffect(() => {
    if (!currentHolder) return

    const trackViewAndPresence = async () => {
      const clientId = getClientId()
      const reignId = currentHolder.active_reign_id || 'genesis'
      // track view
      await fetch(`/api/view/${reignId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId })
      }).catch(console.error)

      // presence heartbeat
      const ping = async () => {
        try {
          const res = await fetch('/api/presence', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clientId, reignId })
          })
          const data = await res.json()
          if (data.liveViewers) {
            setLiveViewers(data.liveViewers)
          }
        } catch (e) {
          console.error(e)
        }
      }
      
      ping()
      const interval = setInterval(ping, 30000)
      return () => clearInterval(interval)
    }

    const cleanup = trackViewAndPresence()
    return () => {
      cleanup.then(fn => fn && fn())
    }
  }, [currentHolder?.active_reign_id])

  useEffect(() => {
    if (searchParams.get('checkout') === 'true') {
      setTimeout(() => setCheckoutOpen(true), 0)
      router.replace('/')
    }
  }, [searchParams, router])

  const triggerCheckout = (e?: FormEvent) => {
    if (e) e.preventDefault()
    
    // Clear any previous error
    setQuickError('')
    
    // Manual Validation
    if (!quickWebsiteUrl) {
      setQuickError('Please enter a website URL.')
      return
    }
    
    // Loose URL format validation
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
        <h2 className="text-[20px] font-bold text-[var(--foreground)] mb-2">We couldn&apos;t load the live board.</h2>
        <p className="text-[15px] text-[var(--secondary)] mb-6">There was an issue connecting to the database.</p>
        <button onClick={fetchGameState} className="bg-[var(--surface)] border border-[var(--border)] px-6 py-2 rounded-[10px] font-semibold text-[14px] hover:bg-[var(--border)] transition-colors">
          Refresh Page
        </button>
      </div>
    )
  }

  const currentPrice = currentHolder ? Number(currentHolder.current_price) : 1.0;
  
  const holderWebsiteUrl = currentHolder?.website_url || 'replaceme.lol';
  const holderWebsiteName = currentHolder?.website_name || 'ReplaceMe';
  const holderWebsiteLogo = currentHolder?.website_logo || '/replaceme-avatar.svg';
  const holderMessage = currentHolder?.custom_message || 'I am the reigning #1.';

  return (
    <>
      <Header />

      <main className="flex-1 flex flex-col items-center pt-8 md:pt-10 pb-24 px-4 md:px-6 lg:px-8 max-w-[1240px] mx-auto w-full">
        
        <HeroSection 
          currentPrice={currentPrice}
          quickWebsiteUrl={quickWebsiteUrl}
          setQuickWebsiteUrl={(val) => { setQuickWebsiteUrl(val); setQuickError(''); }}
          quickMessage={quickMessage}
          setQuickMessage={(val) => { setQuickMessage(val); setQuickError(''); }}
          triggerCheckout={triggerCheckout}
          quickError={quickError}
        />

        <HowItWorks />

        <CurrentHolderCard 
          currentHolder={currentHolder}
          holderWebsiteUrl={holderWebsiteUrl}
          holderWebsiteName={holderWebsiteName}
          holderWebsiteLogo={holderWebsiteLogo}
          holderMessage={holderMessage}
          reignTime={reignTime}
          currentPrice={currentPrice}
          triggerCheckout={triggerCheckout}
          viewsCount={currentHolder?.views_count || 0}
          clicksCount={currentHolder?.clicks_count || 0}
          liveViewers={liveViewers}
          activeReignId={currentHolder?.active_reign_id || 'genesis'}
        />

        <div className="pt-8 w-full flex justify-center">
          <p className="text-[13px] text-[var(--muted)] font-medium">
            Built by <a href="https://x.com/beswinjoee" target="_blank" rel="noreferrer" className="hover:text-[var(--foreground)] transition-colors">@beswinjoee</a>
          </p>
        </div>

      </main>

      <CheckoutModal
        isOpen={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        currentPrice={currentPrice}
        currentWebsite={holderWebsiteName}
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
