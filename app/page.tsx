'use client'

import { useState, useRef } from 'react'
import { generateAdvice, getPracticeTonight, type Stats, type Tip, type Teammate } from '@/lib/advice'
import RadarChartComponent from '@/components/RadarChartComponent'
import Boost, { type BoostState } from '@/components/Boost'
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

// ─── Sample data for demo mode ────────────────────────────────────────────────

const SAMPLE_STATS: Stats = {
  gamesAnalyzed: 10, goalsPerGame: 1.4, assistsPerGame: 0.8,
  savesPerGame: 1.2, shotsPerGame: 4.1, shotAccuracy: 34.1,
  avgScore: 412, avgBoost: 52, boostStolenPerGame: 98, bigPadsPerGame: 2.3,
  avgSpeed: 1340, supersonicPct: 13.2, slowPct: 41.8,
  offensivePct: 38.4, defensivePct: 24.1, neutralPct: 37.5,
  demosInflictedPerGame: 0.6, demosTakenPerGame: 0.4,
  playerName: 'SamplePlayer',
  playerRank: { tier: 14 },
  topTeammates: [],
}

// ─── Types ────────────────────────────────────────────────────────────────────

type MatchType = 'exact' | 'normalized' | 'starts-with' | 'substring'
type PlayerCandidate = { name: string; platform: string; id: string; replayCount: number; matchType: MatchType }
type DiscoverResponse = { candidates: PlayerCandidate[]; searchName: string; cached: boolean; error?: string; errorCode?: string }
type ApiResponse = { stats?: Stats; replayCount?: number; error?: string; cached?: boolean }
type UploadResponse = { players?: { id: string; platform: string; name: string; stats: object }[]; error?: string }
type UploadPlayer = { id: string; platform: string; name: string; stats: object }

function displayName(name: string): string {
  if (!name || /^\*+$/.test(name.trim())) return 'Hidden Player'
  return name
}

function singleReplayToStats(raw: Record<string, Record<string, number>>): Stats {
  const c = raw?.core ?? {}, b = raw?.boost ?? {}, m = raw?.movement ?? {}
  const pos = raw?.positioning ?? {}, d = raw?.demo ?? {}
  return {
    gamesAnalyzed: 1, goalsPerGame: c.goals ?? 0, assistsPerGame: c.assists ?? 0,
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
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <path d="M14 2L24.39 8V20L14 26L3.61 20V8L14 2Z" fill="#FF5C1A" fillOpacity="0.12" stroke="#FF5C1A" strokeWidth="1.2"/>
      <path d="M9 19L17 9" stroke="#FF5C1A" strokeWidth="2.2" strokeLinecap="round"/>
      <circle className="boost-dot" cx="17.5" cy="9.5" r="2.5" fill="#FF5C1A"/>
      <path d="M7 14H11" stroke="#FF5C1A" strokeWidth="1.2" strokeLinecap="round" strokeOpacity="0.45"/>
      <path d="M7 17H10" stroke="#FF5C1A" strokeWidth="1" strokeLinecap="round" strokeOpacity="0.25"/>
    </svg>
  )
}

// ─── Coaching Card ────────────────────────────────────────────────────────────
// The signature visual element of NeedBoost

