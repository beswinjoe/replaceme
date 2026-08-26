'use client'

import { useState, useEffect } from 'react'
import { X, AlertCircle } from 'lucide-react'

interface CheckoutModalProps {
  isOpen: boolean
  onClose: () => void
  currentPrice: number
  currentWebsite: string
  prefilledData?: {
    websiteUrl: string
    message: string
  }
}

export function CheckoutModal({ isOpen, onClose, currentPrice, currentWebsite, prefilledData }: CheckoutModalProps) {
  
  // Form State
  const [websiteInput, setWebsiteInput] = useState('')
  const [customMessage, setCustomMessage] = useState('')
  
  // Derived Identity
  const [domain, setDomain] = useState('')
  const [websiteName, setWebsiteName] = useState('')
  const [logoUrl, setLogoUrl] = useState('')

  const [paymentLoading, setPaymentLoading] = useState(false)
  const [paymentError, setPaymentError] = useState<string | null>(null)

  useEffect(() => {
    if (prefilledData) {
      setWebsiteInput(prefilledData.websiteUrl)
      setCustomMessage(prefilledData.message)
    } else {
      setCustomMessage(`I just paid $${currentPrice.toFixed(2)} to take #1.`)
    }
  }, [isOpen, prefilledData, currentPrice])

  useEffect(() => {
    try {
      if (!websiteInput) {
         setDomain('')
         setWebsiteName('')
         setLogoUrl('')
         return
      }
      // Ensure we can parse it as a URL
      const urlStr = websiteInput.startsWith('http') ? websiteInput : `https://${websiteInput}`
      const url = new URL(urlStr)
      const cleanDomain = url.hostname.replace(/^www\./, '')
      
      setDomain(cleanDomain)
      // Capitalize first letter of domain as a decent fallback for website name
      const nameFallback = cleanDomain.split('.')[0]
      setWebsiteName(nameFallback.charAt(0).toUpperCase() + nameFallback.slice(1)) 
      setLogoUrl(`https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${cleanDomain}&size=128`)
    } catch (e) {
      // Let user keep typing
      setDomain('')
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

    try {
      const payload = {
        website_url: domain,
        website_name: websiteName,
        website_logo: logoUrl,
        custom_message: customMessage,
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
              You&apos;re replacing {currentWebsite}
            </h2>
            <p className="text-gray-500 text-sm">
              Claim the #1 spot for <span className="font-semibold text-[var(--foreground)]">${currentPrice.toFixed(2)}</span>.
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
            
            {paymentError && (
              <div className="flex items-start gap-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-xl text-sm border border-red-100 dark:border-red-800">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <p>{paymentError}</p>
              </div>
            )}

            <div className="pt-4 mt-2 space-y-3">
              <button
                onClick={() => handlePayment(false)}
                disabled={paymentLoading || !domain || !customMessage}
                className="w-full bg-[var(--accent)] text-white py-3.5 rounded-xl font-bold text-base hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed shadow-sm uppercase tracking-wide"
              >
                {paymentLoading ? 'Processing...' : `CLAIM #1 FOR $${currentPrice.toFixed(2)}`}
              </button>
              
              {process.env.NEXT_PUBLIC_DEMO_MODE === 'true' && (
                <button
                  onClick={() => handlePayment(true)}
                  disabled={paymentLoading || !domain || !customMessage}
                  className="w-full flex items-center justify-center gap-2 bg-[var(--surface-elevated)] border border-[var(--border-soft)] text-[var(--foreground)] py-3 rounded-xl font-semibold text-sm hover:bg-[var(--border-soft)] transition-colors disabled:opacity-50"
                >
                   Simulate Demo Payment
                </button>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Live Preview */}
        <div className="w-full lg:w-[380px] bg-[var(--surface-elevated)] p-8 md:p-10 flex flex-col justify-center">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-6 text-center">Preview</p>

          <div className="bg-[var(--surface)] border border-[var(--border-soft)] rounded-2xl p-6 shadow-sm relative">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-lg">👑</span>
              <span className="text-xs font-bold uppercase tracking-widest text-gray-500">#1</span>
            </div>

            <div className="flex items-center gap-4 mb-4">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="website logo"
                  className="w-12 h-12 rounded-lg border border-[var(--border-soft)] bg-gray-100 dark:bg-gray-800 object-cover"
                />
              ) : (
                <div className="w-12 h-12 rounded-lg border border-[var(--border-soft)] bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 text-xs font-medium">
                  URL
                </div>
              )}
              <div className="overflow-hidden">
                <h4 className="font-bold text-[var(--foreground)] truncate max-w-[160px]">
                  {websiteName || 'Website Name'}
                </h4>
                <p className="text-sm text-gray-500 truncate max-w-[160px]">
                  {domain || 'website.com'}
                </p>
              </div>
            </div>

            <div className="text-sm font-medium text-[var(--foreground)] mb-4 italic break-words">
              &quot;{customMessage || 'Your claim will appear here.'}&quot;
            </div>
          </div>
          
          <div className="mt-8 text-center">
             <h3 className="text-lg font-semibold text-[var(--foreground)]">You will replace {currentWebsite}.</h3>
          </div>
        </div>

      </div>
    </div>
  )
}
