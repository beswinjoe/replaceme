import Link from 'next/link'

export function Footer() {
  return (
    <footer className="w-full border-t border-[var(--border-soft)] bg-[var(--background)] mt-auto">
      <div className="max-w-[1000px] mx-auto px-4 md:px-6 lg:px-8 py-10 md:py-12">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8 mb-10">
          
          <div className="flex flex-col items-center md:items-start text-center md:text-left">
            <Link href="/" className="text-xl md:text-2xl font-black tracking-tighter text-[var(--foreground)] flex items-center gap-2 mb-2">
              <span className="text-2xl">🔥</span> ReplaceMe
            </Link>
            <p className="text-sm font-semibold text-[var(--secondary)]">
              Bid higher. Rank higher.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 md:gap-8 text-sm font-bold text-[var(--muted)]">
            <Link href="/" className="hover:text-[var(--foreground)] transition-colors">
              Leaderboard
            </Link>
            <a href="mailto:beswinjo70@gmail.com" className="hover:text-[var(--foreground)] transition-colors">
              Contact Support
            </a>
            <Link href="/terms" className="hover:text-[var(--foreground)] transition-colors">
              Terms of Service
            </Link>
            <Link href="/privacy" className="hover:text-[var(--foreground)] transition-colors">
              Privacy Policy
            </Link>
          </div>
          
        </div>
        
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-6 border-t border-[var(--border-soft)] text-xs font-semibold text-[var(--muted)]">
          <p>© {new Date().getFullYear()} ReplaceMe</p>
          <p>The internet&apos;s most competitive open leaderboard.</p>
        </div>
      </div>
    </footer>
  )
}
