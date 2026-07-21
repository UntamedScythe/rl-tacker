'use client'

import { useState, useRef, useEffect } from 'react'
import { generateAdvice, type Stats, type Tip, type Teammate } from '@/lib/advice'
import RadarChartComponent from '@/components/RadarChartComponent'
import FieldZoneChart from '@/components/FieldZoneChart'

// ─── Constants ───────────────────────────────────────────────────────────────

const PLATFORMS = [
  { value: 'steam', label: 'Steam' },
  { value: 'epic',  label: 'Epic'  },
  { value: 'ps4',   label: 'PS'    },
  { value: 'xbox',  label: 'Xbox'  },
]

const PLAYLISTS = [
  { value: '',                  label: 'All Modes'   },
  { value: 'ranked-doubles',    label: 'Ranked 2v2'  },
  { value: 'ranked-standard',   label: 'Ranked 3v3'  },
  { value: 'ranked-duels',      label: 'Ranked 1v1'  },
  { value: 'unranked-doubles',  label: 'Casual 2v2'  },
  { value: 'unranked-standard', label: 'Casual 3v3'  },
  { value: 'unranked-duels',    label: 'Casual 1v1'  },
]

const RANK_NAMES: Record<number, { name: string; color: string }> = {
  0:  { name: 'Unranked',           color: '#888888' },
  1:  { name: 'Bronze I',           color: '#cd7f32' },
  2:  { name: 'Bronze II',          color: '#cd7f32' },
  3:  { name: 'Bronze III',         color: '#cd7f32' },
  4:  { name: 'Silver I',           color: '#a8a9ad' },
  5:  { name: 'Silver II',          color: '#a8a9ad' },
  6:  { name: 'Silver III',         color: '#a8a9ad' },
  7:  { name: 'Gold I',             color: '#ffd700' },
  8:  { name: 'Gold II',            color: '#ffd700' },
  9:  { name: 'Gold III',           color: '#ffd700' },
  10: { name: 'Platinum I',         color: '#00b4d8' },
  11: { name: 'Platinum II',        color: '#00b4d8' },
  12: { name: 'Platinum III',       color: '#00b4d8' },
  13: { name: 'Diamond I',          color: '#4cc9f0' },
  14: { name: 'Diamond II',         color: '#4cc9f0' },
  15: { name: 'Diamond III',        color: '#4cc9f0' },
  16: { name: 'Champion I',         color: '#9b5de5' },
  17: { name: 'Champion II',        color: '#9b5de5' },
  18: { name: 'Champion III',       color: '#9b5de5' },
  19: { name: 'Grand Champion I',   color: '#f72585' },
  20: { name: 'Grand Champion II',  color: '#f72585' },
  21: { name: 'Grand Champion III', color: '#f72585' },
  22: { name: 'Supersonic Legend',  color: '#ff9e00' },
}

const STAT_GROUPS = (stats: Stats) => [
  {
    label: 'Offense', color: '#FF5C1A',
    items: [
      { label: 'Goals / game',   value: stats.goalsPerGame   },
      { label: 'Assists / game', value: stats.assistsPerGame },
      { label: 'Shots / game',   value: stats.shotsPerGame   },
      { label: 'Shot %',         value: `${stats.shotAccuracy}%` },
    ],
  },
  {
    label: 'Defense', color: '#3B8BF5',
    items: [
      { label: 'Saves / game',   value: stats.savesPerGame       },
      { label: 'Defensive %',    value: `${stats.defensivePct}%` },
      { label: 'Demos taken',    value: stats.demosTakenPerGame  },
      { label: 'Avg score',      value: stats.avgScore           },
    ],
  },
  {
    label: 'Boost', color: '#F5A623',
    items: [
      { label: 'Avg boost',    value: stats.avgBoost             },
      { label: 'Stolen',       value: stats.boostStolenPerGame   },
      { label: 'Supersonic %', value: `${stats.supersonicPct}%` },
      { label: 'Slow %',       value: `${stats.slowPct}%`       },
    ],
  },
  {
    label: 'Positioning', color: '#22C97A',
    items: [
      { label: 'Offensive %',  value: `${stats.offensivePct}%`    },
      { label: 'Neutral %',    value: `${stats.neutralPct}%`      },
      { label: 'Demos given',  value: stats.demosInflictedPerGame  },
      { label: 'Big pads',     value: stats.bigPadsPerGame         },
    ],
  },
]

