'use client'

import { useState, useRef } from 'react'
import { generateAdvice, type Stats, type Tip } from '@/lib/advice'
import RadarChartComponent from '@/components/RadarChartComponent'
import FieldZoneChart from '@/components/FieldZoneChart'

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

type UploadResponse = {
  replayId?: string
  players?: { id: string; platform: string; name: string; stats: object }[]
  error?: string
}

const STAT_GROUPS = (stats: Stats) => [
  {
    label: 'Offense', color: '#f97316',
    items: [
      { label: 'Goals / Game',   value: stats.goalsPerGame },
      { label: 'Assists / Game', value: stats.assistsPerGame },
      { label: 'Shots / Game',   value: stats.shotsPerGame },
      { label: 'Shot Accuracy',  value: `${stats.shotAccuracy}%` },
    ],
  },
  {
    label: 'Defense', color: '#3b82f6',
    items: [
      { label: 'Saves / Game',      value: stats.savesPerGame },
      { label: 'Defensive Third %', value: `${stats.defensivePct}%` },
      { label: 'Demos Taken',       value: stats.demosTakenPerGame },
      { label: 'Avg Score',         value: stats.avgScore },
    ],
  },
  {
    label: 'Boost & Speed', color: '#a855f7',
    items: [
      { label: 'Avg Boost',    value: stats.avgBoost },
      { label: 'Boost Stolen', value: stats.boostStolenPerGame },
      { label: 'Supersonic %', value: `${stats.supersonicPct}%` },
      { label: 'Slow Speed %', value: `${stats.slowPct}%` },
    ],
  },
  {
    label: 'Positioning', color: '#10b981',
    items: [
      { label: 'Offensive Third %', value: `${stats.offensivePct}%` },
      { label: 'Neutral Third %',   value: `${stats.neutralPct}%` },
      { label: 'Demos Inflicted',   value: stats.demosInflictedPerGame },
      { label: 'Big Pads / Game',   value: stats.bigPadsPerGame },
    ],
  },
]

