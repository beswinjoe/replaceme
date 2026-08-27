'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Menu, X } from 'lucide-react'

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-40 w-full bg-[var(--surface)] border-b border-[var(--border)] h-[64px] md:h-[72px] flex items-center">
      <div className="mx-auto w-full max-w-[1240px] px-4 md:px-6 lg:px-8">
        <div className="flex h-full items-center justify-between">
          
          <div className="flex items-center">
            <Link href="/" className="text-xl font-bold tracking-tight text-[var(--foreground)] hover:text-[var(--accent)] transition-colors">
              REPLACEME
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-6 text-[14px] font-medium text-[var(--secondary)] tracking-tight">
            <Link href="/history" className="hover:text-[var(--foreground)] transition-colors">
              History
            </Link>
            <Link href="/leaderboard" className="hover:text-[var(--foreground)] transition-colors">
              Leaderboard
            </Link>
            <Link href="/#how-it-works" className="hover:text-[var(--foreground)] transition-colors">
              How it works
            </Link>
          </nav>

          {/* Mobile Menu Button */}
          <div className="flex items-center gap-3 md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-1.5 text-[var(--foreground)]"
            >
              {mobileMenuOpen ? <X className="h-[20px] w-[20px]" /> : <Menu className="h-[20px] w-[20px]" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="absolute top-[64px] left-0 w-full border-b border-[var(--border)] bg-[var(--surface)] md:hidden py-4 px-4 space-y-4 font-medium shadow-[0_4px_12px_rgba(0,0,0,0.05)]">
          <Link
            href="/history"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-[var(--secondary)] hover:text-[var(--foreground)]"
          >
            History
          </Link>
          <Link
            href="/leaderboard"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-[var(--secondary)] hover:text-[var(--foreground)]"
          >
            Leaderboard
          </Link>
          <Link
            href="/#how-it-works"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-[var(--secondary)] hover:text-[var(--foreground)]"
          >
            How it works
          </Link>
        </div>
      )}
    </header>
  )
}
