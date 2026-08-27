'use client'

import { Suspense, useEffect, useState, useRef, FormEvent, useCallback } from 'react'
import { Header } from '@/components/Header'
import { createClient } from '@/utils/supabase/client'
import { useSearchParams, useRouter } from 'next/navigation'
import { Globe, RefreshCw } from 'lucide-react'

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
  estimatedRank,
  loadingPayment,
  loadingRank,
  websiteStatus,
}: any) {
  const bidNum = Number(quickBidAmount)
  const hasValidBid = !isNaN(bidNum) && bidNum >= 1.00

  return (
    <section className="w-full flex flex-col items-center mt-6 md:mt-10 mb-8 md:mb-12">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-2 h-2 rounded-full bg-[#e2735a]" />
        <span className="text-[10px] md:text-xs font-bold text-gray-500 uppercase tracking-widest">
          The Open Leaderboard
        </span>
      </div>
      
      <h1 className="text-3xl md:text-[40px] font-bold tracking-tight text-[#1a1a1a] mb-2 leading-tight">
        Join the ranking.
      </h1>
      <p className="text-sm md:text-base text-gray-500 font-medium mb-8">
        Bid any amount. Higher bids rank higher. Minimum $1.00.
      </p>

      <form 
        onSubmit={triggerCheckout}
        noValidate
        className="w-full max-w-4xl bg-white border border-gray-200 rounded-2xl md:rounded-full p-2 flex flex-col md:flex-row gap-2 shadow-sm focus-within:border-gray-300 transition-colors relative"
      >
        <div className="flex-[1.2] flex items-center bg-white rounded-xl md:rounded-full px-4 py-2 border border-transparent md:border-r-gray-100">
          <Globe className="w-4 h-4 text-gray-400 mr-2 shrink-0" />
          <input 
            type="url" 
            placeholder="https://yourwebsite.com" 
            value={quickWebsiteUrl}
            onChange={(e) => setQuickWebsiteUrl(e.target.value)}
            className="w-full bg-transparent outline-none text-sm text-[#1a1a1a] placeholder-gray-400 font-medium"
          />
        </div>

        <div className="flex-[1.5] flex items-center bg-white rounded-xl md:rounded-full px-4 py-2 border border-transparent md:border-r-gray-100">
          <input 
            type="text" 
            placeholder="Your claim (optional)" 
            value={quickMessage}
            onChange={(e) => setQuickMessage(e.target.value)}
            className="w-full bg-transparent outline-none text-sm text-[#1a1a1a] placeholder-gray-400 font-medium"
            maxLength={100}
          />
        </div>

        <div className="w-full md:w-32 flex items-center bg-white rounded-xl md:rounded-full px-4 py-2 relative">
          <span className="text-gray-400 font-medium mr-1">$</span>
          <input 
            type="number" 
            min="1.00"
            step="1.00"
            placeholder="1.00" 
            value={quickBidAmount}
            onChange={(e) => setQuickBidAmount(e.target.value)}
            className="w-full bg-transparent outline-none text-sm font-bold text-[#1a1a1a] placeholder-gray-400"
          />
        </div>

        <button 
          type="submit"
          disabled={loadingPayment || websiteStatus !== 'valid' || !hasValidBid}
          className="bg-[#1a1a1a] text-white px-6 py-2 rounded-xl md:rounded-full text-sm font-bold hover:opacity-90 transition-opacity whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loadingPayment ? '...' : 
           websiteStatus === 'checking' ? 'Checking...' :
           (websiteStatus === 'valid' && hasValidBid) ? `Join for $${bidNum.toFixed(2)}` : 'Join'}
        </button>
      </form>
      
      <div className="mt-3 flex flex-col items-center justify-center min-h-[50px] gap-1">
        {quickError ? (
          <div className="text-[#e2735a] font-semibold text-xs">
            {quickError}
          </div>
        ) : websiteStatus === 'valid' ? (
          <div className="text-green-600 font-semibold text-xs flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"></path></svg>
            Website verified
          </div>
        ) : (
          <div className="text-transparent text-xs select-none" aria-hidden>.</div>
        )}
        
        {estimatedRank !== null && websiteStatus === 'valid' && hasValidBid && (
          <div className="flex flex-col items-center mt-1">
            {loadingRank ? (
              <span className="text-gray-400 text-xs font-medium">Estimating rank…</span>
            ) : (
              <>
                <div className="text-sm font-bold text-[#1a1a1a]">Estimated rank: #{estimatedRank}</div>
                <div className="text-[11px] text-gray-500 mt-0.5">Final rank is confirmed after payment.</div>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

function LeaderboardItem({ participant, rank }: { participant: any, rank: number }) {
  const isNumberOne = rank === 1;
  const domain = participant.new_website_url.replace(/^https?:\/\//, '').replace(/\/$/, '')
  const initial = (participant.new_website_name || domain || '?').charAt(0).toUpperCase()
  const clickUrl = `/api/click/${participant.id}?url=${encodeURIComponent(participant.new_website_url)}`
  
  return (
    <a 
      href={clickUrl} 
      target="_blank" 
      rel="noopener noreferrer" 
      className={`group flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 sm:p-5 transition-all ${isNumberOne ? 'shadow-[0_4px_32px_rgba(226,115,90,0.15)] border-b-2 border-b-[#e2735a]/20 bg-gradient-to-r from-orange-50/50 via-white to-white relative z-10' : 'border-b border-gray-100 bg-white hover:bg-gray-50/50'}`}
    >
      
      <div className="flex items-center gap-4 sm:gap-6 min-w-0 w-full sm:w-auto mb-3 sm:mb-0">
        <div className="flex flex-col items-center justify-center w-10 shrink-0">
          <span className={`text-sm sm:text-base font-bold ${isNumberOne ? 'text-[#e2735a]' : 'text-gray-400'}`}>
            #{rank}
          </span>
          {isNumberOne && <span className="text-[10px] mt-0.5 animate-pulse">👑</span>}
        </div>
        
        {participant.new_website_logo ? (
          <img
            src={participant.new_website_logo}
            alt={participant.new_website_name}
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg object-contain border border-gray-100 shrink-0 bg-white"
          />
        ) : (
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg border border-gray-100 shrink-0 bg-gray-100 flex items-center justify-center text-gray-500 font-bold text-base select-none">
            {initial}
          </div>
        )}

        <div className="flex flex-col min-w-0">
          <div className="flex items-baseline gap-2 truncate">
            <span className="text-[15px] sm:text-[16px] font-bold text-[#1a1a1a] truncate">
              {participant.new_website_name}
            </span>
            <span className="hidden sm:inline text-xs font-medium text-gray-400 truncate">
              {domain}
            </span>
          </div>
          
          <div className="mt-0.5 truncate text-sm">
            {participant.custom_message ? (
              <span className="text-[#1a1a1a] font-medium">
                {participant.custom_message}
              </span>
            ) : (
              <span className="text-gray-400 italic">No claim</span>
            )}
          </div>

          <div className="flex items-center gap-3 mt-1 sm:mt-1.5 text-[11px] font-medium text-gray-400">
             <span>{timeAgo(participant.created_at)}</span>
             <span className="text-gray-300">•</span>
             <span className="flex items-center gap-1"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg> {participant.views_count || 0}</span>
             <span className="text-gray-300">•</span>
             <span className="flex items-center gap-1"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"></path></svg> {participant.clicks_count || 0}</span>
             <span className="sm:hidden text-gray-400 truncate">
               • {domain}
             </span>
          </div>
        </div>
      </div>
      
      <div className="flex w-full sm:w-auto items-center justify-end sm:pl-4 shrink-0">
        <span className="text-lg sm:text-xl font-bold tabular-nums tracking-tight text-[#e2735a] group-hover:text-orange-600 transition-colors">
          ${Number(participant.amount_paid).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </div>
    </a>
  )
}

function PageSkeleton() {
  return (
    <div className="flex-1 flex flex-col items-center pt-8 pb-24 px-4 md:px-6 w-full animate-pulse">
      <div className="w-full max-w-4xl h-16 bg-gray-100 rounded-full mb-12" />
      <div className="w-full max-w-4xl bg-white border border-gray-100 rounded-3xl overflow-hidden">
         {[...Array(10)].map((_, i) => (
           <div key={i} className="h-24 border-b border-gray-50 bg-white" />
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
  
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [loadingPayment, setLoadingPayment] = useState(false)

  // Quick form state
  const [quickWebsiteUrl, setQuickWebsiteUrl] = useState('')
  const [quickMessage, setQuickMessage] = useState('')
  const [quickBidAmount, setQuickBidAmount] = useState('')
  const [quickError, setQuickError] = useState('')

  // Website Validation State
  const [websiteStatus, setWebsiteStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle')
  const [websiteVerifiedUrl, setWebsiteVerifiedUrl] = useState('')
  const [websiteMetadata, setWebsiteMetadata] = useState<any>(null)
  const validationDebounceRef = useRef<NodeJS.Timeout | null>(null)

  // Server-side estimated rank
  const [estimatedRank, setEstimatedRank] = useState<number | null>(null)
  const [loadingRank, setLoadingRank] = useState(false)
  const rankDebounceRef = useRef<NodeJS.Timeout | null>(null)

  // Stats
  const [totalEarned, setTotalEarned] = useState(0)
  const [launchAgeHours, setLaunchAgeHours] = useState(0)

  // Fetch stats on mount
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/stats')
        if (res.ok) {
          const data = await res.json()
          setTotalEarned(data.totalEarned)
          setLaunchAgeHours(data.launchAgeHours)
        }
      } catch (err) {
        // silently fail stats
      }
    }
    fetchStats()
  }, [])

  // Fetch estimated rank from server when bid amount changes
  useEffect(() => {
    const amount = Number(quickBidAmount)
    if (isNaN(amount) || amount < 1 || websiteStatus !== 'valid') {
      setEstimatedRank(null)
      return
    }

    // Debounce the API call by 400ms
    if (rankDebounceRef.current) clearTimeout(rankDebounceRef.current)
    setLoadingRank(true)

    rankDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/estimated-rank?amount=${encodeURIComponent(amount)}`)
        if (res.ok) {
          const data = await res.json()
          setEstimatedRank(data.estimatedRank)
        }
      } catch {
        // silently fail, rank estimation is non-critical
      } finally {
        setLoadingRank(false)
      }
    }, 400)

    return () => {
      if (rankDebounceRef.current) clearTimeout(rankDebounceRef.current)
    }
  }, [quickBidAmount, websiteStatus])

  // Real-time Website Validation
  useEffect(() => {
    if (!quickWebsiteUrl || quickWebsiteUrl.trim() === '') {
      setWebsiteStatus('idle')
      setWebsiteVerifiedUrl('')
      setWebsiteMetadata(null)
      setQuickError('')
      if (validationDebounceRef.current) clearTimeout(validationDebounceRef.current)
      return
    }

    // Simple client-side check before firing network requests
    let urlToTest = quickWebsiteUrl
    try {
      urlToTest = quickWebsiteUrl.startsWith('http') ? quickWebsiteUrl : `https://${quickWebsiteUrl}`
      new URL(urlToTest)
    } catch {
      setWebsiteStatus('invalid')
      setQuickError('Enter a valid, reachable website')
      return
    }

    // If it's the exact same URL we already verified, don't re-check
    if (urlToTest === websiteVerifiedUrl && websiteStatus === 'valid') {
      return
    }

    setWebsiteStatus('checking')
    setQuickError('')

    if (validationDebounceRef.current) clearTimeout(validationDebounceRef.current)

    validationDebounceRef.current = setTimeout(async () => {
      try {
        const metaRes = await fetch(`/api/metadata?url=${encodeURIComponent(urlToTest)}`)
        if (metaRes.ok) {
          const metaData = await metaRes.json()
          setWebsiteMetadata(metaData)
          setWebsiteVerifiedUrl(urlToTest)
          setWebsiteStatus('valid')
        } else {
          setWebsiteStatus('invalid')
          setQuickError('Enter a valid, reachable website')
        }
      } catch (err) {
        setWebsiteStatus('invalid')
        setQuickError('Enter a valid, reachable website')
      }
    }, 800) // 800ms debounce to avoid firing while typing

    return () => {
      if (validationDebounceRef.current) clearTimeout(validationDebounceRef.current)
    }
  }, [quickWebsiteUrl])

  const viewedIdsRef = useRef<Set<string>>(new Set())

  const fetchGameState = useCallback(async (page: number, isInitial = false) => {
    try {
      if (isInitial) setLoading(true)
      const start = (page - 1) * PAGE_SIZE

      const { data, error: fetchError, count } = await supabase
        .from('replacements')
        .select('*', { count: 'exact' })
        .order('amount_paid', { ascending: false })
        .order('created_at', { ascending: true })
        .range(start, start + PAGE_SIZE - 1)

      if (fetchError) throw fetchError

      if (data) {
        setLeaderboard(data)
        if (count !== null) setTotalCount(count)
        
        const newIds = data.map(item => item.id).filter(id => !viewedIdsRef.current.has(id))
        if (newIds.length > 0) {
          newIds.forEach(id => viewedIdsRef.current.add(id))
          fetch('/api/view-batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: newIds })
          }).catch(console.error)
        }
      }
      setError(false)
    } catch (err: any) {
      console.error(err)
      if (isInitial) setError(true)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    fetchGameState(currentPage, true)

    // Listen for new inserts and refresh the current page so they see it instantly
    const channel = supabase
      .channel('replacements-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'replacements' }, () => {
        setTimeout(() => fetchGameState(currentPage, false), 1000)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentPage, fetchGameState, supabase])

  useEffect(() => {
    if (searchParams.get('checkout') === 'true') {
      router.replace('/')
    }
  }, [searchParams, router])

  const triggerCheckout = async (e?: FormEvent) => {
    if (e) e.preventDefault()
    
    if (websiteStatus !== 'valid') {
      return
    }
    
    const bidNum = Number(quickBidAmount)
    if (isNaN(bidNum) || bidNum < 1.00) {
      setQuickError('Minimum bid is $1.00.')
      return
    }

    if (!quickMessage) {
      setQuickError('Your claim message is required.')
      return
    }
    
    setLoadingPayment(true)
    setQuickError('')

    try {
      // 1. Use the already validated metadata from state
      let finalName = websiteMetadata?.websiteName
      let finalLogo = websiteMetadata?.logoUrl
      let finalSource = websiteMetadata?.logoSource
      const domain = websiteMetadata?.domain || new URL(websiteVerifiedUrl).hostname.replace(/^www\./, '')

      if (!finalName) {
        const nameFallback = domain.split('.')[0]
        finalName = nameFallback.charAt(0).toUpperCase() + nameFallback.slice(1)
        finalLogo = `/api/avatar/${encodeURIComponent(domain)}`
        finalSource = 'fallback'
      }

      const payload = {
        website_url: domain,
        website_name: finalName,
        website_logo: finalLogo,
        logo_source: finalSource,
        custom_message: quickMessage,
        bid_amount: bidNum.toFixed(2)
      }

      // 2. Initiate Checkout
      const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'
      const endpoint = isDemo ? '/api/checkout/demo' : '/api/checkout'
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const resData = await response.json()
      
      if (!response.ok) throw new Error(resData.error || 'Checkout session failed')

      if (resData.url) {
        window.location.href = resData.url
      } else {
        throw new Error('No checkout URL returned')
      }

    } catch (err: any) {
      console.error(err)
      setQuickError(err.message || 'Payment initiation failed. Please try again.')
    } finally {
      setLoadingPayment(false)
    }
  }

  if (loading) {
    return (
      <>
        <Header />
        <PageSkeleton />
      </>
    )
  }

  if (error) {
    return (
      <>
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center pt-24 pb-24 text-center px-4">
          <h2 className="text-[20px] font-bold text-[#1a1a1a] mb-2">We couldn&apos;t load the leaderboard.</h2>
          <button onClick={() => fetchGameState(1, true)} className="bg-white border border-gray-200 px-6 py-2 rounded-xl font-semibold text-sm hover:bg-gray-50 transition-colors">
            Refresh Page
          </button>
        </div>
      </>
    )
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const displayStart = (currentPage - 1) * PAGE_SIZE + 1
  const displayEnd = Math.min(currentPage * PAGE_SIZE, totalCount)

  // Custom Pagination Component
  const renderPagination = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      if (currentPage <= 3) {
        pages.push(1, 2, 3, 4, '...', totalPages)
      } else if (currentPage >= totalPages - 2) {
        pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages)
      } else {
        pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages)
      }
    }

    return (
      <div className="flex flex-col items-center gap-3 mt-6 mb-2">
        <div className="flex items-center gap-2">
          <button 
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-900 disabled:opacity-30"
          >
            ‹
          </button>
          
          {pages.map((p, i) => (
            p === '...' ? (
              <span key={`dots-${i}`} className="text-gray-400 px-1">...</span>
            ) : (
              <button
                key={p}
                onClick={() => setCurrentPage(p as number)}
                className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-medium transition-colors ${
                  currentPage === p 
                    ? 'bg-[#e2735a] text-white' 
                    : 'text-[#e2735a] hover:bg-orange-50'
                }`}
              >
                {p}
              </button>
            )
          ))}

          <button 
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            className="w-8 h-8 flex items-center justify-center text-[#e2735a] hover:text-orange-600 disabled:opacity-30 disabled:text-gray-400"
          >
            ›
          </button>
        </div>
        
        <div className="text-xs font-medium text-gray-500 text-center">
          {displayStart} – {displayEnd} of {totalCount.toLocaleString()}
        </div>
      </div>
    )
  }

  return (
    <>
      <Header />

      <main className="flex-1 flex flex-col items-center pt-2 pb-12 px-4 md:px-6 lg:px-8 max-w-5xl mx-auto w-full">
        
        <HeroSection 
          quickWebsiteUrl={quickWebsiteUrl}
          setQuickWebsiteUrl={(val: string) => { setQuickWebsiteUrl(val); }}
          quickMessage={quickMessage}
          setQuickMessage={(val: string) => { setQuickMessage(val); setQuickError(''); }}
          quickBidAmount={quickBidAmount}
          setQuickBidAmount={(val: string) => { setQuickBidAmount(val); setQuickError(''); }}
          triggerCheckout={triggerCheckout}
          quickError={quickError}
          estimatedRank={estimatedRank}
          loadingPayment={loadingPayment}
          loadingRank={loadingRank}
          websiteStatus={websiteStatus}
        />

        <section className="w-full">
          {leaderboard.length === 0 ? (
            <div className="text-center py-20 text-gray-500 border border-gray-100 rounded-3xl bg-white">
              The board is empty. Be the first to join the ranking!
            </div>
          ) : (
            <>
              <div className="bg-white rounded-3xl overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.02)] border border-gray-100">
                <div className="border-b border-gray-100 px-6 sm:px-8 py-3 flex items-center justify-between">
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Rank & Claim</span>
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Amount</span>
                </div>
                
                <div className="flex flex-col">
                  {leaderboard.map((participant, index) => (
                    <LeaderboardItem 
                      key={participant.id} 
                      participant={participant} 
                      rank={(currentPage - 1) * PAGE_SIZE + index + 1} 
                    />
                  ))}
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-end gap-4 mt-6">
                <div className="flex-1 flex justify-center">
                  {renderPagination()}
                </div>
                <button 
                  onClick={() => fetchGameState(currentPage, false)}
                  className="flex items-center gap-2 px-4 py-2 rounded-full border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Refresh
                </button>
              </div>
            </>
          )}
        </section>

        {/* Total Earned Stats Section */}
        {totalEarned > 0 && (
          <section className="mt-16 mb-8 flex flex-col items-center justify-center text-center max-w-md w-full">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
              This simple side project made
            </h3>
            <div className="text-4xl md:text-5xl font-black text-[#1a1a1a] tracking-tight mb-2">
              ${totalEarned.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-sm font-medium text-gray-500">
              since its launch {launchAgeHours} hours ago
            </p>
          </section>
        )}

      </main>
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
