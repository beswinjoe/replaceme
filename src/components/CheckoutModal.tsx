'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { createClient } from '@/utils/supabase/client'
import { X, Sparkles, AlertCircle, RefreshCcw, Share } from 'lucide-react'
import confetti from 'canvas-confetti'

interface CheckoutModalProps {
  isOpen: boolean
  onClose: () => void
  currentPrice: number
  currentUsername: string
  prefilledData?: {
    username: string
    message: string
    link: string
  }
}

const AVATAR_STYLES = ['pixel-art', 'bottts', 'adventurer', 'lorelei']

export function CheckoutModal({ isOpen, onClose, currentPrice, currentUsername, prefilledData }: CheckoutModalProps) {
  const { user, profile, refreshProfile, demoLogin, loginWithEmail } = useAuth()
  const [activeTab, setActiveTab] = useState<'auth' | 'edit'>('auth')
  
  // Auth Form State
  const [email, setEmail] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [authMsg, setAuthMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Profile/Checkout Details State
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [customMessage, setCustomMessage] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [paymentLoading, setPaymentLoading] = useState(false)
  const [paymentError, setPaymentError] = useState<string | null>(null)

  // Demo Success state
  const [victoryDetails, setVictoryDetails] = useState<{
    amountPaid: number
    previousUser: string
    newPrice: number
  } | null>(null)

  useEffect(() => {
    if (user) {
      setActiveTab('edit')
      
      setUsername(prefilledData?.username || profile?.username || '')
      setDisplayName(profile?.display_name || '')
      setAvatarUrl(profile?.avatar_url || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${Math.random()}`)
      setWebsiteUrl(prefilledData?.link || profile?.website_url || '')
      setCustomMessage(prefilledData?.message || `I just paid $${currentPrice.toFixed(2)} to take #1.`)
    } else {
      setActiveTab('auth')
      
      if (prefilledData) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setUsername(prefilledData.username)
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCustomMessage(prefilledData.message)
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setWebsiteUrl(prefilledData.link)
      }
    }
  }, [user, profile, isOpen, prefilledData, currentPrice])

  if (!isOpen) return null

  // Sign In / Sign Up handler
  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return
    setAuthLoading(true)
    setAuthMsg(null)

    const res = await loginWithEmail(email)
    setAuthLoading(false)

    if (res.success) {
      setAuthMsg({
        type: 'success',
        text: 'Check your email for the magic link to log in.',
      })
    } else {
      setAuthMsg({ type: 'error', text: res.error || 'Failed to authenticate.' })
    }
  }

  const handleInstantConnect = async () => {
    setAuthLoading(true)
    setAuthMsg(null)
    const res = await demoLogin()
    setAuthLoading(false)
    if (!res.success) {
      setAuthMsg({ type: 'error', text: res.error || 'Demo connection failed.' })
    }
  }

  // Avatar Randomizer
  const randomizeAvatar = () => {
    const randomStyle = AVATAR_STYLES[Math.floor(Math.random() * AVATAR_STYLES.length)]
    const randomSeed = Math.random().toString(36).substring(7)
    setAvatarUrl(`https://api.dicebear.com/7.x/${randomStyle}/svg?seed=${randomSeed}`)
  }

  // Pay/Simulate Handler
  const handlePayment = async (isDemo: boolean = false) => {
    setPaymentLoading(true)
    setPaymentError(null)

    if (!username.match(/^[a-zA-Z0-9_]{3,15}$/)) {
      setPaymentError('Username must be 3-15 alphanumeric characters.')
      setPaymentLoading(false)
      return
    }

    if (!customMessage.trim()) {
      setPaymentError('Custom message is required.')
      setPaymentLoading(false)
      return
    }

    const payload = {
      username,
      display_name: displayName || username,
      avatar_url: avatarUrl,
      custom_message: customMessage,
      website_url: websiteUrl,
    }

    try {
      if (isDemo) {
        const response = await fetch('/api/checkout/demo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        const resData = await response.json()
        if (!response.ok) throw new Error(resData.error || 'Simulation failed')

        // Minimal, elegant confetti
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.5 },
          colors: ['#2563eb', '#3b82f6', '#60a5fa', '#ffffff'],
          disableForReducedMotion: true
        })

        setVictoryDetails({
          amountPaid: currentPrice,
          previousUser: currentUsername,
          newPrice: resData.newPrice,
        })
        await refreshProfile()
      } else {
        const response = await fetch('/api/checkout', {
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
      }
    } catch (err: any) {
      console.error(err)
      setPaymentError(err.message || 'Payment initiation failed. Please try again.')
    } finally {
      setPaymentLoading(false)
    }
  }

  const handleShare = () => {
    if (!profile) return
    const text = `I just became #1 on ReplaceMe.\n\nWho's replacing me next? 👑\n\nhttps://replaceme.lol`
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank')
  }
  
  const handleCopyLink = () => {
    navigator.clipboard.writeText('https://replaceme.lol')
    alert('Link copied!')
  }

  // SUCCESS STATE
  if (victoryDetails) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
        <div className="w-full max-w-lg bg-[var(--surface)] border border-[var(--border-soft)] rounded-3xl p-8 md:p-10 text-center shadow-2xl animate-in zoom-in-95 duration-300">
          <div className="mx-auto w-16 h-16 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 rounded-full flex items-center justify-center text-3xl mb-6 shadow-sm border border-yellow-200 dark:border-yellow-700/50">
            👑
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-[var(--foreground)] mb-2">
            You&apos;re #1.
          </h1>
          <p className="text-lg text-gray-500 font-medium mb-8">
            <span className="font-semibold text-[var(--foreground)]">@{victoryDetails.previousUser}</span> has been replaced.
          </p>

          <div className="bg-[var(--surface-elevated)] border border-[var(--border-soft)] rounded-2xl p-6 mb-8 text-center space-y-2">
             <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">You paid</p>
             <p className="text-4xl font-bold text-[var(--accent)] tracking-tight">${victoryDetails.amountPaid.toFixed(2)}</p>
             <p className="text-xs text-gray-400 mt-2 pt-2 border-t border-[var(--border-soft)]">Your reign has started.</p>
          </div>

          <div className="space-y-6">
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)] mb-3">Share your victory</p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={handleShare}
                  className="flex items-center gap-2 bg-[#000000] dark:bg-white text-white dark:text-black px-6 py-2.5 rounded-full font-semibold text-sm hover:opacity-90 transition-opacity"
                >
                  <span className="w-4 h-4 text-center leading-none flex items-center justify-center font-bold">X</span> Share on X
                </button>
                <button
                  onClick={handleCopyLink}
                  className="flex items-center gap-2 bg-[var(--surface-elevated)] text-[var(--foreground)] border border-[var(--border-soft)] px-6 py-2.5 rounded-full font-semibold text-sm hover:bg-[var(--border-soft)] transition-colors"
                >
                  <Share className="w-4 h-4" /> Copy link
                </button>
              </div>
            </div>
            
            <button
              onClick={() => {
                setVictoryDetails(null)
                onClose()
              }}
              className="text-gray-500 hover:text-[var(--foreground)] font-medium text-sm transition-colors"
            >
              Return to leaderboard
            </button>
          </div>
        </div>
      </div>
    )
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
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-[var(--foreground)] mb-2">
              You&apos;re replacing @{currentUsername}
            </h2>
            <p className="text-gray-500 text-sm">
              Take the top spot for <span className="font-semibold text-[var(--foreground)]">${currentPrice.toFixed(2)}</span>
            </p>
          </div>

          <div className="space-y-6">
            {/* Step 1: Authentication */}
            {activeTab === 'auth' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                <div>
                  <h3 className="font-semibold text-[var(--foreground)] text-lg mb-1">1. Connect</h3>
                  <p className="text-sm text-gray-500 mb-4">Log in to claim your spot and save your stats.</p>
                </div>

                <form onSubmit={handleEmailAuth} className="space-y-3">
                  <input
                    type="email"
                    required
                    placeholder="Enter your email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-[var(--surface-elevated)] border border-[var(--border-soft)] p-3.5 rounded-xl text-[var(--foreground)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  />
                  <button
                    type="submit"
                    disabled={authLoading}
                    className="w-full bg-[var(--foreground)] text-[var(--background)] py-3.5 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity"
                  >
                    {authLoading ? 'Sending...' : 'Continue with Email'}
                  </button>
                </form>

                {authMsg && (
                  <div className={`p-3 rounded-lg text-sm font-medium ${
                    authMsg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
                  }`}>
                    {authMsg.text}
                  </div>
                )}

                <div className="relative py-4">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-[var(--border-soft)]" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase font-medium">
                    <span className="bg-[var(--surface)] px-2 text-gray-400">Or</span>
                  </div>
                </div>

                <button
                  onClick={handleInstantConnect}
                  disabled={authLoading}
                  className="w-full flex items-center justify-center gap-2 bg-[var(--surface-elevated)] border border-[var(--border-soft)] text-[var(--foreground)] py-3.5 rounded-xl font-bold text-sm hover:bg-[var(--border-soft)] transition-colors"
                >
                  <Sparkles className="h-4 w-4" /> Instant Connect (Demo)
                </button>
              </div>
            )}

            {/* Step 2: Edit Details */}
            {activeTab === 'edit' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-[var(--foreground)] text-lg">2. Profile Setup</h3>
                  <button onClick={() => setActiveTab('auth')} className="text-xs font-semibold text-gray-500 hover:text-[var(--foreground)] underline">Connected as @{username}</button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Username</label>
                    <input
                      type="text"
                      maxLength={15}
                      required
                      placeholder="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                      className="w-full bg-[var(--surface-elevated)] border border-[var(--border-soft)] p-3 rounded-xl text-[var(--foreground)] text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Display Name</label>
                    <input
                      type="text"
                      maxLength={20}
                      placeholder="Optional"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full bg-[var(--surface-elevated)] border border-[var(--border-soft)] p-3 rounded-xl text-[var(--foreground)] text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Message</label>
                  <textarea
                    rows={2}
                    maxLength={100}
                    required
                    placeholder="Say something..."
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    className="w-full bg-[var(--surface-elevated)] border border-[var(--border-soft)] p-3 rounded-xl text-[var(--foreground)] text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent)] resize-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Link (Optional)</label>
                  <input
                    type="url"
                    placeholder="https://yourwebsite.com"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    className="w-full bg-[var(--surface-elevated)] border border-[var(--border-soft)] p-3 rounded-xl text-[var(--foreground)] text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                  />
                </div>
                
                <div className="pt-2 flex items-center justify-between">
                   <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
                     <button onClick={randomizeAvatar} type="button" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-soft)] hover:bg-[var(--surface-elevated)] transition-colors">
                        <RefreshCcw className="w-3 h-3" /> Roll Avatar
                     </button>
                   </div>
                </div>

                {paymentError && (
                  <div className="flex items-start gap-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-xl text-sm border border-red-100 dark:border-red-800">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <p>{paymentError}</p>
                  </div>
                )}

                <div className="pt-4 space-y-3">
                  <button
                    onClick={() => handlePayment(false)}
                    disabled={paymentLoading || !username || !customMessage}
                    className="w-full bg-[var(--accent)] text-white py-3.5 rounded-xl font-bold text-base hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                  >
                    {paymentLoading ? 'Processing...' : `Continue to payment — $${currentPrice.toFixed(2)}`}
                  </button>
                  
                  {process.env.NEXT_PUBLIC_DEMO_MODE === 'true' && (
                    <button
                      onClick={() => handlePayment(true)}
                      disabled={paymentLoading || !username || !customMessage}
                      className="w-full flex items-center justify-center gap-2 bg-[var(--surface-elevated)] border border-[var(--border-soft)] text-[var(--foreground)] py-3 rounded-xl font-semibold text-sm hover:bg-[var(--border-soft)] transition-colors disabled:opacity-50"
                    >
                       Simulate Demo Payment
                    </button>
                  )}
                </div>
              </div>
            )}
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
              <img
                src={avatarUrl || 'https://api.dicebear.com/7.x/pixel-art/svg?seed=preview'}
                alt="preview avatar"
                className="w-12 h-12 rounded-full border border-[var(--border-soft)] bg-gray-100 dark:bg-gray-800 object-cover"
              />
              <div>
                <h4 className="font-bold text-[var(--foreground)] truncate max-w-[160px]">
                  {displayName || 'Your Name'}
                </h4>
                <p className="text-sm text-gray-500 truncate max-w-[160px]">
                  @{username || 'username'}
                </p>
              </div>
            </div>

            <div className="text-sm font-medium text-[var(--foreground)] mb-4 italic break-words">
              &quot;{customMessage || 'Your message will appear here.'}&quot;
            </div>

            {websiteUrl && (
              <div className="text-xs font-semibold text-[var(--accent)] truncate flex items-center gap-1.5">
                🔗 {websiteUrl.replace(/^https?:\/\//, '')}
              </div>
            )}
          </div>
          
          <div className="mt-8 text-center">
             <h3 className="text-lg font-semibold text-[var(--foreground)]">You will replace @{currentUsername}.</h3>
          </div>
        </div>

      </div>
    </div>
  )
}
