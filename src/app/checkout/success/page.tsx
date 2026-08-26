import { Suspense } from 'react'
import { createClient } from '@/utils/supabase/server'
import { Share, ArrowLeft, RefreshCcw } from 'lucide-react'
import Link from 'next/link'

interface SuccessPageProps {
  searchParams: Promise<{ session_id?: string }>
}

async function PaymentStatus({ sessionId }: { sessionId: string }) {
  const supabase = await createClient()

  // Poll database for up to 10 seconds to allow webhook to process
  let paymentRecord = null
  for (let i = 0; i < 10; i++) {
    const { data } = await supabase
      .from('payments')
      .select('*')
      .eq('dodo_payment_id', sessionId)
      .single()
    
    if (data) {
      paymentRecord = data
      break
    }
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
        <Link href={`/checkout/success?session_id=${sessionId}`} className="inline-flex items-center justify-center gap-2 bg-[var(--surface-elevated)] border border-[var(--border-soft)] text-[var(--foreground)] px-8 py-3 rounded-full font-bold text-sm hover:bg-[var(--border-soft)] transition-colors w-full sm:w-auto uppercase tracking-wide">
          <RefreshCcw className="w-4 h-4" /> Refresh Status
        </Link>
      </div>
    )
  }

  if (['refund_pending', 'refunded', 'refund_failed'].includes(paymentRecord.status) || (paymentRecord.status === 'failed' && paymentRecord.metadata?.reason === 'stale_price')) {
    
    const refundNum = Number(paymentRecord.amount)
    const refundAmount = Number.isFinite(refundNum) ? refundNum.toFixed(2) : '—'
    
    const requiredNum = Number(paymentRecord.metadata?.required_price)
    const requiredPrice = Number.isFinite(requiredNum) ? requiredNum.toFixed(2) : '—'

    let refundText = Number.isFinite(refundNum) 
      ? `Your payment for $${refundAmount} was not processed for the #1 spot.`
      : "Your payment was not processed for the #1 spot."
      
    if (paymentRecord.status === 'refund_pending') {
      refundText = Number.isFinite(refundNum) 
        ? `Your payment for $${refundAmount} is being reviewed for refund.`
        : "Your payment is being reviewed for refund."
    } else if (paymentRecord.status === 'refunded') {
      refundText = Number.isFinite(refundNum) 
        ? `Your payment for $${refundAmount} was successfully refunded.`
        : "Your payment was successfully refunded."
    } else if (paymentRecord.status === 'refund_failed') {
      refundText = Number.isFinite(refundNum) 
        ? `Your payment for $${refundAmount} could not be automatically refunded. Please contact support.`
        : "Your payment could not be automatically refunded. Please contact support."
    }

    return (
      <div className="text-center animate-in zoom-in-95 duration-300">
        <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-full flex items-center justify-center text-3xl mb-6 shadow-sm border border-red-200 dark:border-red-700/50">
          💀
        </div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-[var(--foreground)] mb-4 uppercase">
          TOO LATE.
        </h1>
        <p className="text-lg text-[var(--secondary)] font-medium mb-8">
          Someone else claimed #1 right before you. The new price is <span className="font-bold text-[var(--foreground)]">${requiredPrice}</span>.
        </p>
        <div className="space-y-4">
          <p className="text-sm font-bold text-[var(--accent)]">{refundText}</p>
          <Link href="/?checkout=true" className="inline-flex items-center justify-center bg-[var(--foreground)] text-[var(--background)] px-8 py-3 rounded-full font-bold text-sm hover:opacity-90 transition-opacity w-full sm:w-auto uppercase tracking-wide">
            REPLACE THE NEW #1
          </Link>
        </div>
      </div>
    )
  }

  if (paymentRecord.status === 'succeeded') {
    const amountNum = Number(paymentRecord.amount)
    const amountPaid = Number.isFinite(amountNum) ? `$${amountNum.toFixed(2)}` : '—'
    
    return (
      <div className="text-center animate-in zoom-in-95 duration-300">
        <div className="mx-auto w-16 h-16 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 rounded-full flex items-center justify-center text-3xl mb-6 shadow-sm border border-yellow-200 dark:border-yellow-700/50">
          👑
        </div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-[var(--foreground)] mb-2">
          You&apos;re #1.
        </h1>
        <p className="text-lg text-[var(--secondary)] font-medium mb-8">
          Your reign has officially started.
        </p>

        <div className="bg-[var(--surface-elevated)] border border-[var(--border-soft)] rounded-2xl p-6 mb-8 text-center space-y-2 max-w-sm mx-auto">
           <p className="text-sm font-medium text-[var(--muted)] uppercase tracking-wide">You paid</p>
           <p className="text-4xl font-bold text-[var(--accent)] tracking-tight">{amountPaid}</p>
        </div>

        <div className="space-y-6">
          <Link href="/" className="inline-flex items-center gap-2 text-[var(--secondary)] hover:text-[var(--foreground)] font-medium text-sm transition-colors">
            <ArrowLeft className="w-4 h-4" /> Return to homepage
          </Link>
        </div>
      </div>
    )
  }

  // Fallback for failed or unknown status
  return (
    <div className="text-center">
      <h2 className="text-xl font-bold mb-2 text-[var(--foreground)]">Payment Status: {paymentRecord.status}</h2>
      <Link href="/" className="text-[var(--accent)] hover:underline mt-4 inline-block">Return Home</Link>
    </div>
  )
}

export default async function CheckoutSuccessPage({ searchParams }: SuccessPageProps) {
  const { session_id } = await searchParams

  if (!session_id) {
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
          <PaymentStatus sessionId={session_id} />
        </Suspense>
      </div>
    </div>
  )
}