const SEVERITY_CONFIG: Record<Tip['severity'], { label: string; dot: string }> = {
  critical: { label: 'text-red-400 bg-red-500/10 border-red-500/20',            dot: 'bg-red-500' },
  warning:  { label: 'text-amber-400 bg-amber-400/10 border-amber-400/20',      dot: 'bg-amber-400' },
  good:     { label: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',dot: 'bg-emerald-400' },
}

type UploadPlayer = { id: string; platform: string; name: string; stats: object }

function singleReplayToStats(rawStats: Record<string, Record<string, number>>): Stats {
  const c = rawStats?.core ?? {}
  const b = rawStats?.boost ?? {}
  const m = rawStats?.movement ?? {}
  const pos = rawStats?.positioning ?? {}
  const d = rawStats?.demo ?? {}
  return {
    gamesAnalyzed: 1,
    goalsPerGame: c.goals ?? 0,
    assistsPerGame: c.assists ?? 0,
    savesPerGame: c.saves ?? 0,
    shotsPerGame: c.shots ?? 0,
    shotAccuracy: c.shots > 0 ? +((c.goals / c.shots) * 100).toFixed(1) : 0,
    avgScore: c.score ?? 0,
    avgBoost: b.avg_amount ?? 0,
    boostStolenPerGame: b.amount_stolen ?? 0,
    bigPadsPerGame: b.amount_collected_big ?? 0,
    avgSpeed: m.avg_speed ?? 0,
    supersonicPct: m.percent_supersonic_speed ?? 0,
    slowPct: m.percent_slow_speed ?? 0,
    offensivePct: pos.percent_offensive_third ?? 0,
    defensivePct: pos.percent_defensive_third ?? 0,
    neutralPct: pos.percent_neutral_third ?? 0,
    demosInflictedPerGame: d.inflicted ?? 0,
    demosTakenPerGame: d.taken ?? 0,
  }
}

export default function Home() {
  const [tab, setTab] = useState<'id' | 'upload'>('upload')
  const [playerId, setPlayerId] = useState('')
  const [platform, setPlatform] = useState('steam')
  const [idLoading, setIdLoading] = useState(false)
  const [idResult, setIdResult] = useState<ApiResponse | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [uploadLoading, setUploadLoading] = useState(false)
  const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null)
  const [selectedPlayer, setSelectedPlayer] = useState<UploadPlayer | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!playerId.trim()) return
    setIdLoading(true)
    setIdResult(null)
    const res = await fetch(`/api/stats?playerId=${encodeURIComponent(playerId.trim())}&platform=${platform}`)
    const data: ApiResponse = await res.json()
    setIdResult(data)
    setIdLoading(false)
  }

  async function handleUpload(file: File) {
    if (!file.name.endsWith('.replay')) {
      setUploadResult({ error: 'Please select a .replay file.' })
      return
    }
    setUploadLoading(true)
    setUploadResult(null)
    setSelectedPlayer(null)
    const form = new FormData()
    form.append('replay', file)
    const res = await fetch('/api/upload', { method: 'POST', body: form })
    const data: UploadResponse = await res.json()
    setUploadResult(data)
    setUploadLoading(false)
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleUpload(file)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleUpload(file)
  }

  const displayStats: Stats | null =
    tab === 'id'
      ? idResult?.stats ?? null
      : selectedPlayer
      ? singleReplayToStats(selectedPlayer.stats as Record<string, Record<string, number>>)
      : null

  const tips = displayStats ? generateAdvice(displayStats) : []
  const sorted = [...tips].sort((a, b) => ({ critical: 0, warning: 1, good: 2 }[a.severity] - { critical: 0, warning: 1, good: 2 }[b.severity]))

  return (
    <main style={{ fontFamily: "'DM Sans', sans-serif" }} className="min-h-screen bg-[#080a0f] text-white">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');`}</style>

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
        <div className="max-w-2xl mx-auto text-center space-y-8">
          <div className="space-y-3">
            <h1 className="text-[2.6rem] font-semibold tracking-[-0.04em] leading-none">
              Know your game.<br /><span className="text-white/30">Improve it.</span>
            </h1>
            <p className="text-white/40 text-sm leading-relaxed">
              Upload a replay file or enter your Ballchasing player ID to get personalized improvement advice.
            </p>
          </div>

          <div className="flex rounded-xl bg-white/[0.04] border border-white/[0.06] p-1">
            {[{ key: 'upload', label: '↑ Upload Replay' }, { key: 'id', label: '⊙ Player ID' }].map(t => (
              <button key={t.key} onClick={() => setTab(t.key as 'id' | 'upload')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.key ? 'bg-white text-black' : 'text-white/40 hover:text-white/70'}`}>
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'upload' && (
            <div className="space-y-4">
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-10 cursor-pointer transition-all text-center ${dragOver ? 'border-white/40 bg-white/[0.06]' : 'border-white/[0.08] hover:border-white/20 hover:bg-white/[0.02]'}`}
              >
                <input ref={fileRef} type="file" accept=".replay" onChange={onFileChange} className="hidden" />
                {uploadLoading ? (
                  <div className="space-y-2">
                    <p className="text-white/60 text-sm">Uploading & analyzing…</p>
                    <p className="text-white/25 text-xs">This takes a few seconds</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-2xl">📁</p>
                    <p className="text-white/60 text-sm font-medium">Drop your .replay file here</p>
                    <p className="text-white/25 text-xs">or click to browse</p>
                  </div>
                )}
              </div>

              {uploadResult?.error && (
                <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm">{uploadResult.error}</div>
              )}

              {uploadResult?.players && !selectedPlayer && (
                <div className="space-y-3 text-left">
                  <p className="text-white/40 text-xs text-center">Who are you in this replay?</p>
                  {uploadResult.players.map(p => (
                    <button key={p.id} onClick={() => setSelectedPlayer(p)}
                      className="w-full flex items-center justify-between bg-white/[0.03] border border-white/[0.06] hover:border-white/20 rounded-xl px-4 py-3 transition-all">
                      <span className="font-medium text-sm">{p.name}</span>
                      <span style={{ fontFamily: "'DM Mono', monospace" }} className="text-xs text-white/30 uppercase">{p.platform}</span>
                    </button>
                  ))}
                </div>
              )}

              {selectedPlayer && (
                <div className="flex items-center justify-between bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3">
                  <div className="text-left">
                    <p className="text-sm font-medium">{selectedPlayer.name}</p>
                    <p className="text-xs text-white/30">Showing stats for this replay</p>
                  </div>
                  <button onClick={() => { setSelectedPlayer(null); setUploadResult(null) }} className="text-white/30 hover:text-white/60 text-xs transition-colors">Clear</button>
                </div>
              )}

              <p className="text-white/20 text-xs">
                Replays are uploaded to{' '}
                <a href="https://ballchasing.com" target="_blank" rel="noreferrer" className="text-white/40 hover:text-white/60 underline underline-offset-2">ballchasing.com</a>
                {' '}and set to public visibility.
              </p>
            </div>
          )}

          {tab === 'id' && (
            <div className="space-y-4">
              <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2">
                <select value={platform} onChange={e => setPlatform(e.target.value)}
                  style={{ fontFamily: "'DM Mono', monospace" }}
                  className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-3 text-xs text-white/70 focus:outline-none focus:border-white/20 sm:w-32 appearance-none">
                  {PLATFORMS.map(p => <option key={p.value} value={p.value} className="bg-[#0f1117]">{p.label}</option>)}
                </select>
                <input type="text" value={playerId} onChange={e => setPlayerId(e.target.value)}
                  placeholder="Player ID (e.g. 76561198201406534)"
                  style={{ fontFamily: "'DM Mono', monospace" }}
                  className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-xs text-white placeholder-white/20 focus:outline-none focus:border-white/20" />
                <button type="submit" disabled={idLoading || !playerId.trim()}
                  className="bg-white text-black font-medium text-sm px-6 py-3 rounded-xl hover:bg-white/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all whitespace-nowrap">
                  {idLoading ? 'Analyzing…' : 'Analyze →'}
                </button>
              </form>
              {idResult?.error && (
                <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm">{idResult.error}</div>
              )}
              <p className="text-white/20 text-xs">
                Find your ID on{' '}
                <a href="https://ballchasing.com" target="_blank" rel="noreferrer" className="text-white/40 hover:text-white/60 underline underline-offset-2">ballchasing.com</a>
                {' '}→ search your name → copy the ID from your profile URL
              </p>
            </div>
          )}
        </div>

        {displayStats && (() => {
          const groups = STAT_GROUPS(displayStats)
          return (
            <div className="space-y-10">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-5">
                <div>
                  <p className="text-2xl font-semibold tracking-tight">
                    {tab === 'id' ? `${idResult?.replayCount} replays analyzed` : '1 replay analyzed'}
                  </p>
                  <p className="text-white/30 text-sm mt-0.5">
                    {tab === 'id' ? 'Most recent public games' : `Viewing as ${selectedPlayer?.name}`}
                  </p>
                </div>
                <div className="flex gap-3 text-sm">
                  {[
                    { label: 'Issues',    count: tips.filter(t => t.severity === 'critical').length, color: 'text-red-400' },
                    { label: 'Warnings',  count: tips.filter(t => t.severity === 'warning').length,  color: 'text-amber-400' },
                    { label: 'Strengths', count: tips.filter(t => t.severity === 'good').length,     color: 'text-emerald-400' },
                  ].map(({ label, count, color }) => (
                    <div key={label} className="text-center bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-2.5">
                      <p className={`text-xl font-semibold ${color}`}>{count}</p>
                      <p className="text-white/30 text-[11px] mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
              </div>


              {/* Charts */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <RadarChartComponent stats={displayStats} />
                <FieldZoneChart stats={displayStats} />
              </div>

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

              <div className="space-y-3">
                <div className="flex items-center gap-3 mb-6">
                  <span style={{ fontFamily: "'DM Mono', monospace" }} className="text-[11px] text-white/30 uppercase tracking-widest">Improvement Advice</span>
                  <div className="flex-1 h-px bg-white/[0.06]" />
                </div>
                {sorted.map((tip, i) => {
                  const cfg = SEVERITY_CONFIG[tip.severity]
                  return (
                    <div key={i} className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5 flex gap-4">
                      <div className="pt-1 flex-shrink-0"><div className={`w-2 h-2 rounded-full ${cfg.dot}`} /></div>
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-md border ${cfg.label}`}>{tip.severity}</span>
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