const SEVERITY: Record<Tip['severity'], { dot: string; badge: string; border: string }> = {
  critical: { dot: '#F54B4B', badge: 'rgba(245,75,75,0.12)',  border: 'rgba(245,75,75,0.25)'  },
  warning:  { dot: '#F5A623', badge: 'rgba(245,166,35,0.12)', border: 'rgba(245,166,35,0.25)' },
  good:     { dot: '#22C97A', badge: 'rgba(34,201,122,0.12)', border: 'rgba(34,201,122,0.25)' },
}

// ─── Types ────────────────────────────────────────────────────────────────────

type MatchType = 'exact' | 'normalized' | 'starts-with' | 'substring'

type PlayerCandidate = {
  name:        string
  platform:    string
  id:          string
  replayCount: number
  matchType:   MatchType
}

type DiscoverResponse = {
  candidates:  PlayerCandidate[]
  searchName:  string
  cached:      boolean
  error?:      string
  errorCode?:  string
}

type ApiResponse = {
  stats?: Stats & {
    playerRank?: { tier?: number; division?: number; name?: string }
    playerName?: string
  }
  replayCount?: number
  error?: string
}

type UploadResponse = {
  players?: { id: string; platform: string; name: string; stats: object }[]
  error?: string
}

type UploadPlayer = { id: string; platform: string; name: string; stats: object }

function singleReplayToStats(raw: Record<string, Record<string, number>>): Stats {
  const c = raw?.core ?? {}, b = raw?.boost ?? {}, m = raw?.movement ?? {}
  const pos = raw?.positioning ?? {}, d = raw?.demo ?? {}
  return {
    gamesAnalyzed: 1,
    goalsPerGame: c.goals ?? 0, assistsPerGame: c.assists ?? 0,
    savesPerGame: c.saves ?? 0, shotsPerGame: c.shots ?? 0,
    shotAccuracy: c.shots > 0 ? +((c.goals / c.shots) * 100).toFixed(1) : 0,
    avgScore: c.score ?? 0, avgBoost: b.avg_amount ?? 0,
    boostStolenPerGame: b.amount_stolen ?? 0, bigPadsPerGame: b.amount_collected_big ?? 0,
    avgSpeed: m.avg_speed ?? 0, supersonicPct: m.percent_supersonic_speed ?? 0,
    slowPct: m.percent_slow_speed ?? 0, offensivePct: pos.percent_offensive_third ?? 0,
    defensivePct: pos.percent_defensive_third ?? 0, neutralPct: pos.percent_neutral_third ?? 0,
    demosInflictedPerGame: d.inflicted ?? 0, demosTakenPerGame: d.taken ?? 0,
  }
}

// ─── Logo Mark ───────────────────────────────────────────────────────────────

function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 2L24.39 8V20L14 26L3.61 20V8L14 2Z" fill="#FF5C1A" fillOpacity="0.15" stroke="#FF5C1A" strokeWidth="1.2" />
      <path d="M9 19L17 9" stroke="#FF5C1A" strokeWidth="2" strokeLinecap="round"/>
      <circle className="boost-dot" cx="17.5" cy="9.5" r="2.5" fill="#FF5C1A"/>
      <path d="M7 14H11" stroke="#FF5C1A" strokeWidth="1.2" strokeLinecap="round" strokeOpacity="0.5"/>
      <path d="M7 17H10" stroke="#FF5C1A" strokeWidth="1" strokeLinecap="round" strokeOpacity="0.3"/>
    </svg>
  )
}

