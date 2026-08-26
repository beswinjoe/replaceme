'use client'

import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import { useState, useEffect } from 'react'
import { LogOut, User as UserIcon, Menu, X, Sun, Moon } from 'lucide-react'
import { useTheme } from 'next-themes'

export function Header() {
  const { user, profile, loading, signOut, demoLogin } = useAuth()
  const { theme, setTheme } = useTheme()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleDemoLogin = async () => {
    await demoLogin()
    setDropdownOpen(false)
  }

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }

  return (
    <header className="sticky top-0 z-40 w-full bg-[var(--surface)] border-b border-[var(--border)] h-[64px] md:h-[72px] flex items-center">
      <div className="mx-auto w-full max-w-[1240px] px-4 md:px-6 lg:px-8">
        <div className="flex h-full items-center justify-between">
          
          {/* Logo & Live Status */}
          <div className="flex items-center gap-4">
            <Link href="/" className="text-xl font-bold tracking-tight text-[var(--foreground)] hover:text-[var(--accent)] transition-colors">
              REPLACEME
            </Link>
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-[var(--background)] border border-[var(--border)] rounded-full shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)] animate-pulse" />
              <span className="text-xs font-medium text-[var(--secondary)]">248 online</span>
            </div>
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
            
            <div className="h-4 w-px bg-[var(--border)] mx-1" />

            {/* Theme Toggle */}
            {mounted && (
              <button
                onClick={toggleTheme}
                className="p-1.5 text-[var(--secondary)] hover:text-[var(--foreground)] transition-colors rounded-full hover:bg-[var(--background)]"
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
              </button>
            )}

            {/* User Area */}
            {loading ? (
              <div className="h-9 w-24 bg-[var(--background)] animate-pulse rounded-[999px]" />
            ) : user && profile ? (
              <div className="relative">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-[var(--background)] border border-[var(--border)] rounded-[999px] hover:border-[var(--muted)] transition-colors"
                >
                  {profile.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={profile.username}
                      className="h-6 w-6 rounded-full object-cover"
                    />
                  ) : (
                    <div className="h-6 w-6 rounded-full bg-[var(--muted)] opacity-50" />
                  )}
                  <span className="text-[14px] font-semibold text-[var(--foreground)]">@{profile.username}</span>
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-[var(--surface)] border border-[var(--border)] rounded-[14px] shadow-[0_4px_12px_rgba(0,0,0,0.05)] z-50 py-1">
                    <Link
                      href={`/profile/${profile.username}`}
                      onClick={() => setDropdownOpen(false)}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-[14px] font-medium text-[var(--foreground)] hover:bg-[var(--background)] transition-colors"
                    >
                      <UserIcon className="h-4 w-4" /> My Profile
                    </Link>
                    <button
                      onClick={() => {
                        signOut()
                        setDropdownOpen(false)
                      }}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-[14px] font-medium text-red-500 hover:bg-[var(--background)] transition-colors"
                    >
                      <LogOut className="h-4 w-4" /> Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={handleDemoLogin}
                className="bg-[var(--foreground)] text-[var(--surface)] px-4 py-1.5 text-[14px] font-semibold rounded-[12px] hover:opacity-90 transition-opacity active:scale-[0.98]"
              >
                Connect
              </button>
            )}
          </nav>

          {/* Mobile Menu Button */}
          <div className="flex items-center gap-3 md:hidden">
            {mounted && (
              <button
                onClick={toggleTheme}
                className="p-1.5 text-[var(--secondary)] hover:text-[var(--foreground)] transition-colors"
              >
                {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </button>
            )}
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

          {user && profile ? (
            <div className="pt-4 border-t border-[var(--border)] space-y-3">
              <Link
                href={`/profile/${profile.username}`}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 py-2 text-[var(--foreground)]"
              >
                <img
                  src={profile.avatar_url || ''}
                  alt={profile.username}
                  className="h-8 w-8 rounded-full object-cover"
                />
                <span className="font-semibold">@{profile.username}</span>
              </Link>
              <button
                onClick={() => {
                  signOut()
                  setMobileMenuOpen(false)
                }}
                className="flex items-center gap-2 text-red-500 w-full text-left py-2"
              >
                <LogOut className="h-5 w-5" /> Sign Out
              </button>
            </div>
          ) : (
            <div className="pt-4 border-t border-[var(--border)]">
              <button
                onClick={() => {
                  handleDemoLogin()
                  setMobileMenuOpen(false)
                }}
                className="w-full text-center bg-[var(--foreground)] text-[var(--surface)] py-3 text-[15px] font-semibold rounded-[12px] hover:opacity-90 active:scale-[0.98]"
              >
                Connect
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  )
}

