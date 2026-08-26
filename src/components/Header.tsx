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

  // Ensure theme toggle only renders after mount to avoid hydration mismatch
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
    <header className="sticky top-0 z-40 w-full bg-[var(--surface)] border-b border-[var(--border-soft)]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo & Live Status */}
          <div className="flex items-center gap-4">
            <Link href="/" className="text-xl md:text-2xl font-black tracking-tight hover:text-[var(--accent)] transition-colors">
              REPLACEME
            </Link>
            <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 bg-[var(--surface-elevated)] border border-[var(--border-soft)] rounded-full">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--foreground)]">LIVE</span>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-6 text-sm font-semibold tracking-wide">
            <Link href="/history" className="hover:text-[var(--accent)] transition-colors">
              History
            </Link>
            <Link href="/leaderboard" className="hover:text-[var(--accent)] transition-colors">
              Leaderboard
            </Link>
            <Link href="/#how-it-works" className="hover:text-[var(--accent)] transition-colors">
              How it works
            </Link>
            
            <div className="h-4 w-px bg-[var(--border-soft)] mx-2" />

            {/* Theme Toggle */}
            {mounted && (
              <button
                onClick={toggleTheme}
                className="p-1.5 text-gray-500 hover:text-[var(--foreground)] transition-colors rounded-full hover:bg-[var(--surface-elevated)]"
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
            )}

            {/* User Area */}
            {loading ? (
              <div className="h-9 w-24 bg-[var(--surface-elevated)] animate-pulse rounded-full" />
            ) : user && profile ? (
              <div className="relative">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-[var(--surface-elevated)] border border-[var(--border-soft)] rounded-full hover:bg-[var(--border-soft)] transition-colors"
                >
                  {profile.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={profile.username}
                      className="h-6 w-6 rounded-full object-cover"
                    />
                  ) : (
                    <div className="h-6 w-6 rounded-full bg-gray-300 dark:bg-gray-700" />
                  )}
                  <span className="text-sm font-semibold">@{profile.username}</span>
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-[var(--surface)] border border-[var(--border-soft)] rounded-xl shadow-lg z-50 py-1">
                    <Link
                      href={`/profile/${profile.username}`}
                      onClick={() => setDropdownOpen(false)}
                      className="flex w-full items-center gap-2 px-4 py-2 text-sm hover:bg-[var(--surface-elevated)] transition-colors"
                    >
                      <UserIcon className="h-4 w-4" /> My Profile
                    </Link>
                    <button
                      onClick={() => {
                        signOut()
                        setDropdownOpen(false)
                      }}
                      className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-500 hover:bg-[var(--surface-elevated)] transition-colors"
                    >
                      <LogOut className="h-4 w-4" /> Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={handleDemoLogin}
                className="bg-[var(--foreground)] text-[var(--background)] px-5 py-2 text-sm font-bold rounded-full hover:opacity-90 transition-opacity"
              >
                CONNECT
              </button>
            )}
          </nav>

          {/* Mobile Menu Button */}
          <div className="flex items-center gap-4 md:hidden">
            {mounted && (
              <button
                onClick={toggleTheme}
                className="p-1.5 text-gray-500 hover:text-[var(--foreground)] transition-colors"
              >
                {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </button>
            )}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-1.5 text-[var(--foreground)]"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="border-t border-[var(--border-soft)] bg-[var(--surface)] md:hidden py-4 px-6 space-y-4 font-semibold">
          <Link
            href="/history"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 hover:text-[var(--accent)]"
          >
            History
          </Link>
          <Link
            href="/leaderboard"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 hover:text-[var(--accent)]"
          >
            Leaderboard
          </Link>
          <Link
            href="/#how-it-works"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 hover:text-[var(--accent)]"
          >
            How it works
          </Link>

          {user && profile ? (
            <div className="pt-4 border-t border-[var(--border-soft)] space-y-4">
              <Link
                href={`/profile/${profile.username}`}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 py-2"
              >
                <img
                  src={profile.avatar_url || ''}
                  alt={profile.username}
                  className="h-8 w-8 rounded-full object-cover"
                />
                <span>@{profile.username}</span>
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
            <div className="pt-4 border-t border-[var(--border-soft)]">
              <button
                onClick={() => {
                  handleDemoLogin()
                  setMobileMenuOpen(false)
                }}
                className="w-full text-center bg-[var(--foreground)] text-[var(--background)] py-3 font-bold rounded-xl"
              >
                CONNECT
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  )
}