// ─── Stat Card with count-up ──────────────────────────────────────────────────

function StatCard({ label, value, color, delay }: { label: string; value: string | number; color: string; delay: number }) {
  return (
    <div className="stat-value" style={{ animationDelay: `${delay}ms` }}>
      <p style={{ color: 'var(--muted)', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: 'var(--font-geist-mono)', marginBottom: '4px' }}>
        {label}
      </p>
      <p style={{ fontSize: '1.55rem', fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--chalk)', lineHeight: 1 }}>
        {value}
        <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: color, marginLeft: '6px', verticalAlign: 'middle', opacity: 0.8 }} />
      </p>
    </div>
  )
}

// ─── Loading Progress ─────────────────────────────────────────────────────────

function LoadingReplays({ current, total }: { current: number; total: number }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <p style={{ fontSize: '13px', color: 'var(--chalk)' }}>
          {current === 0 ? 'Connecting to Ballchasing…' : `Analyzing replay ${current} of ${total}`}
        </p>
        <p style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '12px', color: '#FF5C1A' }}>{pct}%</p>
      </div>
      <div style={{ height: '3px', background: 'var(--muted-2)', borderRadius: '2px', overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: 'linear-gradient(90deg, #FF5C1A, #FF8C5A)',
          borderRadius: '2px',
          transition: 'width 0.6s ease',
        }} />
      </div>
      <p style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '8px' }}>
        Takes ~10 seconds — each replay is fetched individually to stay within API limits
      </p>
    </div>
  )
}

// ─── Shared input style ───────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border-2)',
  borderRadius: '10px',
  padding: '11px 16px',
  fontSize: '13px',
  color: 'var(--chalk)',
  fontFamily: 'var(--font-geist-mono)',
  outline: 'none',
  width: '100%',
}

const selectStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border-2)',
  borderRadius: '10px',
  padding: '10px 12px',
  fontSize: '12px',
  color: 'var(--muted)',
  fontFamily: 'var(--font-geist-mono)',
  outline: 'none',
}

