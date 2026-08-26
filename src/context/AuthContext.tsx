'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { User } from '@supabase/supabase-js'
import { User as DbUser, Notification } from '@/types'

interface AuthContextType {
  user: User | null
  profile: DbUser | null
  loading: boolean
  notification: Notification | null
  clearNotification: () => void
  signOut: () => Promise<void>
  loginWithEmail: (email: string) => Promise<{ success: boolean; error?: string }>
  demoLogin: () => Promise<{ success: boolean; error?: string }>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<DbUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [notification, setNotification] = useState<Notification | null>(null)

  const supabase = createClient()

  // Refresh profile details from DB
  const refreshProfile = async (uid?: string) => {
    const userId = uid || user?.id
    if (!userId) return

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()

    if (!error && data) {
      setProfile(data)
    }
  }

  useEffect(() => {
    // 1. Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          setUser(session.user)
          // Fetch corresponding DB profile
          const { data: dbUser } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single()
          setProfile(dbUser)
        }
      } catch (err) {
        console.error('Error fetching session:', err)
      } finally {
        setLoading(false)
      }
    }

    getInitialSession()

    // 2. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session) {
          setUser(session.user)
          const { data: dbUser } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single()
          setProfile(dbUser)
        } else {
          setUser(null)
          setProfile(null)
        }
        setLoading(false)
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  // 3. Real-time Notification listener for the logged-in user
  useEffect(() => {
    if (!user) {
            setNotification(null)
      return
    }

    // Subscribe to notifications for this specific user
    const channel = supabase
      .channel(`realtime-notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('Real-time notification received:', payload)
          const newNotif = payload.new as Notification
          setNotification(newNotif)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  // Easy Login/Signup via Magic Link / OTP
  const loginWithEmail = async (email: string) => {
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (error) throw error
      return { success: true }
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message }
    }
  }

  // Fast Frictionless Demo Login (anonymous/random email)
  const demoLogin = async () => {
    try {
      const randomId = Math.random().toString(36).substring(2, 8)
      const email = `player_${randomId}@replaceme.lol`
      const password = `Pass_${randomId}_123!`
      const username = `player_${randomId}`
      const displayName = `Challenger ${randomId.toUpperCase()}`

      // Sign up the user (triggers DB hook to insert into public.users)
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username,
            display_name: displayName,
            website_url: 'https://replaceme.lol',
          },
        },
      })

      if (error) throw error

      // If user is not auto-logged in, sign in
      if (!data.session) {
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (signInErr) throw signInErr
      }

      return { success: true }
    } catch (err: unknown) {
      console.error('Demo login failed:', err)
      return { success: false, error: (err as Error).message }
    }
  }

  const clearNotification = () => {
    setNotification(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        notification,
        clearNotification,
        signOut,
        loginWithEmail,
        demoLogin,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