function CoachingCard({ tip, index, connected }: { tip: Tip; index: number; connected?: boolean }) {
  const [expanded, setExpanded] = useState(index === 0)
  const sev = tip.severity

  return (
    <div
      className={`coaching-card ${sev}${connected ? ' connected' : ''}`}
      style={{ animationDelay: `${index * 60}ms` }}

    >
      <div
        style={{ padding: '16px 20px 16px 24px', cursor: 'pointer' }}
        onClick={() => setExpanded(e => !e)}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span style={{
                fontFamily: 'var(--font-geist-mono)',
                fontSize: '10px', fontWeight: 600,
                padding: '2px 7px', borderRadius: '3px',
                background: sev === 'critical' ? 'rgba(245,75,75,0.12)' : sev === 'warning' ? 'rgba(245,166,35,0.12)' : 'rgba(34,201,122,0.12)',
                color: sev === 'critical' ? '#F54B4B' : sev === 'warning' ? '#F5A623' : '#22C97A',
                textTransform: 'uppercase', letterSpacing: '0.06em',
              }}>{sev}</span>
              <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{tip.category}</span>
            </div>
            <p style={{ fontSize: '14px', fontWeight: 600, letterSpacing: '-0.01em', lineHeight: 1.3, color: 'var(--chalk)' }}>{tip.title}</p>
          </div>
          <span style={{ color: 'var(--muted)', fontSize: '12px', flexShrink: 0, marginTop: '2px', transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</span>
        </div>
      </div>

      {expanded && (
        <div style={{ padding: '0 20px 18px 24px', borderTop: '1px solid var(--border)' }}>
          {/* Observation */}
          <p style={{ fontSize: '13px', color: 'var(--chalk-2)', lineHeight: 1.75, marginTop: '14px', marginBottom: '10px' }}>
            {tip.observation}
          </p>

          {/* Evidence */}
          <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '11px', color: 'var(--muted)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '3px', padding: '6px 10px', marginBottom: '14px' }}>
            {tip.evidence}
          </div>

          {/* Drill */}
          <div style={{ background: 'rgba(255,92,26,0.06)', border: '1px solid rgba(255,92,26,0.14)', borderRadius: '3px', padding: '10px 14px' }}>
            <p style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: '#FF5C1A', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '5px' }}>Practice tonight</p>
            <p style={{ fontSize: '13px', color: 'var(--chalk-2)', lineHeight: 1.65 }}>{tip.drill}</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function AnalysisProgress({ pct }: { pct: number }) {
  const label = pct < 25 ? 'Connecting to Ballchasing…'
    : pct < 55 ? 'Pulling your replays…'
    : pct < 80 ? 'Reading your habits…'
    : 'Almost ready…'

  return (
    <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: '2px', padding: '16px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '12px' }}>
        <Boost state="analyzing" size={36} />
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: '12px', color: 'var(--chalk-2)', marginBottom: '2px' }}>{label}</p>
          <p style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: 'var(--muted)' }}>Analyzing your habits…</p>
        </div>
        <p style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '11px', color: '#FF5C1A' }}>{Math.round(pct)}%</p>
      </div>
      <div style={{ height: '2px', background: 'var(--muted-2)', borderRadius: '1px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, #FF5C1A, #FF8C5A)', borderRadius: '1px', transition: 'width 0.15s ease-out' }} />
      </div>
    </div>
  )
}

// ─── Hero Preview Cards ───────────────────────────────────────────────────────

