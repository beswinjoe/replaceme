'use client'

import { useState, useEffect } from 'react'
import { X, AlertCircle } from 'lucide-react'

interface CheckoutModalProps {
  isOpen: boolean
  onClose: () => void
  leaderboard: any[]
  prefilledData?: {
    websiteUrl: string
    message: string
    bidAmount?: string
  }
}

export function CheckoutModal({ isOpen, onClose, leaderboard, prefilledData }: CheckoutModalProps) {
  
  // Form State
  const [websiteInput, setWebsiteInput] = useState('')
  const [customMessage, setCustomMessage] = useState('')
  const [bidAmount, setBidAmount] = useState<string>('2.00')
  
  // Derived Identity
  const [domain, setDomain] = useState('')
  const [websiteName, setWebsiteName] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [logoSource, setLogoSource] = useState('fallback')

  const [paymentLoading, setPaymentLoading] = useState(false)
  const [paymentError, setPaymentError] = useState<string | null>(null)

  useEffect(() => {
    if (prefilledData) {
      setWebsiteInput(prefilledData.websiteUrl)
      setCustomMessage(prefilledData.message)
      if (prefilledData.bidAmount) {
        setBidAmount(prefilledData.bidAmount)
      }
    } else {
      setCustomMessage(`I just bid to join the ranking.`)
    }
  }, [isOpen, prefilledData])

  // Calculate estimated rank
  const estimatedRank = (() => {
    const amount = Number(bidAmount)
    if (isNaN(amount) || amount <= 0) return null
    let rank = 1
    for (const participant of leaderboard) {
      if (Number(participant.amount_paid) >= amount) {
        rank++
      }
    }
    return rank
  })()

  useEffect(() => {
    let active = true
    const timer = setTimeout(async () => {
      try {
        if (!websiteInput) {
           if (active) {
             setDomain('')
             setWebsiteName('')
             setLogoUrl('')
             setLogoSource('fallback')
           }
           return
        }
        
        const urlStr = websiteInput.startsWith('http') ? websiteInput : `https://${websiteInput}`
        const url = new URL(urlStr)
        const cleanDomain = url.hostname.replace(/^www\./, '')
        
        if (active) {
          setDomain(cleanDomain)
          const nameFallback = cleanDomain.split('.')[0]
          setWebsiteName(nameFallback.charAt(0).toUpperCase() + nameFallback.slice(1)) 
        }

        const res = await fetch(`/api/metadata?url=${encodeURIComponent(urlStr)}`)
        if (!res.ok) throw new Error('Metadata fetch failed')
        
        const data = await res.json()
        if (active && data.logoUrl) {
          setWebsiteName(data.websiteName || websiteName) // Update with better name if found
          setLogoUrl(data.logoUrl)
          setLogoSource(data.logoSource || 'fallback')
        }
      } catch (e) {
        if (active && websiteInput) {
           // Basic fallback if fetch totally fails or URL is invalid
           try {
             const urlStr = websiteInput.startsWith('http') ? websiteInput : `https://${websiteInput}`
             const url = new URL(urlStr)
             const cleanDomain = url.hostname.replace(/^www\./, '')
             setDomain(cleanDomain)
             setLogoUrl(`/api/avatar/${encodeURIComponent(cleanDomain)}`)
             setLogoSource('fallback')
           } catch {
             setDomain('')
             setLogoUrl('')
             setLogoSource('fallback')
           }
        }
      }
    }, 500)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [websiteInput])

  if (!isOpen) return null

  // Pay/Simulate Handler
  const handlePayment = async (isDemo: boolean = false) => {
    setPaymentLoading(true)
    setPaymentError(null)

    if (!domain) {
      setPaymentError('Please enter a valid website URL.')
      setPaymentLoading(false)
      return
    }

    if (!customMessage.trim()) {
      setPaymentError('Your claim message is required.')
      setPaymentLoading(false)
      return
    }

    const amountNum = Number(bidAmount)
    if (isNaN(amountNum) || amountNum < 1.00) {
      setPaymentError('Minimum bid is $1.00')
      setPaymentLoading(false)
      return
    }

    try {
      const payload = {
        website_url: domain,
        website_name: websiteName,
        website_logo: logoUrl,
        logo_source: logoSource,
        custom_message: customMessage,
        bid_amount: amountNum.toFixed(2)
      }

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
      setPaymentError(err.message || 'Payment initiation failed. Please try again.')
    } finally {
      setPaymentLoading(false)
    }
  }

  // CHECKOUT FLOW
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-[var(--surface)] border border-[var(--border-soft)] rounded-3xl shadow-2xl flex flex-col lg:flex-row overflow-hidden animate-in zoom-in-95 duration-200 my-8">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-2 text-gray-400 hover:text-[var(--foreground)] transition-colors rounded-full hover:bg-[var(--surface-elevated)] z-20"
        >
          <X className="h-5 w-5" />
        </button>

        {/* LEFT COLUMN: Form */}
        <div className="flex-1 p-8 md:p-10 border-b lg:border-b-0 lg:border-r border-[var(--border-soft)]">
          <div className="mb-8">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-[var(--foreground)] mb-2 uppercase">
              Join the Ranking
            </h2>
            <p className="text-gray-500 text-sm">
              Bid any amount to enter the leaderboard. Minimum $1.00.
            </p>
          </div>

          <div className="space-y-6">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Website URL</label>
              <input
                type="url"
                required
                placeholder="https://yourwebsite.com"
                value={websiteInput}
                onChange={(e) => setWebsiteInput(e.target.value)}
                className="w-full bg-[var(--surface-elevated)] border border-[var(--border-soft)] p-3 rounded-xl text-[var(--foreground)] text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Your Claim</label>
              <textarea
                rows={2}
                maxLength={100}
                required
                placeholder="What do you want to say?"
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                className="w-full bg-[var(--surface-elevated)] border border-[var(--border-soft)] p-3 rounded-xl text-[var(--foreground)] text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent)] resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Bid Amount ($)</label>
              <input
                type="number"
                min="1.00"
                step="1.00"
                required
                placeholder="2.00"
                value={bidAmount}
                onChange={(e) => setBidAmount(e.target.value)}
                className="w-full bg-[var(--surface-elevated)] border border-[var(--border-soft)] p-3 rounded-xl text-[var(--foreground)] text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
            </div>
            
            {paymentError && (
              <div className="flex items-start gap-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-xl text-sm border border-red-100 dark:border-red-800">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <p>{paymentError}</p>
              </div>
            )}

            <div className="pt-4 mt-2 space-y-3">
              <button
                onClick={() => handlePayment(false)}
                disabled={paymentLoading || !domain || !customMessage || !bidAmount}
                className="w-full bg-[var(--accent)] text-white py-3.5 rounded-xl font-bold text-base hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed shadow-sm uppercase tracking-wide"
              >
                {paymentLoading ? 'Processing...' : `JOIN FOR $${Number(bidAmount) ? Number(bidAmount).toFixed(2) : '0.00'}`}
              </button>
              
              {process.env.NEXT_PUBLIC_DEMO_MODE === 'true' && (
                <button
                  onClick={() => handlePayment(true)}
                  disabled={paymentLoading || !domain || !customMessage || !bidAmount}
                  className="w-full flex items-center justify-center gap-2 bg-[var(--surface-elevated)] border border-[var(--border-soft)] text-[var(--foreground)] py-3 rounded-xl font-semibold text-sm hover:bg-[var(--border-soft)] transition-colors disabled:opacity-50"
                >
                   Simulate Demo Payment
                </button>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Live Preview */}
        <div className="w-full lg:w-[480px] bg-[var(--surface-elevated)] p-8 md:p-10 flex flex-col justify-center border-l border-[var(--border-soft)]">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-6 text-center">Live Preview</p>

          <div className="w-full bg-[var(--surface)] border border-[var(--border-soft)] rounded-xl overflow-hidden shadow-sm">
            <div className="bg-[var(--surface-elevated)] border-b border-[var(--border-soft)] px-4 py-2 flex items-center justify-between">
              <span className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider">Rank & Claim</span>
              <span className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider pr-2">Amount</span>
            </div>
            
            <div className={`flex items-center justify-between p-4 bg-[var(--surface)] ${estimatedRank === 1 ? 'bg-[var(--surface-featured)]' : ''}`}>
              
              <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                <div className="flex flex-col items-center justify-center w-8 shrink-0">
                  <span className={`text-lg font-bold ${estimatedRank === 1 ? 'text-[var(--accent)]' : 'text-[var(--muted)]'}`}>
                    #{estimatedRank || '?'}
                  </span>
                </div>
                
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt="website logo"
                    className="w-10 h-10 rounded-lg object-contain border border-[var(--border-soft)] shrink-0 bg-white dark:bg-black"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-lg border border-[var(--border-soft)] shrink-0 bg-gray-50 dark:bg-gray-900 flex items-center justify-center text-gray-400 font-bold text-[10px]">
                    URL
                  </div>
                )}

                <div className="flex flex-col min-w-0">
                  <div className="flex items-baseline gap-2 truncate">
                    <span className="text-sm sm:text-base font-bold text-[var(--foreground)] truncate">
                      {websiteName || 'Website Name'}
                    </span>
                    <span className="hidden sm:inline text-[11px] text-[var(--secondary)] truncate">
                      {domain || 'website.com'}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 mt-0.5 truncate">
                    {customMessage ? (
                      <span className="text-xs sm:text-sm text-[var(--foreground)] font-medium truncate max-w-[150px] sm:max-w-[200px]">
                        {customMessage}
                      </span>
                    ) : (
                      <span className="text-[11px] text-[var(--accent)] hover:underline truncate">
                        {domain || 'website.com'}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 mt-1.5 text-[10px] text-[var(--muted)] font-medium">
                     <span>Just now</span>
                     <span className="flex items-center gap-1"><span className="w-1 h-1 bg-current rounded-full opacity-50" /> 0 views</span>
                     <span className="flex items-center gap-1"><span className="w-1 h-1 bg-current rounded-full opacity-50" /> 0 clicks</span>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col items-end shrink-0 pl-2">
                <span className={`text-lg sm:text-xl font-bold tabular-nums tracking-tight ${estimatedRank && estimatedRank <= 3 ? 'text-[var(--accent)]' : 'text-[var(--foreground)]'}`}>
                  ${Number(bidAmount) ? Number(bidAmount).toFixed(2) : '0.00'}
                </span>
              </div>
            </div>
          </div>
          
          <div className="mt-8 text-center text-sm text-[var(--secondary)] font-medium">
             <p>Your final rank is confirmed after payment.</p>
             <p className="mt-2 text-xs text-gray-400">Applicable taxes may be added by Dodo where required.</p>
          </div>
        </div>

      </div>
    </div>
  )
}
