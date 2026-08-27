import { Suspense } from 'react'
import { createClient } from '@/utils/supabase/server'
import { Share, ArrowLeft, RefreshCcw } from 'lucide-react'
import Link from 'next/link'

interface SuccessPageProps {
  searchParams: Promise<{ payment_id?: string }>
}

async function PaymentStatus({ sessionId }: { sessionId: string }) {
  const supabase = await createClient()

  // Handle array of payment IDs if Dodo appended its own
  const idArray = Array.isArray(sessionId) ? sessionId : sessionId.split(',')
  
  let paymentRecord = null
  for (let i = 0; i < 10; i++) {
    // Check if any of the IDs match either dodo_payment_id or metadata->>payment_id
    for (const id of idArray) {
      const { data } = await supabase
        .from('payments')
        .select('*')
        .or(`dodo_payment_id.eq.${id},metadata->>payment_id.eq.${id}`)
        .maybeSingle()
      
      if (data) {
        paymentRecord = data
        break
      }
    }
    
    if (paymentRecord) break
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  if (!paymentRecord) {
    return (
      <div className="text-center animate-in zoom-in-95 duration-300">
        <div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-full flex items-center justify-center text-3xl mb-6 shadow-sm border border-blue-200 dark:border-blue-700/50">
          ⏳
        </div>
        <h2 className="text-2xl font-bold mb-4 text-[var(--foreground)] uppercase tracking-tight">Payment Is Still Being Verified</h2>
        <div className="text-[var(--secondary)] mb-8 space-y-2 font-medium">
          <p className="text-[var(--accent)] font-bold uppercase tracking-wider text-sm">Don&apos;t pay again.</p>
          <p>Your payment may still be processing on the provider&apos;s end.</p>
          <p>Refresh this page in a moment to check again.</p>
        </div>
        <Link href={`/checkout/success?payment_id=${sessionId}`} className="inline-flex items-center justify-center gap-2 bg-[var(--surface-elevated)] border border-[var(--border-soft)] text-[var(--foreground)] px-8 py-3 rounded-full font-bold text-sm hover:bg-[var(--border-soft)] transition-colors w-full sm:w-auto uppercase tracking-wide">
          <RefreshCcw className="w-4 h-4" /> Refresh Status
        </Link>
      </div>
    )
  }

  if (paymentRecord.status === 'succeeded') {
    const amountNum = Number(paymentRecord.amount)
    const amountPaid = Number.isFinite(amountNum) ? `$${amountNum.toFixed(2)}` : '—'
    
    // Fetch replacement details
    const { data: replacement } = await supabase
      .from('replacements')
      .select('new_website_name, custom_message')
      .eq('id', paymentRecord.replacement_id)
      .single()

    // Calculate final rank
    let rank = 1
    if (Number.isFinite(amountNum)) {
      const { count } = await supabase
        .from('replacements')
        .select('*', { count: 'exact', head: true })
        .gt('amount_paid', amountNum)
      
      if (count !== null) {
        rank = count + 1
      }
    }

    const websiteName = replacement?.new_website_name || 'Your Website'
    const customMessage = replacement?.custom_message || ''

    const shareText = encodeURIComponent(`I just joined the ranking on ReplaceMe at #${rank} 👑\n\n${websiteName} is live.\n\nreplaceme.lol`)
    const shareUrl = `https://twitter.com/intent/tweet?text=${shareText}`

    const isNumberOne = rank === 1

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
          <span className="text-[var(--accent)]">{amountPaid} paid</span>
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

  // Fallback for failed or unknown status
  return (
    <div className="text-center animate-in zoom-in-95 duration-300">
      <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-full flex items-center justify-center text-3xl mb-6 shadow-sm border border-red-200 dark:border-red-700/50">
        ⚠️
      </div>
      <h2 className="text-xl font-bold mb-2 text-[var(--foreground)] uppercase">Payment Status: {paymentRecord.status}</h2>
      <p className="text-sm text-[var(--secondary)] mb-6">Something went wrong or the payment failed.</p>
      <Link href="/" className="inline-flex items-center justify-center gap-2 bg-[var(--surface-elevated)] border border-[var(--border-soft)] text-[var(--foreground)] px-8 py-3 rounded-full font-bold text-sm hover:bg-[var(--border-soft)] transition-colors w-full sm:w-auto uppercase tracking-wide">
        Return Home
      </Link>
    </div>
  )
}

export default async function CheckoutSuccessPage({ searchParams }: SuccessPageProps) {
  const { payment_id } = await searchParams

  if (!payment_id) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)] p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-[var(--foreground)] mb-4">Invalid Session</h1>
          <Link href="/" className="text-[var(--accent)] hover:underline">Return Home</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] p-4">
      <div className="w-full max-w-2xl bg-[var(--surface)] border border-[var(--border)] rounded-[24px] p-8 md:p-12 shadow-2xl">
        <Suspense fallback={<div className="text-center text-[var(--muted)]">Loading payment status...</div>}>
          <PaymentStatus sessionId={payment_id} />
        </Suspense>
      </div>
    </div>
  )
}