const primaryBtn: React.CSSProperties = {
  background: '#FF5C1A',
  color: '#fff',
  border: 'none',
  borderRadius: '10px',
  padding: '10px 20px',
  fontSize: '13px',
  fontWeight: 600,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  transition: 'opacity 0.15s',
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Home() {

  // Tab
  const [tab, setTab] = useState<'name' | 'id' | 'upload'>('name')

  // Player ID search
  const [playerId, setPlayerId]   = useState('')
  const [platform, setPlatform]   = useState('steam')
  const [playlist, setPlaylist]   = useState('')
  const [idLoading, setIdLoading] = useState(false)
  const [loadProgress, setLoadProgress] = useState({ current: 0, total: 10 })
  const [idResult, setIdResult]   = useState<ApiResponse | null>(null)
  const [autoSearch, setAutoSearch] = useState(false)
  const [searchedPlayer, setSearchedPlayer] = useState<{ name: string; avatarUrl?: string; id: string; platform: string } | null>(null)

  // Name discovery
  const [nameQuery, setNameQuery]     = useState('')
  const [nameLoading, setNameLoading] = useState(false)
  const [nameResult, setNameResult]   = useState<DiscoverResponse | null>(null)

  // Upload
  const [dragOver, setDragOver]           = useState(false)
  const [uploadLoading, setUploadLoading] = useState(false)
  const [uploadResult, setUploadResult]   = useState<UploadResponse | null>(null)
  const [selectedPlayer, setSelectedPlayer] = useState<UploadPlayer | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // ── Auto-search on teammate click ──────────────────────────────────────────
  useEffect(() => {
    if (!autoSearch || !playerId.trim()) return
    setAutoSearch(false)
    setIdResult(null)
    setPlaylist('')
    runSearch(playerId.trim(), platform, '')
  }, [autoSearch, playerId, platform])

  // ── runSearch ──────────────────────────────────────────────────────────────
  async function runSearch(id: string, plat: string, pl: string) {
    setIdLoading(true)
    setIdResult(null)
    setSearchedPlayer(null)
    setLoadProgress({ current: 0, total: 10 })

    let count = 0
    const timer = setInterval(() => {
      count = Math.min(count + 1, 9)
      setLoadProgress({ current: count, total: 10 })
    }, 900)

    const playlistParam = pl ? `&playlist=${encodeURIComponent(pl)}` : ''
    const data: ApiResponse = await fetch(
      `/api/stats?playerId=${encodeURIComponent(id)}&platform=${plat}${playlistParam}`
    ).then(r => r.json())

    clearInterval(timer)
    setLoadProgress({ current: 10, total: 10 })
    setIdResult(data)

    const replayName: string | undefined = data?.stats?.playerName
    let displayName = replayName ?? id
    let avatarUrl: string | null = null

    if (plat === 'steam') {
      try {
        const nameParam = replayName ? `&name=${encodeURIComponent(replayName)}` : ''
        const profile = await fetch(`/api/steamprofile?steamId=${encodeURIComponent(id)}${nameParam}`).then(r => r.json())
        if (profile?.name) displayName = profile.name
        if (profile?.avatarUrl) avatarUrl = profile.avatarUrl
      } catch { /* silent */ }
    }

    setSearchedPlayer({ name: displayName, avatarUrl: avatarUrl ?? undefined, id, platform: plat })
    setIdLoading(false)
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!playerId.trim()) return
    runSearch(playerId.trim(), platform, playlist)
  }

  // ── Name discovery ─────────────────────────────────────────────────────────
  async function handleNameSearch(e: React.FormEvent) {
    e.preventDefault()
    const q = nameQuery.trim()
    if (q.length < 2) return
    setNameLoading(true)
    setNameResult(null)
    const res = await fetch('/api/discover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: q }),
    })
    const data: DiscoverResponse = await res.json()
    setNameResult(data)
    setNameLoading(false)
  }

  function selectCandidate(c: PlayerCandidate) {
    setTab('id')
    setPlayerId(c.id)
    setPlatform(c.platform)
    setNameResult(null)
    setAutoSearch(true)
  }

  // ── Upload ─────────────────────────────────────────────────────────────────
  async function handleUpload(file: File) {
    if (!file.name.endsWith('.replay')) { setUploadResult({ error: 'Please select a .replay file.' }); return }
    setUploadLoading(true); setUploadResult(null); setSelectedPlayer(null)
    const form = new FormData(); form.append('replay', file)
    const data: UploadResponse = await fetch('/api/upload', { method: 'POST', body: form }).then(r => r.json())
    setUploadResult(data); setUploadLoading(false)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false)
    const file = e.dataTransfer.files?.[0]; if (file) handleUpload(file)
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  const displayStats: Stats | null =
    tab === 'id' ? (idResult?.stats ?? null)
    : tab === 'upload' && selectedPlayer
    ? singleReplayToStats(selectedPlayer.stats as Record<string, Record<string, number>>)
    : null

  const tips = displayStats ? generateAdvice(displayStats) : []
  const sorted = [...tips].sort((a, b) =>
    ({ critical: 0, warning: 1, good: 2 }[a.severity]) - ({ critical: 0, warning: 1, good: 2 }[b.severity])
  )
  const rankInfo = idResult?.stats?.playerRank?.tier != null
    ? (RANK_NAMES[idResult.stats.playerRank.tier] ?? null) : null

  const MATCH_COLORS: Record<MatchType, string> = {
    exact:          '#22C97A',
    normalized:     '#22C97A',
    'starts-with':  '#F5A623',
    substring:      '#4A5060',
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <main style={{ minHeight: '100vh', background: 'var(--pitch)', color: 'var(--chalk)' }}>

      {/* Nav */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(8,10,12,0.88)',
        backdropFilter: 'blur(14px)',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ maxWidth: '880px', margin: '0 auto', padding: '0 24px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <LogoMark size={28} />
            <span style={{ fontWeight: 700, fontSize: '15px', letterSpacing: '-0.02em' }}>NeedBoost</span>
          </div>
          <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: 'var(--muted)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
            Replay Analysis
          </span>
        </div>
      </nav>

      {/* Hero */}
      <div style={{ maxWidth: '880px', margin: '0 auto', padding: '0 24px' }}>
        <section style={{ padding: '72px 0 56px' }}>
          <div style={{ maxWidth: '540px' }}>

            <p className="fade-up" style={{
              fontFamily: 'var(--font-geist-mono)', fontSize: '11px', color: '#FF5C1A',
              letterSpacing: '0.14em', textTransform: 'uppercase',
              marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px',
            }}>
              <span style={{ display: 'inline-block', width: '24px', height: '1px', background: '#FF5C1A' }} />
              Honest feedback from your own replays
            </p>

            <h1 className="fade-up-1" style={{
              fontSize: 'clamp(2.2rem, 5vw, 3.4rem)', fontWeight: 700,
              letterSpacing: '-0.04em', lineHeight: 1.05, marginBottom: '20px',
            }}>
              Stop guessing<br />
              <span style={{ color: '#FF5C1A' }}>what&apos;s holding</span><br />
              you back.
            </h1>

            <p className="fade-up-2" style={{
              fontSize: '15px', color: 'var(--muted)', lineHeight: 1.75,
              marginBottom: '36px', maxWidth: '420px',
            }}>
              Drop your display name, Ballchasing ID, or a replay. We analyze your last 10 games and tell you exactly what a Diamond player would fix first.
            </p>

            {/* Tab switcher */}
            <div className="fade-up-3" style={{
              display: 'inline-flex', flexWrap: 'wrap', gap: '3px',
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: '12px', padding: '4px', marginBottom: '24px',
            }}>
              {([
                { key: 'name',   label: 'Find by Name'  },
                { key: 'id',     label: 'Player ID'     },
                { key: 'upload', label: 'Upload Replay' },
              ] as { key: 'name' | 'id' | 'upload'; label: string }[]).map(t => (
                <button key={t.key} onClick={() => setTab(t.key)} style={{
                  padding: '8px 16px', borderRadius: '9px', fontSize: '13px',
                  fontWeight: 500, border: 'none', cursor: 'pointer',
                  transition: 'all 0.15s', whiteSpace: 'nowrap',
                  background: tab === t.key ? '#FF5C1A' : 'transparent',
                  color: tab === t.key ? '#fff' : 'var(--muted)',
                }}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* ── Find by Name ── */}
            {tab === 'name' && (
              <div className="fade-up-4" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <form onSubmit={handleNameSearch} style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text" value={nameQuery} onChange={e => setNameQuery(e.target.value)}
                    placeholder="Your Rocket League display name"
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <button type="submit" disabled={nameLoading || nameQuery.trim().length < 2}
                    style={{ ...primaryBtn, opacity: nameLoading || nameQuery.trim().length < 2 ? 0.4 : 1, cursor: nameLoading || nameQuery.trim().length < 2 ? 'not-allowed' : 'pointer' }}>
                    {nameLoading ? '…' : 'Search →'}
                  </button>
                </form>

                <p style={{ fontSize: '11px', color: 'var(--muted)' }}>
                  Searches public replays on Ballchasing. If your name has no public replays, use Player ID instead.
                </p>

                {/* Error */}
                {nameResult?.error && nameResult.candidates.length === 0 && (
                  <div style={{ background: 'rgba(245,75,75,0.08)', border: '1px solid rgba(245,75,75,0.2)', borderRadius: '10px', padding: '12px 16px', fontSize: '13px', color: '#F54B4B' }}>
                    {nameResult.error}
                  </div>
                )}

                {/* Too many warning */}
                {nameResult?.errorCode === 'TOO_MANY' && nameResult.candidates.length > 0 && (
                  <div style={{ background: 'rgba(245,166,35,0.08)', border: '1px solid rgba(245,166,35,0.2)', borderRadius: '10px', padding: '12px 16px', fontSize: '12px', color: '#F5A623' }}>
                    {nameResult.error}
                  </div>
                )}

                {/* Candidate list */}
                {nameResult && nameResult.candidates.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <p style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: 'center', marginBottom: '4px' }}>
                      Select your account
                    </p>
                    {nameResult.candidates.map(c => {
                      const color = MATCH_COLORS[c.matchType as MatchType] ?? '#4A5060'
                      return (
                        <button key={`${c.platform}:${c.id}`} onClick={() => selectCandidate(c)}
                          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px 16px', cursor: 'pointer', color: 'var(--chalk)', textAlign: 'left', transition: 'border-color 0.15s' }}>
                          <div>
                            <p style={{ fontSize: '14px', fontWeight: 600, marginBottom: '3px' }}>{c.name}</p>
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                              <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase' }}>{c.platform}</span>
                              <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: 'var(--muted)' }}>
                                {c.id.length > 18 ? c.id.slice(0, 18) + '…' : c.id}
                              </span>
                              <span style={{ fontSize: '10px', color: 'var(--muted)' }}>{c.replayCount} replay{c.replayCount !== 1 ? 's' : ''}</span>
                            </div>
                          </div>
                          <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', padding: '2px 8px', borderRadius: '4px', background: color + '18', color, border: `1px solid ${color}40`, flexShrink: 0, marginLeft: '12px' }}>
                            {c.matchType}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}

                {nameResult?.cached && (
                  <p style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: 'var(--muted)', textAlign: 'center' }}>cached result</p>
                )}
              </div>
            )}

            {/* ── Player ID ── */}
            {tab === 'id' && (
              <div className="fade-up-4" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <form onSubmit={handleSearch} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <input
                    type="text" value={playerId} onChange={e => setPlayerId(e.target.value)}
                    placeholder="Ballchasing player ID (e.g. 76561198201406534)"
                    style={inputStyle}
                  />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <select value={platform} onChange={e => setPlatform(e.target.value)} style={{ ...selectStyle, width: '30%' }}>
                      {PLATFORMS.map(p => <option key={p.value} value={p.value} style={{ background: '#0F1215' }}>{p.label}</option>)}
                    </select>
                    <select value={playlist} onChange={e => setPlaylist(e.target.value)} style={{ ...selectStyle, flex: 1 }}>
                      {PLAYLISTS.map(p => <option key={p.value} value={p.value} style={{ background: '#0F1215' }}>{p.label}</option>)}
                    </select>
                    <button type="submit" disabled={idLoading || !playerId.trim()}
                      style={{ ...primaryBtn, opacity: idLoading || !playerId.trim() ? 0.4 : 1, cursor: idLoading || !playerId.trim() ? 'not-allowed' : 'pointer' }}>
                      {idLoading ? '…' : 'Analyze →'}
                    </button>
                  </div>
                </form>

                {idLoading && <LoadingReplays current={loadProgress.current} total={loadProgress.total} />}

                {idResult?.error && (
                  <div style={{ background: 'rgba(245,75,75,0.08)', border: '1px solid rgba(245,75,75,0.2)', borderRadius: '10px', padding: '12px 16px', fontSize: '13px', color: '#F54B4B' }}>
                    {idResult.error}
                  </div>
                )}

                <p style={{ fontSize: '11px', color: 'var(--muted)' }}>
                  Find your ID on{' '}
                  <a href="https://ballchasing.com" target="_blank" rel="noreferrer" style={{ color: '#FF5C1A', textDecoration: 'none' }}>ballchasing.com</a>
                  {' '}→ search your name → copy ID from profile URL
                </p>
              </div>
            )}

            {/* ── Upload ── */}
            {tab === 'upload' && (
              <div className="fade-up-4" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div
                  onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={onDrop}
                  onClick={() => fileRef.current?.click()}
                  style={{
                    border: `2px dashed ${dragOver ? '#FF5C1A' : 'var(--border-2)'}`,
                    borderRadius: '12px', padding: '40px 24px', textAlign: 'center',
                    cursor: 'pointer', transition: 'all 0.15s',
                    background: dragOver ? 'rgba(255,92,26,0.04)' : 'var(--surface)',
                  }}
                >
                  <input ref={fileRef} type="file" accept=".replay"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f) }}
                    style={{ display: 'none' }}
                  />
                  {uploadLoading ? (
                    <p style={{ fontSize: '13px', color: 'var(--muted)' }}>Uploading & processing…</p>
                  ) : (
                    <>
                      <p style={{ fontSize: '28px', marginBottom: '10px' }}>📁</p>
                      <p style={{ fontSize: '14px', color: 'var(--chalk)', fontWeight: 600 }}>Drop your .replay file here</p>
                      <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>or click to browse</p>
                    </>
                  )}
                </div>

                {uploadResult?.error && (
                  <div style={{ background: 'rgba(245,75,75,0.08)', border: '1px solid rgba(245,75,75,0.2)', borderRadius: '10px', padding: '12px 16px', fontSize: '13px', color: '#F54B4B' }}>
                    {uploadResult.error}
                  </div>
                )}

                {uploadResult?.players && !selectedPlayer && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <p style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: 'center' }}>
                      Who are you in this replay?
                    </p>
                    {uploadResult.players.map(p => (
                      <button key={p.id} onClick={() => setSelectedPlayer(p)}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px 16px', cursor: 'pointer', color: 'var(--chalk)', textAlign: 'left' }}>
                        <span style={{ fontSize: '13px', fontWeight: 500 }}>{p.name}</span>
                        <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase' }}>{p.platform}</span>
                      </button>
                    ))}
                  </div>
                )}

                {selectedPlayer && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px 16px' }}>
                    <div>
                      <p style={{ fontSize: '13px', fontWeight: 500 }}>{selectedPlayer.name}</p>
                      <p style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>Showing stats for this replay</p>
                    </div>
                    <button onClick={() => { setSelectedPlayer(null); setUploadResult(null) }}
                      style={{ fontSize: '11px', color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
                      Clear
                    </button>
                  </div>
                )}

                <p style={{ fontSize: '11px', color: 'var(--muted)' }}>
                  Replays are uploaded to{' '}
                  <a href="https://ballchasing.com" target="_blank" rel="noreferrer" style={{ color: '#FF5C1A', textDecoration: 'none' }}>ballchasing.com</a>
                  {' '}as public.
                </p>
              </div>
            )}

          </div>
        </section>
      </div>

      {/* ── Results ── */}
      {displayStats && (
        <div style={{ maxWidth: '880px', margin: '0 auto', padding: '0 24px 100px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

            {/* Player header */}
            <div className="slide-in" style={{ display: 'flex', alignItems: 'center', gap: '16px', paddingBottom: '24px', borderBottom: '1px solid var(--border)' }}>
              {tab === 'id' && searchedPlayer?.avatarUrl && (
                <img src={searchedPlayer.avatarUrl} alt={searchedPlayer.name}
                  style={{ width: '48px', height: '48px', borderRadius: '10px', border: '1px solid var(--border-2)', flexShrink: 0 }} />
              )}
              {tab === 'id' && !searchedPlayer?.avatarUrl && (
                <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <LogoMark size={22} />
                </div>
              )}
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '1.35rem', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.1 }}>
                  {tab === 'id' ? (searchedPlayer?.name ?? playerId) : selectedPlayer?.name ?? 'Player'}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px', flexWrap: 'wrap' }}>
                  {rankInfo && (
                    <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '11px', padding: '2px 10px', borderRadius: '20px', border: `1px solid ${rankInfo.color}40`, background: `${rankInfo.color}15`, color: rankInfo.color }}>
                      {rankInfo.name}
                    </span>
                  )}
                  <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                    {tab === 'id' ? `${idResult?.replayCount} replays analyzed` : '1 replay analyzed'}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                {[
                  { label: 'Issues',    count: tips.filter(t => t.severity === 'critical').length, color: '#F54B4B' },
                  { label: 'Warnings',  count: tips.filter(t => t.severity === 'warning').length,  color: '#F5A623' },
                  { label: 'Strengths', count: tips.filter(t => t.severity === 'good').length,     color: '#22C97A' },
                ].map(({ label, count, color }) => (
                  <div key={label} style={{ textAlign: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '8px 12px' }}>
                    <p style={{ fontSize: '1.2rem', fontWeight: 700, color, lineHeight: 1 }}>{count}</p>
                    <p style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '9px', color: 'var(--muted)', marginTop: '3px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Charts */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '16px' }}>
              <RadarChartComponent stats={displayStats} />
              <FieldZoneChart stats={displayStats} />
            </div>

            {/* Stat cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              {STAT_GROUPS(displayStats).map((group, gi) => (
                <div key={group.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px' }}>
                    <div style={{ width: '4px', height: '14px', borderRadius: '2px', background: group.color }} />
                    <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{group.label}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    {group.items.map((item, ii) => (
                      <StatCard key={item.label} label={item.label} value={item.value} color={group.color} delay={gi * 50 + ii * 30} />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Most Played With */}
            {displayStats.topTeammates && displayStats.topTeammates.length > 0 && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Most played with</span>
                  <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '8px' }}>
                  {displayStats.topTeammates.map((teammate: Teammate) => (
                    <button key={teammate.id}
                      onClick={() => { setTab('id'); setPlayerId(teammate.id); setPlatform(teammate.platform || 'steam'); setAutoSearch(true) }}
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px 16px', cursor: 'pointer', color: 'var(--chalk)', textAlign: 'left', transition: 'border-color 0.15s' }}>
                      <div>
                        <p style={{ fontSize: '13px', fontWeight: 500 }}>{teammate.name}</p>
                        <p style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: 'var(--muted)', marginTop: '2px', textTransform: 'uppercase' }}>
                          {teammate.platform} · {teammate.count} game{teammate.count !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Analyze →</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Coaching feedback */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Coaching feedback</span>
                <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {sorted.map((tip, i) => {
                  const s = SEVERITY[tip.severity]
                  return (
                    <div key={i} style={{ background: 'var(--surface)', border: `1px solid ${s.border}`, borderRadius: '12px', padding: '16px 20px', display: 'flex', gap: '14px' }}>
                      <div style={{ paddingTop: '5px', flexShrink: 0 }}>
                        <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: s.dot }} />
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                          <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', background: s.badge, color: s.dot }}>
                            {tip.severity}
                          </span>
                          <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            {tip.category}
                          </span>
                        </div>
                        <p style={{ fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>{tip.title}</p>
                        <p style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.7 }}>{tip.detail}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--border)', padding: '24px', textAlign: 'center', marginTop: displayStats ? 0 : '80px' }}>
        <p style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '11px', color: 'var(--muted)' }}>
          NeedBoost · powered by{' '}
          <a href="https://ballchasing.com" target="_blank" rel="noreferrer" style={{ color: '#FF5C1A', textDecoration: 'none' }}>Ballchasing</a>
        </p>
      </footer>

    </main>
  )
}
