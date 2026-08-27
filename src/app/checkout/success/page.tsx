import { Suspense } from 'react'
import Link from 'next/link'
import PaymentStatusPoller from '@/components/PaymentStatusPoller'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

interface SuccessPageProps {
  searchParams: Promise<{ payment_id?: string }>
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
          <PaymentStatusPoller sessionId={payment_id} />
        </Suspense>
      </div>
    </div>
  )
}
