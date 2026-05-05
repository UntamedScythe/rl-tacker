'use client'

import { useState } from 'react'
import { generateAdvice, type Stats, type Tip } from '@/lib/advice'

const PLATFORMS = [
  { value: 'steam', label: 'Steam' },
  { value: 'epic', label: 'Epic' },
  { value: 'ps4', label: 'PlayStation' },
  { value: 'xbox', label: 'Xbox' },
]

type ApiResponse = {
  stats?: Stats
  replayCount?: number
  error?: string
}

const STAT_GROUPS = (stats: Stats) => [
  {
    label: 'Offense',
    color: '#f97316',
    items: [
      { label: 'Goals / Game',   value: stats.goalsPerGame },
      { label: 'Assists / Game', value: stats.assistsPerGame },
      { label: 'Shots / Game',   value: stats.shotsPerGame },
      { label: 'Shot Accuracy',  value: `${stats.shotAccuracy}%` },
    ],
  },
  {
    label: 'Defense',
    color: '#3b82f6',
    items: [
      { label: 'Saves / Game',      value: stats.savesPerGame },
      { label: 'Defensive Third %', value: `${stats.defensivePct}%` },
      { label: 'Demos Taken',       value: stats.demosTakenPerGame },
      { label: 'Avg Score',         value: stats.avgScore },
    ],
  },
  {
    label: 'Boost & Speed',
    color: '#a855f7',
    items: [
      { label: 'Avg Boost',      value: stats.avgBoost },
      { label: 'Boost Stolen',   value: stats.boostStolenPerGame },
      { label: 'Supersonic %',   value: `${stats.supersonicPct}%` },
      { label: 'Slow Speed %',   value: `${stats.slowPct}%` },
    ],
  },
  {
    label: 'Positioning',
    color: '#10b981',
    items: [
      { label: 'Offensive Third %', value: `${stats.offensivePct}%` },
      { label: 'Neutral Third %',   value: `${stats.neutralPct}%` },
      { label: 'Demos Inflicted',   value: stats.demosInflictedPerGame },
      { label: 'Big Pads / Game',   value: stats.bigPadsPerGame },
    ],
  },
]

