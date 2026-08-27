import Link from 'next/link'

export function Footer() {
  return (
    <footer className="w-full border-t border-[var(--border)] bg-[var(--background)] mt-auto">
      <div className="max-w-5xl mx-auto px-4 md:px-6 lg:px-8 py-12">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          
          <div className="flex flex-col items-center md:items-start text-center md:text-left">
            <Link href="/" className="text-xl md:text-2xl font-black tracking-tighter text-[var(--foreground)] flex items-center gap-2 mb-1">
              <span>🔥</span> ReplaceMe
            </Link>
            <p className="text-sm font-medium text-[var(--secondary)]">
              Bid higher. Rank higher.
            </p>
          </div>

          <div className="flex items-center gap-6 text-sm font-medium text-[var(--secondary)]">
            <p>Built by <a href="https://x.com/beswinjoee" target="_blank" rel="noopener noreferrer" className="text-[var(--foreground)] hover:text-[var(--accent)] transition-colors">@beswinjoee</a></p>
            <Link href="/terms" className="hover:text-[var(--foreground)] transition-colors">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-[var(--foreground)] transition-colors">
              Privacy
            </Link>
          </div>
          
        </div>
      </div>
    </footer>
  )
}