function HeroPreview() {
  return (
    <div style={{ position: 'relative', height: '320px' }}>
      {/* Background coaching card */}
      <div className="hero-card-float-delay" style={{ position: 'absolute', right: 0, top: '20px', width: '82%', maxWidth: '300px', background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: '2px', overflow: 'hidden', opacity: 0.7 }}>
        <div style={{ width: '3px', position: 'absolute', left: 0, top: 0, bottom: 0, background: '#F5A623' }} />
        <div style={{ padding: '14px 16px 14px 20px' }}>
          <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '9px', color: '#F5A623', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>Warning · Positioning</div>
          <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--chalk)', marginBottom: '6px' }}>You&apos;re arriving late to your own plays</p>
          <p style={{ fontSize: '11px', color: 'var(--muted)', lineHeight: 1.6 }}>Low supersonic time means you&apos;re a half-second behind where you need to be.</p>
        </div>
      </div>

      {/* Foreground coaching card */}
      <div className="hero-card-float" style={{ position: 'absolute', left: 0, top: '60px', width: '88%', maxWidth: '320px', background: 'var(--surface-2)', border: '1px solid var(--border-3)', borderRadius: '2px', overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }}>
        <div style={{ width: '3px', position: 'absolute', left: 0, top: 0, bottom: 0, background: '#F54B4B' }} />
        <div style={{ padding: '16px 18px 16px 22px' }}>
          <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '9px', color: '#F54B4B', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>Critical · Boost</div>
          <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--chalk)', marginBottom: '8px', letterSpacing: '-0.01em' }}>You&apos;re running on empty</p>
          <p style={{ fontSize: '12px', color: 'var(--chalk-2)', lineHeight: 1.65, marginBottom: '12px' }}>You&apos;re going into 50/50s with near-zero boost. It&apos;s not a mechanics issue — it&apos;s a routing habit.</p>
          <div style={{ background: 'rgba(255,92,26,0.07)', border: '1px solid rgba(255,92,26,0.15)', borderRadius: '3px', padding: '8px 12px' }}>
            <p style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '9px', color: '#FF5C1A', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '3px' }}>Practice tonight</p>
            <p style={{ fontSize: '11px', color: 'var(--chalk-2)' }}>Collect every small pad within 2 car lengths of your rotation path.</p>
          </div>
        </div>
      </div>

      {/* Mini stat strip */}
      <div style={{ position: 'absolute', bottom: 0, left: '10px', right: '10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '2px', padding: '10px 16px', display: 'flex', gap: '20px' }}>
        {[
          { label: 'Avg Boost', value: '52', color: '#F5A623' },
          { label: 'Shot %',    value: '34%', color: '#FF5C1A' },
          { label: 'Offensive %', value: '38%', color: '#F54B4B' },
        ].map(s => (
          <div key={s.label}>
            <p style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '9px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>{s.label}</p>
            <p style={{ fontSize: '16px', fontWeight: 700, color: s.color, letterSpacing: '-0.02em', lineHeight: 1 }}>{s.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const [tab, setTab]             = useState<'name' | 'id' | 'upload'>('name')
  const [playerId, setPlayerId]   = useState('')
  const [platform, setPlatform]   = useState('steam')
  const [playlist, setPlaylist]   = useState('')
  const [idLoading, setIdLoading] = useState(false)
  const [loadPct, setLoadPct]     = useState(0)
  const [idResult, setIdResult]   = useState<ApiResponse | null>(null)
  const [searchedPlayer, setSearchedPlayer] = useState<{ name: string; avatarUrl?: string; id: string; platform: string } | null>(null)
  const [autoSearch, setAutoSearch] = useState(false)

  const [nameQuery, setNameQuery]     = useState('')
  const [nameLoading, setNameLoading] = useState(false)
  const [nameResult, setNameResult]   = useState<DiscoverResponse | null>(null)

  const [dragOver, setDragOver]             = useState(false)
  const [uploadLoading, setUploadLoading]   = useState(false)
  const [uploadResult, setUploadResult]     = useState<UploadResponse | null>(null)
  const [selectedPlayer, setSelectedPlayer] = useState<UploadPlayer | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)

  // Demo mode
  const [demoMode, setDemoMode] = useState(false)
  const [radarCategory, setRadarCategory] = useState<string | null>(null)

  // Auto-search on teammate click
  const autoRef = useRef(false)
  if (autoSearch && !autoRef.current) {
    autoRef.current = true
    setTimeout(() => {
      autoRef.current = false
      setAutoSearch(false)
      if (playerId.trim()) runSearch(playerId.trim(), platform, '')
    }, 0)
  }

  async function runSearch(id: string, plat: string, pl: string, refresh = false) {
    setDemoMode(false)
    setIdLoading(true)
    setIdResult(null)
    setSearchedPlayer(null)
    setLoadPct(0)

    let pct = 0
    const timer = setInterval(() => {
      const pull = pct < 55 ? 0.09 : pct < 78 ? 0.04 : 0.007
      pct = Math.min(pct + (95 - pct) * pull, 94)
      setLoadPct(pct)
    }, 150)

    const pp = pl ? `&playlist=${encodeURIComponent(pl)}` : ''
    const rr = refresh ? '&refresh=true' : ''
    const data: ApiResponse = await fetch(`/api/stats?playerId=${encodeURIComponent(id)}&platform=${plat}${pp}${rr}`).then(r => r.json())

    clearInterval(timer)
    setLoadPct(100)
    if (!data.cached) await new Promise(r => setTimeout(r, 220))
    setIdResult(data)
    setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)

    let displayN = data?.stats?.playerName ?? id
    let avatarUrl: string | null = null
    if (plat === 'steam') {
      try {
        const np = data?.stats?.playerName ? `&name=${encodeURIComponent(data.stats.playerName)}` : ''
        const profile = await fetch(`/api/steamprofile?steamId=${encodeURIComponent(id)}${np}`).then(r => r.json())
        if (profile?.name) displayN = profile.name
        if (profile?.avatarUrl) avatarUrl = profile.avatarUrl
      } catch { /* silent */ }
    }
    setSearchedPlayer({ name: displayN, avatarUrl: avatarUrl ?? undefined, id, platform: plat })
    setIdLoading(false)
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!playerId.trim()) return
    runSearch(playerId.trim(), platform, playlist)
  }

  async function handleNameSearch(e: React.FormEvent) {
    e.preventDefault()
    const q = nameQuery.trim()
    if (q.length < 2) return
    setNameLoading(true); setNameResult(null)
    const data: DiscoverResponse = await fetch('/api/discover', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: q }) }).then(r => r.json())
    setNameResult(data); setNameLoading(false)
  }

  function selectCandidate(c: PlayerCandidate) {
    setTab('id'); setPlayerId(c.id); setPlatform(c.platform); setNameResult(null); setAutoSearch(true)
  }

  async function handleUpload(file: File) {
    if (!file.name.endsWith('.replay')) { setUploadResult({ error: 'Please select a .replay file.' }); return }
    setUploadLoading(true); setUploadResult(null); setSelectedPlayer(null)
    const form = new FormData(); form.append('replay', file)
    const data: UploadResponse = await fetch('/api/upload', { method: 'POST', body: form }).then(r => r.json())
    setUploadResult(data); setUploadLoading(false)
  }

  function loadDemo() {
    setDemoMode(true)
    setIdResult(null)
    setSearchedPlayer({ name: 'SamplePlayer', id: 'demo', platform: 'steam' })
    setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
  }

  const activeStats: Stats | null = demoMode ? SAMPLE_STATS
    : tab === 'id' ? (idResult?.stats ?? null)
    : tab === 'upload' && selectedPlayer ? singleReplayToStats(selectedPlayer.stats as Record<string, Record<string, number>>)
    : null

  const tips = activeStats ? generateAdvice(activeStats) : []
  const sorted = [...tips].sort((a, b) => ({ critical: 0, warning: 1, good: 2 }[a.severity]) - ({ critical: 0, warning: 1, good: 2 }[b.severity]))
  const practice = getPracticeTonight(sorted)
  const rankInfo = (demoMode ? SAMPLE_STATS : idResult?.stats)?.playerRank?.tier != null
    ? (RANK_NAMES[(demoMode ? SAMPLE_STATS : idResult!.stats!)!.playerRank!.tier!] ?? null) : null

  const inputStyle: React.CSSProperties = {
    background: 'var(--surface-2)', border: '1px solid var(--border-2)',
    borderRadius: '2px', padding: '11px 14px', fontSize: '13px',
    color: 'var(--chalk)', fontFamily: 'var(--font-geist-mono)', outline: 'none', width: '100%',
  }
  const selectStyle: React.CSSProperties = {
    background: 'var(--surface-2)', border: '1px solid var(--border-2)',
    borderRadius: '2px', padding: '10px 12px', fontSize: '12px',
    color: 'var(--muted)', fontFamily: 'var(--font-geist-mono)', outline: 'none',
  }
  // Mascot state — loading, results, error, or idle only
  const boostState: BoostState =
    idLoading || uploadLoading ? 'analyzing'
    : activeStats && sorted.length > 0 ? 'success'
    : idResult?.error ? 'error'
    : 'idle'

  return (
    <main className="page-grid" style={{ minHeight: '100vh', background: 'var(--pitch)', color: 'var(--chalk)' }}>

      {/* ── Nav ── */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(7,9,11,0.92)', backdropFilter: 'blur(16px)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '0 24px', height: '52px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Boost state={boostState} size={26} />
            <span style={{ fontWeight: 700, fontSize: '14px', letterSpacing: '-0.02em' }}>NeedBoost</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div className="status-dot" style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#22C97A' }} />
              <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Analysis Ready</span>
            </div>
            <button onClick={loadDemo} style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: 'var(--muted)', background: 'none', border: '1px solid var(--border-2)', borderRadius: '2px', padding: '4px 10px', cursor: 'pointer', letterSpacing: '0.06em', textTransform: 'uppercase', transition: 'color 0.15s' }}>
              View Sample
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <div className="tele-grid" style={{ borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '64px 24px 72px', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 360px)', gap: '48px', alignItems: 'center' }}>

          {/* Left — copy + search */}
          <div>
            <p className="fade-up" style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: '#FF5C1A', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ display: 'inline-block', width: '20px', height: '1px', background: '#FF5C1A' }} />
              Rocket League Coaching
            </p>

            <h1 className="fade-up-1" style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 800, letterSpacing: '-0.045em', lineHeight: 1.0, marginBottom: '18px' }}>
              Your replays know<br />
              <span style={{ color: '#FF5C1A' }}>what you don&apos;t.</span>
            </h1>

            <p className="fade-up-2" style={{ fontSize: '14px', color: 'var(--chalk-2)', lineHeight: 1.8, marginBottom: '32px', maxWidth: '400px' }}>
              NeedBoost reads your last 10 games, identifies the habits holding you back, and tells you exactly what to practice tonight. Not statistics. Coaching.
            </p>

            {/* Tab row */}
            <div className="fade-up-3" style={{ display: 'flex', gap: '2px', marginBottom: '16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '3px', padding: '3px', width: 'fit-content' }}>
              {([
                { key: 'id',     label: 'Player ID'     },
                { key: 'name',   label: 'Find by Name'  },
                { key: 'upload', label: 'Upload Replay'  },
              ] as { key: 'name' | 'id' | 'upload'; label: string }[]).map(t => (
                <button key={t.key} onClick={() => setTab(t.key)} style={{
                  padding: '7px 14px', borderRadius: '2px', fontSize: '12px', fontWeight: 500,
                  border: 'none', cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
                  background: tab === t.key ? '#FF5C1A' : 'transparent',
                  color: tab === t.key ? '#fff' : 'var(--muted)',
                }}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* ── Player ID ── */}
            {tab === 'id' && (
              <div className="fade-up-4" style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '480px' }}>
                <form onSubmit={handleSearch} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <input type="text" value={playerId} onChange={e => setPlayerId(e.target.value)}
                    placeholder="Ballchasing player ID" style={inputStyle} />
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <select value={platform} onChange={e => setPlatform(e.target.value)} style={{ ...selectStyle, width: '30%' }}>
                      {PLATFORMS.map(p => <option key={p.value} value={p.value} style={{ background: '#0C0F12' }}>{p.label}</option>)}
                    </select>
                    <select value={playlist} onChange={e => setPlaylist(e.target.value)} style={{ ...selectStyle, flex: 1 }}>
                      {PLAYLISTS.map(p => <option key={p.value} value={p.value} style={{ background: '#0C0F12' }}>{p.label}</option>)}
                    </select>
                    <button type="submit" disabled={idLoading || !playerId.trim()} style={{
                      background: '#FF5C1A', color: '#fff', border: 'none', borderRadius: '2px',
                      padding: '10px 18px', fontSize: '13px', fontWeight: 700,
                      cursor: idLoading || !playerId.trim() ? 'not-allowed' : 'pointer',
                      opacity: idLoading || !playerId.trim() ? 0.4 : 1,
                      whiteSpace: 'nowrap', letterSpacing: '-0.01em',
                    }}>
                      {idLoading ? '…' : 'Start My Analysis →'}
                    </button>
                  </div>
                </form>
                {idLoading && <AnalysisProgress pct={loadPct} />}
                {idResult?.error && (
                  <div style={{ background: 'rgba(245,75,75,0.08)', border: '1px solid rgba(245,75,75,0.18)', borderRadius: '2px', padding: '10px 14px', fontSize: '12px', color: '#F54B4B' }}>
                    {idResult.error}
                  </div>
                )}
                <p style={{ fontSize: '11px', color: 'var(--muted)' }}>
                  Find your ID on <a href="https://ballchasing.com" target="_blank" rel="noreferrer" style={{ color: '#FF5C1A', textDecoration: 'none' }}>ballchasing.com</a> → search your name → copy from profile URL
                </p>
              </div>
            )}

            {/* ── Find by Name ── */}
            {tab === 'name' && (
              <div className="fade-up-4" style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '480px' }}>
                <form onSubmit={handleNameSearch} style={{ display: 'flex', gap: '6px' }}>
                  <input type="text" value={nameQuery} onChange={e => setNameQuery(e.target.value)}
                    placeholder="Your Rocket League display name"
                    style={{ ...inputStyle, flex: 1 }} />
                  <button type="submit" disabled={nameLoading || nameQuery.trim().length < 2} style={{
                    background: '#FF5C1A', color: '#fff', border: 'none', borderRadius: '2px',
                    padding: '10px 18px', fontSize: '13px', fontWeight: 700,
                    cursor: nameLoading || nameQuery.trim().length < 2 ? 'not-allowed' : 'pointer',
                    opacity: nameLoading || nameQuery.trim().length < 2 ? 0.4 : 1, whiteSpace: 'nowrap',
                  }}>{nameLoading ? '…' : 'Search →'}</button>
                </form>
                <p style={{ fontSize: '11px', color: 'var(--muted)' }}>
                  Note: Ballchasing&apos;s name search only covers accounts that have personally uploaded replays. If no results appear, use Player ID.
                </p>
                {nameResult?.error && nameResult.candidates.length === 0 && (
                  <div style={{ background: 'rgba(245,75,75,0.08)', border: '1px solid rgba(245,75,75,0.18)', borderRadius: '2px', padding: '10px 14px', fontSize: '12px', color: '#F54B4B' }}>{nameResult.error}</div>
                )}
                {nameResult && nameResult.candidates.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <p style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Select your account</p>
                    {nameResult.candidates.map(c => (
                      <button key={`${c.platform}:${c.id}`} onClick={() => selectCandidate(c)}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: '2px', padding: '10px 14px', cursor: 'pointer', color: 'var(--chalk)', textAlign: 'left' }}>
                        <div>
                          <p style={{ fontSize: '13px', fontWeight: 600 }}>{displayName(c.name)}</p>
                          <p style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>{c.platform} · {c.id.slice(0, 16)}… · {c.replayCount} replays</p>
                        </div>
                        <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Analyze →</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Upload ── */}
            {tab === 'upload' && (
              <div className="fade-up-4" style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '480px' }}>
                <div onDragOver={e => { e.preventDefault(); setDragOver(true) }} onDragLeave={() => setDragOver(false)}
                  onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) handleUpload(f) }}
                  onClick={() => fileRef.current?.click()}
                  style={{ border: `1px dashed ${dragOver ? '#FF5C1A' : 'var(--border-2)'}`, borderRadius: '2px', padding: '32px 20px', textAlign: 'center', cursor: 'pointer', background: dragOver ? 'rgba(255,92,26,0.04)' : 'var(--surface-2)' }}>
                  <input ref={fileRef} type="file" accept=".replay" onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f) }} style={{ display: 'none' }} />
                  {uploadLoading ? <p style={{ fontSize: '13px', color: 'var(--muted)' }}>Uploading…</p> : (
                    <>
                      <p style={{ fontSize: '22px', marginBottom: '8px' }}>📁</p>
                      <p style={{ fontSize: '13px', color: 'var(--chalk-2)', fontWeight: 500 }}>Drop your .replay file here</p>
                      <p style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '3px' }}>or click to browse</p>
                    </>
                  )}
                </div>
                {uploadResult?.error && <div style={{ background: 'rgba(245,75,75,0.08)', border: '1px solid rgba(245,75,75,0.18)', borderRadius: '2px', padding: '10px 14px', fontSize: '12px', color: '#F54B4B' }}>{uploadResult.error}</div>}
                {uploadResult?.players && !selectedPlayer && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <p style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Who are you?</p>
                    {uploadResult.players.map(p => (
                      <button key={p.id} onClick={() => { setSelectedPlayer(p); setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80) }} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: '2px', padding: '10px 14px', cursor: 'pointer', color: 'var(--chalk)' }}>
                        <span style={{ fontSize: '13px', fontWeight: 500 }}>{displayName(p.name)}</span>
                        <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase' }}>{p.platform}</span>
                      </button>
                    ))}
                  </div>
                )}
                {selectedPlayer && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: '2px', padding: '10px 14px' }}>
                    <p style={{ fontSize: '13px', fontWeight: 500 }}>{displayName(selectedPlayer.name)}</p>
                    <button onClick={() => { setSelectedPlayer(null); setUploadResult(null) }} style={{ fontSize: '11px', color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }}>Clear</button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right — hero preview */}
          <div style={{ overflow: 'hidden', position: 'relative' }}>
            <HeroPreview />
          </div>

        </div>
      </div>

      {/* ── Results ── */}
      {activeStats && (
        <div ref={resultsRef} style={{ maxWidth: '1000px', margin: '0 auto', padding: '48px 24px 100px' }}>

          {/* Player header */}
          <div className="slide-in" style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '40px', paddingBottom: '24px', borderBottom: '1px solid var(--border)' }}>
            <Boost state={boostState} size={48} />
            {searchedPlayer?.avatarUrl && (
              <img src={searchedPlayer.avatarUrl} alt="" style={{ width: '44px', height: '44px', borderRadius: '2px', border: '1px solid var(--border-2)', flexShrink: 0 }} />
            )}
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <p style={{ fontSize: '1.2rem', fontWeight: 700, letterSpacing: '-0.03em' }}>
                  {demoMode ? 'Sample Analysis' : displayName(searchedPlayer?.name ?? playerId)}
                </p>
                {rankInfo && (
                  <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', padding: '2px 8px', borderRadius: '2px', border: `1px solid ${rankInfo.color}35`, background: `${rankInfo.color}12`, color: rankInfo.color }}>
                    {rankInfo.name}
                  </span>
                )}
                {demoMode && (
                  <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', padding: '2px 8px', borderRadius: '2px', border: '1px solid rgba(245,166,35,0.3)', background: 'rgba(245,166,35,0.08)', color: '#F5A623' }}>
                    Demo
                  </span>
                )}
                {idResult?.cached && !demoMode && (
                  <>
                    <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', padding: '2px 8px', borderRadius: '2px', border: '1px solid rgba(34,201,122,0.25)', background: 'rgba(34,201,122,0.08)', color: '#22C97A' }}>cached</span>
                    <button onClick={() => runSearch(searchedPlayer?.id ?? playerId, searchedPlayer?.platform ?? platform, playlist, true)}
                      style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', padding: '2px 8px', borderRadius: '2px', background: 'transparent', color: 'var(--muted)', border: '1px solid var(--border)', cursor: 'pointer' }}>
                      ↻ Refresh
                    </button>
                  </>
                )}
              </div>
              <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '3px' }}>
                {demoMode ? 'Diamond II · 10 replays · sample data' : `${activeStats.gamesAnalyzed} replays analyzed`}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              {[
                { label: 'Fix',      count: sorted.filter(t => t.severity === 'critical').length, color: '#F54B4B' },
                { label: 'Improve',  count: sorted.filter(t => t.severity === 'warning').length,  color: '#F5A623' },
                { label: 'Strong',   count: sorted.filter(t => t.severity === 'good').length,     color: '#22C97A' },
              ].map(({ label, count, color }) => (
                <div key={label} style={{ textAlign: 'center', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '2px', padding: '8px 12px', minWidth: '52px' }}>
                  <p style={{ fontSize: '1.15rem', fontWeight: 700, color, lineHeight: 1 }}>{count}</p>
                  <p style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '9px', color: 'var(--muted)', marginTop: '3px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── What to practice tonight ── */}
          {practice && (
            <div className="practice-section" style={{ padding: '20px 20px 20px 26px', marginBottom: '40px' }}
>
              <p style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: '#FF5C1A', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: '8px' }}>
                // What to practice tonight
              </p>
              <p style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '8px', color: 'var(--chalk)' }}>{practice.title}</p>
              <p style={{ fontSize: '13px', color: 'var(--chalk-2)', lineHeight: 1.75 }}>{practice.drill}</p>
            </div>
          )}

          {/* Two column layout — coaching on left, charts on right */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px', alignItems: 'start', marginBottom: '32px' }}>

            {/* Coaching cards */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                <div style={{ width: '2px', height: '12px', borderRadius: '1px', background: 'var(--velocity)' }} />
                <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '11px', color: 'var(--muted-bright)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Coaching Feedback</span>
                <div style={{ flex: 1, height: '1px', background: 'var(--border-default)' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {sorted.map((tip, i) => <CoachingCard key={i} tip={tip} index={i} connected={radarCategory === tip.category} />)}
              </div>
            </div>

            {/* Charts */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <RadarChartComponent stats={activeStats} onAxisHover={setRadarCategory} />
              <FieldZoneChart stats={activeStats} />
            </div>
          </div>

          {/* Evidence — 2x2 card grid grouped by coaching category */}
          <div style={{ marginBottom: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <div style={{ width: '2px', height: '12px', borderRadius: '1px', background: 'linear-gradient(180deg, #4CC9F0, rgba(76,201,240,0.3))' }} />
              <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '11px', color: '#4CC9F0', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Evidence</span>
              <div style={{ flex: 1, height: '1px', background: 'rgba(76,201,240,0.1)' }} />
              <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '9px', color: 'rgba(76,201,240,0.35)', letterSpacing: '0.08em' }}>per game avg</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '8px' }}>
              {[
                { group: 'Offense',     color: '#FF5C1A', stats: [
                  { label: 'Goals',    value: activeStats.goalsPerGame },
                  { label: 'Assists',  value: activeStats.assistsPerGame },
                  { label: 'Shots',    value: activeStats.shotsPerGame },
                  { label: 'Shot %',   value: `${activeStats.shotAccuracy}%` },
                ]},
                { group: 'Defense',     color: '#3B8BF5', stats: [
                  { label: 'Saves',        value: activeStats.savesPerGame },
                  { label: 'Defensive %',  value: `${activeStats.defensivePct}%` },
                  { label: 'Avg Score',    value: activeStats.avgScore },
                  { label: 'Demos Taken',  value: activeStats.demosTakenPerGame },
                ]},
                { group: 'Boost',       color: '#F5A623', stats: [
                  { label: 'Avg Boost',  value: activeStats.avgBoost },
                  { label: 'Stolen',     value: activeStats.boostStolenPerGame },
                  { label: 'Supersonic', value: `${activeStats.supersonicPct}%` },
                  { label: 'Slow %',     value: `${activeStats.slowPct}%` },
                ]},
                { group: 'Positioning', color: '#22C97A', stats: [
                  { label: 'Offensive %', value: `${activeStats.offensivePct}%` },
                  { label: 'Neutral %',   value: `${activeStats.neutralPct}%` },
                  { label: 'Big Pads',    value: activeStats.bigPadsPerGame },
                  { label: 'Demos Given', value: activeStats.demosInflictedPerGame },
                ]},
              ].map(({ group, color, stats: gs }) => (
                <div key={group} style={{
                  background: 'var(--surface-1)',
                  border: '1px solid var(--border-default)',
                  borderRadius: '2px',
                  overflow: 'hidden',
                  position: 'relative',
                }}>
                  {/* Left color bar */}
                  <div style={{
                    position: 'absolute', left: 0, top: 0, bottom: 0,
                    width: '2px', background: color, opacity: 0.7,
                  }} />
                  {/* Category header */}
                  <div style={{
                    padding: '10px 12px 8px 14px',
                    borderBottom: '1px solid var(--border-subtle)',
                    display: 'flex', alignItems: 'center', gap: '6px',
                  }}>
                    <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: color, opacity: 0.8 }} />
                    <span style={{
                      fontFamily: 'var(--font-geist-mono)',
                      fontSize: '11px', fontWeight: 600,
                      color, textTransform: 'uppercase', letterSpacing: '0.1em',
                    }}>{group}</span>
                  </div>
                  {/* 2x2 stat grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: 'var(--border-subtle)' }}>
                    {gs.map(({ label, value }) => (
                      <div key={label} className="stat-value" style={{
                        padding: '10px 12px',
                        background: 'var(--surface-1)',
                      }}>
                        <p style={{
                          fontFamily: 'var(--font-geist-mono)',
                          fontSize: '10px', color: 'var(--muted-bright)',
                          textTransform: 'uppercase', letterSpacing: '0.05em',
                          marginBottom: '3px',
                        }}>{label}</p>
                        <p style={{
                          fontSize: '1.2rem', fontWeight: 700,
                          letterSpacing: '-0.03em', color: 'var(--chalk)', lineHeight: 1,
                        }}>
                          {value}
                          <span style={{
                            display: 'inline-block', width: '4px', height: '4px',
                            borderRadius: '50%', background: color,
                            marginLeft: '4px', verticalAlign: 'middle', opacity: 0.55,
                          }} />
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Most Played With */}
          {activeStats.topTeammates && activeStats.topTeammates.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <div style={{ width: '2px', height: '12px', borderRadius: '1px', background: 'var(--muted-2)' }} />
                <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '11px', color: 'var(--muted-bright)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Most Played With</span>
                <div style={{ flex: 1, height: '1px', background: 'var(--border-default)' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '6px' }}>
                {activeStats.topTeammates.map((tm: Teammate) => (
                  <button key={tm.id} onClick={() => { setTab('id'); setPlayerId(tm.id); setPlatform(tm.platform || 'steam'); setAutoSearch(true) }}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '2px', padding: '10px 14px', cursor: 'pointer', color: 'var(--chalk)', textAlign: 'left' }}>
                    <div>
                      <p style={{ fontSize: '13px', fontWeight: 500 }}>{displayName(tm.name)}</p>
                      <p style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: 'var(--muted)', marginTop: '2px', textTransform: 'uppercase' }}>
                        {tm.platform} · {tm.count} game{tm.count !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Analyze →</span>
                  </button>
                ))}
              </div>
            </div>
          )}

        </div>
      )}

      {/* ── Footer ── */}
      <footer style={{ borderTop: '1px solid var(--border)', padding: '20px 24px', textAlign: 'center' }}>
        <p style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: 'var(--muted)', letterSpacing: '0.06em' }}>
          NEEDBOOST · POWERED BY <a href="https://ballchasing.com" target="_blank" rel="noreferrer" style={{ color: '#FF5C1A', textDecoration: 'none' }}>BALLCHASING</a>
        </p>
      </footer>

    </main>
  )
}