const SEVERITY_CONFIG: Record<Tip['severity'], { bar: string; label: string; dot: string }> = {
  critical: { bar: 'bg-red-500',    label: 'text-red-400 bg-red-500/10 border-red-500/20',    dot: 'bg-red-500' },
  warning:  { bar: 'bg-amber-400',  label: 'text-amber-400 bg-amber-400/10 border-amber-400/20', dot: 'bg-amber-400' },
  good:     { bar: 'bg-emerald-400',label: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20', dot: 'bg-emerald-400' },
}

export default function Home() {
  const [playerId, setPlayerId] = useState('')
  const [platform, setPlatform] = useState('steam')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ApiResponse | null>(null)

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!playerId.trim()) return
    setLoading(true)
    setResult(null)
    const res = await fetch(`/api/stats?playerId=${encodeURIComponent(playerId.trim())}&platform=${platform}`)
    const data: ApiResponse = await res.json()
    setResult(data)
    setLoading(false)
  }

  const tips = result?.stats ? generateAdvice(result.stats) : []
  const sorted = [...tips].sort((a, b) => {
    const o = { critical: 0, warning: 1, good: 2 }
    return o[a.severity] - o[b.severity]
  })

  return (
    <main style={{ fontFamily: "'DM Sans', sans-serif" }} className="min-h-screen bg-[#080a0f] text-white">

      {/* Google font */}
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');`}</style>

      {/* Top bar */}
      <header className="border-b border-white/[0.06] bg-[#080a0f]/90 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-500 to-rose-600 flex items-center justify-center text-xs font-bold">RL</div>
            <span className="font-semibold text-sm tracking-tight">RLTracker</span>
          </div>
          <span style={{ fontFamily: "'DM Mono', monospace" }} className="text-[11px] text-white/20 tracking-widest uppercase">Stats & Advice</span>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-5 py-16 space-y-16">

        {/* Search */}
        <div className="max-w-2xl mx-auto text-center space-y-8">
          <div className="space-y-3">
            <h1 className="text-[2.6rem] font-semibold tracking-[-0.04em] leading-none">
              Know your game.<br />
              <span className="text-white/30">Improve it.</span>
            </h1>
            <p className="text-white/40 text-sm leading-relaxed">
              Paste your Ballchasing player ID to get a breakdown of your last 20 public replays and actionable tips.
            </p>
          </div>

          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2">
            <select
              value={platform}
              onChange={e => setPlatform(e.target.value)}
              style={{ fontFamily: "'DM Mono', monospace" }}
              className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-3 text-xs text-white/70 focus:outline-none focus:border-white/20 sm:w-32 appearance-none"
            >
              {PLATFORMS.map(p => (
                <option key={p.value} value={p.value} className="bg-[#0f1117]">{p.label}</option>
              ))}
            </select>
            <input
              type="text"
              value={playerId}
              onChange={e => setPlayerId(e.target.value)}
              placeholder="Player ID (e.g. 76561198201406534)"
              style={{ fontFamily: "'DM Mono', monospace" }}
              className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-xs text-white placeholder-white/20 focus:outline-none focus:border-white/20"
            />
            <button
              type="submit"
              disabled={loading || !playerId.trim()}
              className="bg-white text-black font-medium text-sm px-6 py-3 rounded-xl hover:bg-white/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all whitespace-nowrap"
            >
              {loading ? 'Analyzing…' : 'Analyze →'}
            </button>
          </form>

          <p className="text-white/20 text-xs">
            Find your ID on{' '}
            <a href="https://ballchasing.com" target="_blank" rel="noreferrer" className="text-white/40 hover:text-white/60 underline underline-offset-2 transition-colors">
              ballchasing.com
            </a>
            {' '}→ search your name → copy the ID from your profile URL
          </p>
        </div>

        {/* Error */}
        {result?.error && (
          <div className="max-w-2xl mx-auto bg-red-500/5 border border-red-500/20 rounded-2xl p-5 text-red-400 text-sm text-center">
            {result.error}
          </div>
        )}

        {/* Results */}
        {result?.stats && (() => {
          const stats = result.stats!
          const groups = STAT_GROUPS(stats)
          return (
            <div className="space-y-10">

              {/* Meta row */}
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-5">
                <div>
                  <p className="text-2xl font-semibold tracking-tight">{result.replayCount} replays analyzed</p>
                  <p className="text-white/30 text-sm mt-0.5">Most recent public games</p>
                </div>
                <div className="flex gap-3 text-sm">
                  {[
                    { label: 'Issues', count: tips.filter(t => t.severity === 'critical').length, color: 'text-red-400' },
                    { label: 'Warnings', count: tips.filter(t => t.severity === 'warning').length, color: 'text-amber-400' },
                    { label: 'Strengths', count: tips.filter(t => t.severity === 'good').length, color: 'text-emerald-400' },
                  ].map(({ label, count, color }) => (
                    <div key={label} className="text-center bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-2.5">
                      <p className={`text-xl font-semibold ${color}`}>{count}</p>
                      <p className="text-white/30 text-[11px] mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Stat groups */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {groups.map(group => (
                  <div key={group.label} className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5 space-y-4">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: group.color }} />
                      <span style={{ fontFamily: "'DM Mono', monospace" }} className="text-[11px] text-white/40 uppercase tracking-widest">{group.label}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {group.items.map(({ label, value }) => (
                        <div key={label} className="space-y-1">
                          <p className="text-white/30 text-xs">{label}</p>
                          <p className="text-xl font-semibold tracking-tight">{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Advice */}
              <div className="space-y-3">
                <div className="flex items-center gap-3 mb-6">
                  <span style={{ fontFamily: "'DM Mono', monospace" }} className="text-[11px] text-white/30 uppercase tracking-widest">Improvement Advice</span>
                  <div className="flex-1 h-px bg-white/[0.06]" />
                </div>
                {sorted.map((tip, i) => {
                  const cfg = SEVERITY_CONFIG[tip.severity]
                  return (
                    <div key={i} className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5 flex gap-4">
                      <div className="pt-1 flex-shrink-0">
                        <div className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                      </div>
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-md border ${cfg.label}`}>
                            {tip.severity}
                          </span>
                          <span style={{ fontFamily: "'DM Mono', monospace" }} className="text-[11px] text-white/25 uppercase tracking-wider">{tip.category}</span>
                        </div>
                        <p className="font-medium text-sm">{tip.title}</p>
                        <p className="text-white/45 text-sm leading-relaxed">{tip.detail}</p>
                      </div>
                    </div>
                  )
                })}
              </div>

            </div>
          )
        })()}

      </div>
    </main>
  )
}
