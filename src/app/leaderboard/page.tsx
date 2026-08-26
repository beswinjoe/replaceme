'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/Header'
import { createClient } from '@/utils/supabase/client'
import Link from 'next/link'
import { Crown, Skull, DollarSign, Swords, Flame } from 'lucide-react'

type LeaderboardTab = 'reign' | 'replacements' | 'spenders' | 'replaced' | 'biggest'

interface LeaderboardItem {
  websiteUrl: string
  websiteName: string
  websiteLogo: string
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
          previous_website_url,
          previous_website_name,
          previous_website_logo,
          new_website_url,
          new_website_name,
          new_website_logo
        `)

      if (error) {
        throw new Error(error.message || 'Supabase error occurred while fetching replacements')
      }
      
      if (!replacements) {
        throw new Error('No data returned from replacements table')
      }

      const reignMap = new Map<string, { url: string; name: string; logo: string; maxDuration: number }>()
      const replacementsMap = new Map<string, { url: string; name: string; logo: string; count: number }>()
      const spenderMap = new Map<string, { url: string; name: string; logo: string; total: number }>()
      const replacedMap = new Map<string, { url: string; name: string; logo: string; count: number }>()

      replacements.forEach((rep) => {
        const amount = Number(rep.amount_paid)
        const duration = Number(rep.previous_holder_duration || 0)

        // Previous holder logic
        if (rep.previous_website_url && rep.previous_website_url !== 'replaceme.lol') {
          const current = reignMap.get(rep.previous_website_url)
          if (!current || duration > current.maxDuration) {
            reignMap.set(rep.previous_website_url, { url: rep.previous_website_url, name: rep.previous_website_name, logo: rep.previous_website_logo, maxDuration: duration })
          }

          const currentReplaced = replacedMap.get(rep.previous_website_url)
          replacedMap.set(rep.previous_website_url, { url: rep.previous_website_url, name: rep.previous_website_name, logo: rep.previous_website_logo, count: (currentReplaced?.count || 0) + 1 })
        }

        // New holder logic
        if (rep.new_website_url && rep.new_website_url !== 'replaceme.lol') {
          const currentRep = replacementsMap.get(rep.new_website_url)
          replacementsMap.set(rep.new_website_url, { url: rep.new_website_url, name: rep.new_website_name, logo: rep.new_website_logo, count: (currentRep?.count || 0) + 1 })

          const currentSpend = spenderMap.get(rep.new_website_url)
          spenderMap.set(rep.new_website_url, { url: rep.new_website_url, name: rep.new_website_name, logo: rep.new_website_logo, total: (currentSpend?.total || 0) + amount })
        }
      })

      const reignArr: LeaderboardItem[] = Array.from(reignMap.values())
        .map((data) => ({
          websiteUrl: data.url,
          websiteName: data.name,
          websiteLogo: data.logo,
          score: data.maxDuration,
          formattedScore: formatDuration(data.maxDuration),
        }))
        .sort((a, b) => b.score - a.score)

      const replacementsArr: LeaderboardItem[] = Array.from(replacementsMap.values())
        .map((data) => ({
          websiteUrl: data.url,
          websiteName: data.name,
          websiteLogo: data.logo,
          score: data.count,
          formattedScore: `${data.count} times`,
        }))
        .sort((a, b) => b.score - a.score)

      const spendersArr: LeaderboardItem[] = Array.from(spenderMap.values())
        .map((data) => ({
          websiteUrl: data.url,
          websiteName: data.name,
          websiteLogo: data.logo,
          score: data.total,
          formattedScore: `$${data.total.toFixed(2)}`,
        }))
        .sort((a, b) => b.score - a.score)

      const replacedArr: LeaderboardItem[] = Array.from(replacedMap.values())
        .map((data) => ({
          websiteUrl: data.url,
          websiteName: data.name,
          websiteLogo: data.logo,
          score: data.count,
          formattedScore: `${data.count} times`,
        }))
        .sort((a, b) => b.score - a.score)

      const biggestArr: LeaderboardItem[] = replacements
        .map((rep) => {
          const amount = Number(rep.amount_paid)
          return {
            websiteUrl: rep.new_website_url || '',
            websiteName: rep.new_website_name || '',
            websiteLogo: rep.new_website_logo || '',
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
          desc: 'Websites that held onto the #1 throne for the longest total duration.',
          icon: <Crown className="w-5 h-5 text-yellow-500" />,
          list: longestReigns,
        }
      case 'replacements':
        return {
          title: 'Most Replacements',
          desc: 'Websites that have successfully usurped the #1 spot the most times.',
          icon: <Skull className="w-5 h-5 text-gray-500" />,
          list: mostReplacements,
        }
      case 'spenders':
        return {
          title: 'Biggest Spenders',
          desc: 'Websites that spent the most capital taking back their pride.',
          icon: <DollarSign className="w-5 h-5 text-green-500" />,
          list: biggestSpenders,
        }
      case 'replaced':
        return {
          title: 'Most Replaced',
          desc: 'Websites that got kicked off the #1 spot the most times.',
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
                    key={`${item.websiteUrl}-${index}`}
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
                      
                      <Link href={`/${item.websiteUrl}`} className="flex items-center gap-3">
                        {item.websiteLogo ? (
                          <img
                            src={item.websiteLogo}
                            alt={item.websiteName}
                            className="w-12 h-12 rounded-[10px] object-cover border border-[var(--border-soft)] shadow-sm bg-[var(--surface)]"
                          />
                        ) : (
                          <div className="w-12 h-12 text-sm border border-[var(--border-soft)] shadow-sm rounded-[10px] bg-[var(--surface-elevated)] flex items-center justify-center font-bold">W</div>
                        )}
                        <div>
                          <p className="font-bold text-[var(--foreground)] group-hover:text-[var(--accent)] transition-colors">
                            {item.websiteName}
                          </p>
                          <p className="text-sm font-medium text-gray-500">
                            {item.websiteUrl}
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
