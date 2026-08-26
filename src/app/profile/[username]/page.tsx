'use client'

import { use, useEffect, useState } from 'react'
import { Header } from '@/components/Header'
import { createClient } from '@/utils/supabase/client'
import { Trophy, Swords, Zap, Coins, Hourglass, Calendar, ExternalLink, Link as LinkIcon, User } from 'lucide-react'
import Link from 'next/link'

interface ProfilePageProps {
  params: Promise<{ username: string }>
}

export default function ProfilePage({ params }: ProfilePageProps) {
  const resolvedParams = use(params)
  const username = resolvedParams.username
  const supabase = createClient()

  // States
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [userAchievements, setUserAchievements] = useState<any[]>([])
  const [allAchievements, setAllAchievements] = useState<any[]>([])
  const [personalHistory, setPersonalHistory] = useState<any[]>([])

  // Calculated Stats
  const [stats, setStats] = useState({
    timesNumberOne: 0,
    timesReplaced: 0,
    longestReign: 0,
    totalSpent: 0,
    biggestReplacement: 0,
  })

  const fetchProfileData = async () => {
    setLoading(true)
    try {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .single()

      if (userError || !userData) {
        setProfile(null)
        setLoading(false)
        return
      }

      setProfile(userData)

      const { data: achData } = await supabase.from('achievements').select('*')
      if (achData) setAllAchievements(achData)

      const { data: userAchData } = await supabase
        .from('user_achievements')
        .select('achievement_id, earned_at')
        .eq('user_id', userData.id)

      if (userAchData) setUserAchievements(userAchData)

      const { data: historyData, error: historyError } = await supabase
        .from('replacements')
        .select(`
          id,
          amount_paid,
          previous_holder_duration,
          created_at,
          previous_user:users!replacements_previous_user_id_fkey(id, username),
          new_user:users!replacements_new_user_id_fkey(id, username)
        `)
        .or(`new_user_id.eq.${userData.id},previous_user_id.eq.${userData.id}`)
        .order('created_at', { ascending: false })

      if (!historyError && historyData) {
        setPersonalHistory(historyData)

        let timesNumberOne = 0
        let timesReplaced = 0
        let longestReign = 0
        let totalSpent = 0
        let biggestReplacement = 0

        historyData.forEach((rep: any) => {
          const amount = Number(rep.amount_paid)
          const duration = Number(rep.previous_holder_duration || 0)

          const newUserId = Array.isArray(rep.new_user) ? rep.new_user[0]?.id : rep.new_user?.id
          const prevUserId = Array.isArray(rep.previous_user) ? rep.previous_user[0]?.id : rep.previous_user?.id

          if (newUserId === userData.id) {
            timesNumberOne++
            totalSpent += amount
            if (amount > biggestReplacement) {
              biggestReplacement = amount
            }
          }

          if (prevUserId === userData.id) {
            timesReplaced++
            if (duration > longestReign) {
              longestReign = duration
            }
          }
        })

        setStats({
          timesNumberOne,
          timesReplaced,
          longestReign,
          totalSpent,
          biggestReplacement,
        })
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProfileData()
  }, [username])

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--background)]">
        <div className="text-xl font-semibold animate-pulse text-gray-500">Loading Profile...</div>
      </div>
    )
  }

  if (!profile) {
    return (
      <>
        <Header />
        <main className="flex-1 flex flex-col items-center justify-center py-24 px-4 max-w-lg mx-auto w-full text-center">
          <div className="w-20 h-20 bg-[var(--surface-elevated)] border border-[var(--border-soft)] rounded-full flex items-center justify-center mb-6 text-gray-400">
            <User className="w-10 h-10" />
          </div>
          <h1 className="text-3xl font-bold text-[var(--foreground)] tracking-tight">User Not Found</h1>
          <p className="text-gray-500 font-medium mt-3 mb-8">
            The user @{username} does not exist in the database.
          </p>
          <Link
            href="/"
            className="bg-[var(--foreground)] text-[var(--background)] px-6 py-3 rounded-full font-bold text-sm hover:opacity-90 transition-opacity"
          >
            Return Home
          </Link>
        </main>
      </>
    )
  }

  const formatDuration = (sec: number) => {
    if (sec <= 0) return '0s'
    if (sec < 60) return `${Math.round(sec)}s`
    const mins = Math.floor(sec / 60)
    if (mins < 60) return `${mins}m`
    const hours = Math.floor(mins / 60)
    const remainingMins = mins % 60
    return `${hours}h ${remainingMins}m`
  }

  const isUnlocked = (achId: string) => {
    return userAchievements.some((ua) => ua.achievement_id === achId)
  }

  return (
    <>
      <Header />
      <main className="flex-1 max-w-4xl mx-auto w-full py-12 px-4 space-y-12">
        
        {/* Profile Header */}
        <div className="flex flex-col md:flex-row items-center md:items-start gap-8 bg-[var(--surface)] border border-[var(--border-soft)] rounded-3xl p-8 shadow-sm">
          <img
            src={profile.avatar_url || 'https://api.dicebear.com/7.x/pixel-art/svg?seed=fallback'}
            alt={profile.username}
            className="h-32 w-32 md:h-40 md:w-40 rounded-full border border-[var(--border-soft)] object-cover bg-gray-100 dark:bg-gray-800 shrink-0 shadow-sm"
          />
          
          <div className="text-center md:text-left space-y-3 flex-1 min-w-0 flex flex-col justify-center pt-2">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-[var(--foreground)] truncate">
                {profile.display_name || profile.username}
              </h1>
              <p className="text-lg font-semibold text-gray-500 truncate mt-1">
                @{profile.username}
              </p>
            </div>

            {profile.bio && (
              <p className="text-gray-600 dark:text-gray-300 font-medium max-w-xl leading-relaxed mt-2">
                {profile.bio}
              </p>
            )}

            {profile.website_url && (
              <a
                href={profile.website_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center md:justify-start gap-1.5 text-sm text-[var(--accent)] hover:underline font-semibold mt-3"
              >
                <LinkIcon className="h-4 w-4" /> {profile.website_url.replace(/^https?:\/\//, '')}
              </a>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-[var(--foreground)] mb-4">Platform Stats</h2>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-[var(--surface)] border border-[var(--border-soft)] rounded-2xl p-5 text-center shadow-sm">
              <Trophy className="h-5 w-5 text-yellow-500 mx-auto mb-3" />
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Times #1</p>
              <p className="text-2xl font-bold text-[var(--foreground)]">{stats.timesNumberOne}</p>
            </div>

            <div className="bg-[var(--surface)] border border-[var(--border-soft)] rounded-2xl p-5 text-center shadow-sm">
              <Swords className="h-5 w-5 text-gray-500 dark:text-gray-400 mx-auto mb-3" />
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Replacements</p>
              <p className="text-2xl font-bold text-[var(--foreground)]">{stats.timesNumberOne}</p>
            </div>

            <div className="bg-[var(--surface)] border border-[var(--border-soft)] rounded-2xl p-5 text-center shadow-sm">
              <Zap className="h-5 w-5 text-orange-500 mx-auto mb-3" />
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Times Replaced</p>
              <p className="text-2xl font-bold text-[var(--foreground)]">{stats.timesReplaced}</p>
            </div>

            <div className="bg-[var(--surface)] border border-[var(--border-soft)] rounded-2xl p-5 text-center shadow-sm">
              <Hourglass className="h-5 w-5 text-blue-500 mx-auto mb-3" />
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Longest Reign</p>
              <p className="text-lg md:text-xl font-bold text-[var(--foreground)] truncate pt-0.5">
                {formatDuration(stats.longestReign)}
              </p>
            </div>

            <div className="bg-[var(--surface)] border border-[var(--border-soft)] rounded-2xl p-5 text-center shadow-sm col-span-2 md:col-span-1 flex flex-col justify-center">
              <Coins className="h-5 w-5 text-green-500 mx-auto mb-3" />
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Total Spent</p>
              <p className="text-lg md:text-xl font-bold text-[var(--foreground)] truncate pt-0.5">
                ${stats.totalSpent.toFixed(2)}
              </p>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* History Timeline */}
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-[var(--foreground)] mb-4">Replacement History</h2>
            
            {personalHistory.length === 0 ? (
              <div className="bg-[var(--surface)] border border-[var(--border-soft)] rounded-2xl p-6 text-center text-gray-500 font-medium">
                No battle activity recorded.
              </div>
            ) : (
              <div className="bg-[var(--surface)] border border-[var(--border-soft)] rounded-3xl p-2 shadow-sm overflow-hidden divide-y divide-[var(--border-soft)]">
                {personalHistory.map((rep) => {
                  const isWinner = rep.new_user?.id === profile.id
                  return (
                    <div key={rep.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[var(--surface-elevated)] transition-colors">
                      <div className="flex items-center gap-2">
                        <span className={`flex items-center justify-center w-6 h-6 rounded-full shrink-0 ${isWinner ? 'bg-green-100 text-green-600 dark:bg-green-900/30' : 'bg-red-100 text-red-600 dark:bg-red-900/30'}`}>
                          {isWinner ? '↑' : '↓'}
                        </span>
                        <div className="text-sm font-semibold">
                          <span className="text-gray-500 mr-1.5">{isWinner ? 'Replaced' : 'Replaced by'}</span>
                          <Link
                            href={`/profile/${isWinner ? rep.previous_user?.username : rep.new_user?.username}`}
                            className="text-[var(--foreground)] hover:text-[var(--accent)] transition-colors"
                          >
                            @{isWinner ? rep.previous_user?.username || 'replaceme' : rep.new_user?.username}
                          </Link>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-4 pl-8 sm:pl-0">
                        <span className="text-xs font-medium text-gray-400">
                          {new Date(rep.created_at).toLocaleDateString()}
                        </span>
                        <span className="font-bold text-[var(--foreground)]">
                          ${Number(rep.amount_paid).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          {/* Achievements */}
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-[var(--foreground)] mb-4">
              Achievements <span className="text-gray-400 font-medium text-base ml-2">({userAchievements.length}/{allAchievements.length})</span>
            </h2>

            <div className="space-y-3">
              {allAchievements.map((ach) => {
                const unlocked = isUnlocked(ach.id)
                const earnedDate = userAchievements.find((ua) => ua.achievement_id === ach.id)?.earned_at

                return (
                  <div
                    key={ach.id}
                    className={`flex items-center gap-4 p-4 rounded-2xl border transition-colors ${
                      unlocked
                        ? 'bg-[var(--surface)] border-[var(--border-soft)] shadow-sm'
                        : 'bg-transparent border-dashed border-gray-200 dark:border-gray-800 opacity-60'
                    }`}
                  >
                    <div className="text-3xl shrink-0 p-2 bg-[var(--surface-elevated)] rounded-xl border border-[var(--border-soft)]">
                      {ach.icon}
                    </div>
                    
                    <div className="min-w-0">
                      <h4 className={`font-bold text-sm truncate ${unlocked ? 'text-[var(--foreground)]' : 'text-gray-400'}`}>
                        {ach.name}
                      </h4>
                      <p className={`text-xs mt-0.5 ${unlocked ? 'text-gray-500' : 'text-gray-400'}`}>
                        {ach.description}
                      </p>
                      {unlocked && earnedDate && (
                        <p className="text-[10px] text-gray-400 font-semibold tracking-wider mt-1.5 flex items-center gap-1 uppercase">
                          <Calendar className="h-3 w-3" /> {new Date(earnedDate).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

        </div>
      </main>
    </>
  )
}
