'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/Header'
import { createClient } from '@/utils/supabase/client'
import Link from 'next/link'
import { Crown, Skull, DollarSign, Swords, Flame } from 'lucide-react'
import { InitialsAvatar } from '@/components/InitialsAvatar'

type LeaderboardTab = 'reign' | 'replacements' | 'spenders' | 'replaced' | 'biggest'

interface LeaderboardItem {
  userId: string
  username: string
  displayName: string
  avatarUrl: string
  score: number
  formattedScore: string
}

export default function LeaderboardPage() {
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState<LeaderboardTab>('reign')
  const [loading, setLoading] = useState(true)
  
  const [longestReigns, setLongestReigns] = useState<LeaderboardItem[]>([])
  const [mostReplacements, setMostReplacements] = useState<LeaderboardItem[]>([])
  const [biggestSpenders, setBiggestSpenders] = useState<LeaderboardItem[]>([])
  const [mostReplaced, setMostReplaced] = useState<LeaderboardItem[]>([])
  const [biggestReplacements, setBiggestReplacements] = useState<LeaderboardItem[]>([])

  const formatDuration = (sec: number) => {
    if (sec < 60) return `${Math.round(sec)}s`
    const mins = Math.floor(sec / 60)
    if (mins < 60) return `${mins}m`
    const hours = Math.floor(mins / 60)
    const remainingMins = mins % 60
    return `${hours}h ${remainingMins}m`
  }

  const calculateLeaderboards = async () => {
    setLoading(true)
    try {
      const { data: replacements, error } = await supabase
        .from('replacements')
        .select(`
          amount_paid,
          previous_holder_duration,
          previous_user_id,
          new_user_id,
          new_user:users!replacements_new_user_id_fkey(*),
          previous_user:users!replacements_previous_user_id_fkey(*)
        `)

      if (error) {
        throw new Error(error.message || 'Supabase error occurred while fetching replacements')
      }
      
      if (!replacements) {
        throw new Error('No data returned from replacements table')
      }

      const reignMap = new Map<string, { user: any; maxDuration: number }>()
      const replacementsMap = new Map<string, { user: any; count: number }>()
      const spenderMap = new Map<string, { user: any; total: number }>()
      const replacedMap = new Map<string, { user: any; count: number }>()

      replacements.forEach((rep) => {
        const newUser = rep.new_user as any
        const prevUser = rep.previous_user as any
        const amount = Number(rep.amount_paid)
        const duration = Number(rep.previous_holder_duration || 0)

        if (prevUser && prevUser.id !== '00000000-0000-0000-0000-000000000000') {
          const current = reignMap.get(prevUser.id)
          if (!current || duration > current.maxDuration) {
            reignMap.set(prevUser.id, { user: prevUser, maxDuration: duration })
          }
        }

        if (newUser && newUser.id !== '00000000-0000-0000-0000-000000000000') {
          const current = replacementsMap.get(newUser.id)
          replacementsMap.set(newUser.id, { user: newUser, count: (current?.count || 0) + 1 })
        }

        if (newUser && newUser.id !== '00000000-0000-0000-0000-000000000000') {
          const current = spenderMap.get(newUser.id)
          spenderMap.set(newUser.id, { user: newUser, total: (current?.total || 0) + amount })
        }

        if (prevUser && prevUser.id !== '00000000-0000-0000-0000-000000000000') {
          const current = replacedMap.get(prevUser.id)
          replacedMap.set(prevUser.id, { user: prevUser, count: (current?.count || 0) + 1 })
        }
      })

      const reignArr: LeaderboardItem[] = Array.from(reignMap.values())
        .map(({ user, maxDuration }) => ({
          userId: user.id,
          username: user.username,
          displayName: user.display_name || user.username,
          avatarUrl: user.avatar_url || '',
          score: maxDuration,
          formattedScore: formatDuration(maxDuration),
        }))
        .sort((a, b) => b.score - a.score)

      const replacementsArr: LeaderboardItem[] = Array.from(replacementsMap.values())
        .map(({ user, count }) => ({
          userId: user.id,
          username: user.username,
          displayName: user.display_name || user.username,
          avatarUrl: user.avatar_url || '',
          score: count,
          formattedScore: `${count} times`,
        }))
        .sort((a, b) => b.score - a.score)

      const spendersArr: LeaderboardItem[] = Array.from(spenderMap.values())
        .map(({ user, total }) => ({
          userId: user.id,
          username: user.username,
          displayName: user.display_name || user.username,
          avatarUrl: user.avatar_url || '',
          score: total,
          formattedScore: `$${total.toFixed(2)}`,
        }))
        .sort((a, b) => b.score - a.score)

      const replacedArr: LeaderboardItem[] = Array.from(replacedMap.values())
        .map(({ user, count }) => ({
          userId: user.id,
          username: user.username,
          displayName: user.display_name || user.username,
          avatarUrl: user.avatar_url || '',
          score: count,
          formattedScore: `${count} times`,
        }))
        .sort((a, b) => b.score - a.score)

      const biggestArr: LeaderboardItem[] = replacements
        .map((rep) => {
          const user = rep.new_user as any
          const amount = Number(rep.amount_paid)
          return {
            userId: user?.id || '',
            username: user?.username || 'someone',
            displayName: user?.display_name || user?.username || 'someone',
            avatarUrl: user?.avatar_url || '',
            score: amount,
            formattedScore: `$${amount.toFixed(2)}`,
          }
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 50)

      setLongestReigns(reignArr)
      setMostReplacements(replacementsArr)
      setBiggestSpenders(spendersArr)
      setMostReplaced(replacedArr)
      setBiggestReplacements(biggestArr)

    } catch (err: any) {
      console.error('Failed to calculate leaderboards:', err.message || err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    calculateLeaderboards()
  }, [])

  const getActiveData = (): { title: string; desc: string; icon: any; list: LeaderboardItem[] } => {
    switch (activeTab) {
      case 'reign':
        return {
          title: 'Longest Reigns',
          desc: 'Users who held onto the #1 throne for the longest total duration.',
          icon: <Crown className="w-5 h-5 text-yellow-500" />,
          list: longestReigns,
        }
      case 'replacements':
        return {
          title: 'Most Replacements',
          desc: 'Users who have successfully usurped the #1 spot the most times.',
          icon: <Skull className="w-5 h-5 text-gray-500" />,
          list: mostReplacements,
        }
      case 'spenders':
        return {
          title: 'Biggest Spenders',
          desc: 'Users who spent the most capital taking back their pride.',
          icon: <DollarSign className="w-5 h-5 text-green-500" />,
          list: biggestSpenders,
        }
      case 'replaced':
        return {
          title: 'Most Replaced',
          desc: 'Users who got kicked off the #1 spot the most times.',
          icon: <Swords className="w-5 h-5 text-orange-500" />,
          list: mostReplaced,
        }
      case 'biggest':
        return {
          title: 'Biggest Replacement',
          desc: 'The single most expensive throne takeovers on record.',
          icon: <Flame className="w-5 h-5 text-red-500" />,
          list: biggestReplacements,
        }
    }
  }

  const activeData = getActiveData()

  return (
    <>
      <Header />
      <main className="flex-1 max-w-4xl mx-auto w-full py-12 px-4 space-y-12">
        
        {/* Title */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-[var(--foreground)]">
            Leaderboard
          </h1>
          <p className="text-lg text-gray-500 font-medium">
            The hall of fame and infamy.
          </p>
        </div>

        {/* Tab Selection */}
        <div className="flex flex-wrap gap-2 justify-center pb-4">
          {(['reign', 'replacements', 'spenders', 'replaced', 'biggest'] as LeaderboardTab[]).map((tab) => {
            const isActive = activeTab === tab
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-5 py-2.5 rounded-full font-semibold text-sm transition-all ${
                  isActive
                    ? 'bg-[var(--foreground)] text-[var(--background)] shadow-sm'
                    : 'bg-[var(--surface-elevated)] border border-[var(--border-soft)] text-gray-500 hover:text-[var(--foreground)]'
                }`}
              >
                {tab === 'reign' && 'Longest Reigns'}
                {tab === 'replacements' && 'Most Replacements'}
                {tab === 'spenders' && 'Biggest Spenders'}
                {tab === 'replaced' && 'Most Replaced'}
                {tab === 'biggest' && 'Biggest Replacements'}
              </button>
            )
          })}
        </div>

        {/* Active Board */}
        <div className="bg-[var(--surface)] border border-[var(--border-soft)] rounded-3xl p-6 md:p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 bg-[var(--surface-elevated)] rounded-xl border border-[var(--border-soft)]">
              {activeData.icon}
            </div>
            <div>
              <h2 className="text-xl font-bold text-[var(--foreground)]">{activeData.title}</h2>
              <p className="text-sm font-medium text-gray-500">{activeData.desc}</p>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-20 font-semibold text-gray-500 animate-pulse">
              Loading Leaderboard...
            </div>
          ) : activeData.list.length === 0 ? (
            <div className="text-center py-20 text-gray-500 font-medium">
              No data available yet.
            </div>
          ) : (
            <div className="space-y-3">
              {activeData.list.map((item, index) => {
                const rank = index + 1
                return (
                  <div
                    key={`${item.userId}-${index}`}
                    className="flex items-center justify-between p-4 rounded-2xl hover:bg-[var(--surface-elevated)] transition-colors group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-8 text-center">
                        <span className={`text-lg font-bold ${
                          rank === 1 ? 'text-yellow-500' : rank === 2 ? 'text-gray-400' : rank === 3 ? 'text-orange-400' : 'text-gray-400 dark:text-gray-600'
                        }`}>
                          {rank <= 3 ? `#${rank}` : `#${rank}`}
                        </span>
                      </div>
                      
                      <Link href={`/@${item.username}`} className="flex items-center gap-3">
                        {item.avatarUrl ? (
                          <img
                            src={item.avatarUrl}
                            alt={item.username}
                            className="w-12 h-12 rounded-full object-cover border border-[var(--border-soft)] shadow-sm bg-[var(--surface)]"
                          />
                        ) : (
                          <InitialsAvatar
                            name={item.displayName || item.username}
                            className="w-12 h-12 text-sm border border-[var(--border-soft)] shadow-sm"
                          />
                        )}
                        <div>
                          <p className="font-bold text-[var(--foreground)] group-hover:text-[var(--accent)] transition-colors">
                            {item.displayName}
                          </p>
                          <p className="text-sm font-medium text-gray-500">
                            @{item.username}
                          </p>
                        </div>
                      </Link>
                    </div>

                    <div className="font-bold text-lg text-[var(--foreground)] pr-4">
                      {item.formattedScore}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>
    </>
  )
}
