'use client'

import { useState, useEffect } from 'react'
import { Share, ArrowLeft, RefreshCcw } from 'lucide-react'
import Link from 'next/link'

type PaymentState = 'loading' | 'pending' | 'succeeded' | 'failed' | 'error'

interface PaymentData {
  rank: number
  isNumberOne: boolean
  websiteName: string
  customMessage: string
  amountPaid: string | null
}

export default function PaymentStatusPoller({ sessionId }: { sessionId: string }) {
  const [status, setStatus] = useState<PaymentState>('loading')
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null)
  
  const checkStatus = async () => {
    try {
      const res = await fetch(`/api/checkout/status?payment_id=${encodeURIComponent(sessionId)}`, {
        cache: 'no-store'
      })
      if (!res.ok) throw new Error('API Error')
      
      const data = await res.json()
      
      if (data.status === 'succeeded') {
        setStatus('succeeded')
        setPaymentData(data.data)
      } else if (data.status === 'pending') {
        setStatus('pending')
      } else {
        setStatus('failed')
      }
    } catch (err) {
      console.error('Failed to check payment status', err)
      // Only set to error if we haven't already succeeded or failed
      setStatus(prev => prev === 'loading' ? 'error' : prev)
    }
  }

  useEffect(() => {
    // Initial check immediately
    checkStatus()

    // Poll every 2.5 seconds if still pending or loading
    const interval = setInterval(() => {
      setStatus(current => {
        if (current === 'loading' || current === 'pending') {
          checkStatus()
          return current
        }
        clearInterval(interval)
        return current
      })
    }, 2500)

    return () => clearInterval(interval)
  }, [sessionId])

  if (status === 'loading' || status === 'pending') {
    return (
      <div className="text-center animate-in zoom-in-95 duration-300">
        <div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-full flex items-center justify-center text-3xl mb-6 shadow-sm border border-blue-200 dark:border-blue-700/50">
          ⏳
        </div>
        <h2 className="text-2xl font-bold mb-4 text-[var(--foreground)] uppercase tracking-tight">Payment Is Still Being Verified</h2>
        <div className="text-[var(--secondary)] mb-8 space-y-2 font-medium">
          <p className="text-[var(--accent)] font-bold uppercase tracking-wider text-sm">Don&apos;t pay again.</p>
          <p>Your payment may still be processing on the provider&apos;s end.</p>
          <p>We are automatically checking for updates...</p>
        </div>
        <button 
          onClick={checkStatus}
          className="inline-flex items-center justify-center gap-2 bg-[var(--surface-elevated)] border border-[var(--border-soft)] text-[var(--foreground)] px-8 py-3 rounded-full font-bold text-sm hover:bg-[var(--border-soft)] transition-colors w-full sm:w-auto uppercase tracking-wide"
        >
          <RefreshCcw className={`w-4 h-4 ${status === 'loading' ? 'animate-spin' : ''}`} /> Refresh Status
        </button>
      </div>
    )
  }

  if (status === 'succeeded' && paymentData) {
    const { rank, isNumberOne, websiteName, customMessage, amountPaid } = paymentData
    const displayAmount = amountPaid ? `$${amountPaid}` : '—'
    
    const shareText = encodeURIComponent(`I just joined the ranking on ReplaceMe at #${rank} 👑\n\n${websiteName} is live.\n\nreplaceme.lol`)
    const shareUrl = `https://twitter.com/intent/tweet?text=${shareText}`

    return (
      <div className="text-center animate-in zoom-in-95 duration-300">
        <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center text-3xl mb-6 shadow-sm border ${isNumberOne ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 border-yellow-200 dark:border-yellow-700/50' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 border-gray-200 dark:border-gray-700'}`}>
          {isNumberOne ? '👑' : '🎉'}
        </div>
        <h1 className="text-[12px] font-bold text-[var(--muted)] uppercase tracking-[0.1em] mb-2">
          {isNumberOne ? "YOU'RE #1" : "YOU'RE ON THE BOARD"}
        </h1>
        <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-[var(--foreground)] mb-2">
          #{rank}
        </h2>
        <div className="text-xl font-bold text-[var(--secondary)] mb-2">
          {websiteName}
        </div>
        {customMessage && (
          <p className="text-lg text-[var(--foreground)] font-medium mb-6 italic">
            &quot;{customMessage}&quot;
          </p>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 mb-8 text-[14px] md:text-[15px] font-bold text-[var(--secondary)]">
          <span className="text-[var(--accent)]">{displayAmount} paid</span>
          <span className="hidden sm:block text-[var(--border)]">•</span>
          <span>👁 0 views</span>
          <span className="hidden sm:block text-[var(--border)]">•</span>
          <span>🔥 0 clicks</span>
        </div>

        <div className="space-y-4 max-w-sm mx-auto">
          <a 
            href={shareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full bg-[var(--foreground)] text-[var(--background)] px-6 py-3.5 rounded-[12px] font-bold text-[15px] hover:opacity-90 transition-opacity shadow-md"
          >
            <Share className="w-4 h-4" /> Share your rank
          </a>
          
          <Link href="/" className="inline-flex items-center justify-center gap-2 w-full text-[var(--secondary)] hover:text-[var(--foreground)] font-medium text-sm transition-colors py-2">
            <ArrowLeft className="w-4 h-4" /> Return to leaderboard
          </Link>
        </div>
      </div>
    )
  }

  // Failed / Error
  return (
    <div className="text-center animate-in zoom-in-95 duration-300">
      <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-full flex items-center justify-center text-3xl mb-6 shadow-sm border border-red-200 dark:border-red-700/50">
        ⚠️
      </div>
      <h2 className="text-xl font-bold mb-2 text-[var(--foreground)] uppercase">Payment Status: {status}</h2>
      <p className="text-sm text-[var(--secondary)] mb-6">Something went wrong or the payment failed.</p>
      <Link href="/" className="inline-flex items-center justify-center gap-2 bg-[var(--surface-elevated)] border border-[var(--border-soft)] text-[var(--foreground)] px-8 py-3 rounded-full font-bold text-sm hover:bg-[var(--border-soft)] transition-colors w-full sm:w-auto uppercase tracking-wide">
        Return Home
      </Link>
    </div>
  )
}
