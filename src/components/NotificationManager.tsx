'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { ReplacedOverlay } from './ReplacedOverlay'
import { X } from 'lucide-react'

export function NotificationManager() {
  const { notification, clearNotification } = useAuth()
  const [showToast, setShowToast] = useState(false)

  useEffect(() => {
    if (notification && notification.type === 'achievement') {
            setShowToast(true)
      // Auto-hide after 6 seconds
      const timer = setTimeout(() => {
        setShowToast(false)
        clearNotification()
      }, 6000)
      return () => clearTimeout(timer)
    }
  }, [notification])

  const handleCloseToast = () => {
    setShowToast(false)
    clearNotification()
  }

  return (
    <>
      <ReplacedOverlay />

      {notification?.type === 'achievement' && showToast && (
        <div className="fixed top-6 right-6 z-50 w-full max-w-md border-4 border-neon-yellow bg-black p-4 brutalist-shadow-yellow text-white animate-in slide-in-from-top-10 duration-300">
          <div className="flex items-start gap-3">
            <div className="text-3xl p-1 bg-zinc-900 border-2 border-white">
              🏆
            </div>
            <div className="flex-1">
              <h4 className="font-black text-neon-yellow text-lg uppercase tracking-wider">
                ACHIEVEMENT UNLOCKED!
              </h4>
              <p className="font-bold text-white uppercase text-sm mt-1">
                {notification.title.replace('ACHIEVEMENT UNLOCKED: ', '')}
              </p>
              <p className="text-zinc-400 text-xs mt-1">
                {notification.message}
              </p>
            </div>
            <button
              onClick={handleCloseToast}
              className="text-zinc-400 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
