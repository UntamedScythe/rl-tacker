'use client'

/**
 * RankIcon — Rocket League rank icons as clean SVG components
 * 
 * Faithful geometric reproductions of the official rank emblems.
 * Each rank has its distinctive shape, color, and division marker.
 * 
 * Tier mapping (matches Ballchasing API playerRank.tier):
 * 0 = Unranked
 * 1-3 = Bronze I/II/III
 * 4-6 = Silver I/II/III  
 * 7-9 = Gold I/II/III
 * 10-12 = Platinum I/II/III
 * 13-15 = Diamond I/II/III
 * 16-18 = Champion I/II/III
 * 19-21 = Grand Champion I/II/III
 * 22 = Supersonic Legend
 */

export type RankInfo = {
  tier: number
  name: string
  shortName: string
  division: string
  color: string
  glowColor: string
}

export function getRankInfo(tier: number): RankInfo {
  if (tier <= 0) return { tier: 0,  name: 'Unranked',           shortName: 'UN',  division: '',     color: '#888888', glowColor: 'rgba(136,136,136,0.3)' }
  if (tier === 1)  return { tier: 1,  name: 'Bronze I',           shortName: 'B1',  division: 'I',    color: '#cd7f32', glowColor: 'rgba(205,127,50,0.3)'  }
  if (tier === 2)  return { tier: 2,  name: 'Bronze II',          shortName: 'B2',  division: 'II',   color: '#cd7f32', glowColor: 'rgba(205,127,50,0.3)'  }
  if (tier === 3)  return { tier: 3,  name: 'Bronze III',         shortName: 'B3',  division: 'III',  color: '#cd7f32', glowColor: 'rgba(205,127,50,0.3)'  }
  if (tier === 4)  return { tier: 4,  name: 'Silver I',           shortName: 'S1',  division: 'I',    color: '#a8a9ad', glowColor: 'rgba(168,169,173,0.3)' }
  if (tier === 5)  return { tier: 5,  name: 'Silver II',          shortName: 'S2',  division: 'II',   color: '#a8a9ad', glowColor: 'rgba(168,169,173,0.3)' }
  if (tier === 6)  return { tier: 6,  name: 'Silver III',         shortName: 'S3',  division: 'III',  color: '#a8a9ad', glowColor: 'rgba(168,169,173,0.3)' }
  if (tier === 7)  return { tier: 7,  name: 'Gold I',             shortName: 'G1',  division: 'I',    color: '#FFD700', glowColor: 'rgba(255,215,0,0.3)'   }
  if (tier === 8)  return { tier: 8,  name: 'Gold II',            shortName: 'G2',  division: 'II',   color: '#FFD700', glowColor: 'rgba(255,215,0,0.3)'   }
  if (tier === 9)  return { tier: 9,  name: 'Gold III',           shortName: 'G3',  division: 'III',  color: '#FFD700', glowColor: 'rgba(255,215,0,0.3)'   }
  if (tier === 10) return { tier: 10, name: 'Platinum I',         shortName: 'P1',  division: 'I',    color: '#00b4d8', glowColor: 'rgba(0,180,216,0.3)'   }
  if (tier === 11) return { tier: 11, name: 'Platinum II',        shortName: 'P2',  division: 'II',   color: '#00b4d8', glowColor: 'rgba(0,180,216,0.3)'   }
  if (tier === 12) return { tier: 12, name: 'Platinum III',       shortName: 'P3',  division: 'III',  color: '#00b4d8', glowColor: 'rgba(0,180,216,0.3)'   }
  if (tier === 13) return { tier: 13, name: 'Diamond I',          shortName: 'D1',  division: 'I',    color: '#4cc9f0', glowColor: 'rgba(76,201,240,0.35)' }
  if (tier === 14) return { tier: 14, name: 'Diamond II',         shortName: 'D2',  division: 'II',   color: '#4cc9f0', glowColor: 'rgba(76,201,240,0.35)' }
  if (tier === 15) return { tier: 15, name: 'Diamond III',        shortName: 'D3',  division: 'III',  color: '#4cc9f0', glowColor: 'rgba(76,201,240,0.35)' }
  if (tier === 16) return { tier: 16, name: 'Champion I',         shortName: 'C1',  division: 'I',    color: '#9b5de5', glowColor: 'rgba(155,93,229,0.35)' }
  if (tier === 17) return { tier: 17, name: 'Champion II',        shortName: 'C2',  division: 'II',   color: '#9b5de5', glowColor: 'rgba(155,93,229,0.35)' }
  if (tier === 18) return { tier: 18, name: 'Champion III',       shortName: 'C3',  division: 'III',  color: '#9b5de5', glowColor: 'rgba(155,93,229,0.35)' }
  if (tier === 19) return { tier: 19, name: 'Grand Champion I',   shortName: 'GC1', division: 'I',    color: '#f72585', glowColor: 'rgba(247,37,133,0.4)'  }
  if (tier === 20) return { tier: 20, name: 'Grand Champion II',  shortName: 'GC2', division: 'II',   color: '#f72585', glowColor: 'rgba(247,37,133,0.4)'  }
  if (tier === 21) return { tier: 21, name: 'Grand Champion III', shortName: 'GC3', division: 'III',  color: '#f72585', glowColor: 'rgba(247,37,133,0.4)'  }
  return { tier: 22, name: 'Supersonic Legend', shortName: 'SSL', division: '', color: '#ff9e00', glowColor: 'rgba(255,158,0,0.4)' }
}

// ── Tier group: which rank family does this tier belong to ────────────────────
function getTierGroup(tier: number): string {
  if (tier <= 0)  return 'unranked'
  if (tier <= 3)  return 'bronze'
  if (tier <= 6)  return 'silver'
  if (tier <= 9)  return 'gold'
  if (tier <= 12) return 'platinum'
  if (tier <= 15) return 'diamond'
  if (tier <= 18) return 'champion'
  if (tier <= 21) return 'grandchampion'
  return 'ssl'
}

interface RankIconProps {
  tier: number
  size?: number
  showGlow?: boolean
  className?: string
}

export default function RankIcon({ tier, size = 32, showGlow = true, className }: RankIconProps) {
  const rank = getRankInfo(tier)
  const group = getTierGroup(tier)
  const c = rank.color
  const s = size
  const cx = s / 2
  const cy = s / 2

  // Division dots — shown inside the emblem for I/II/III
  const divisionDots = tier !== 22 && tier !== 0 ? (
    <>
      {/* 1 dot = I, 2 dots = II, 3 dots = III */}
      {[1, 2, 3].map(i => {
        const division = ((tier - 1) % 3) + 1
        const active = i <= division
        const spacing = s * 0.14
        const dotX = cx + (i - 2) * spacing
        const dotY = cy + s * 0.22
        const r = s * 0.045
        return (
          <circle
            key={i}
            cx={dotX} cy={dotY} r={r}
            fill={active ? c : `${c}30`}
          />
        )
      })}
    </>
  ) : null

  // ── UNRANKED ──────────────────────────────────────────────────────────────
  if (group === 'unranked') {
    return (
      <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} fill="none" className={className}>
        <circle cx={cx} cy={cy} r={s * 0.42} stroke="#888" strokeWidth={s * 0.06} strokeDasharray={`${s * 0.15} ${s * 0.08}`} fill="none" />
        <circle cx={cx} cy={cy} r={s * 0.12} fill="#888" fillOpacity="0.4" />
      </svg>
    )
  }

  // ── BRONZE ────────────────────────────────────────────────────────────────
  // Shield shape with angular cuts
  if (group === 'bronze') {
    const shieldPath = `
      M ${cx} ${cy - s * 0.4}
      L ${cx + s * 0.38} ${cy - s * 0.2}
      L ${cx + s * 0.38} ${cy + s * 0.1}
      L ${cx} ${cy + s * 0.42}
      L ${cx - s * 0.38} ${cy + s * 0.1}
      L ${cx - s * 0.38} ${cy - s * 0.2}
      Z
    `
    return (
      <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} fill="none" className={className} style={{ overflow: 'visible' }}>
        {showGlow && <path d={shieldPath} fill={rank.glowColor} style={{ filter: `blur(${s * 0.15}px)`, transform: 'scale(1.1)', transformOrigin: 'center' }} />}
        <path d={shieldPath} fill={`${c}18`} stroke={c} strokeWidth={s * 0.05} />
        <path d={`M ${cx} ${cy - s * 0.25} L ${cx + s * 0.24} ${cy - s * 0.1} L ${cx} ${cy + s * 0.28} L ${cx - s * 0.24} ${cy - s * 0.1} Z`}
          fill={c} fillOpacity="0.15" />
        <line x1={cx} y1={cy - s * 0.25} x2={cx} y2={cy + s * 0.05} stroke={c} strokeWidth={s * 0.04} strokeOpacity="0.6" />
        {divisionDots}
      </svg>
    )
  }

  // ── SILVER ────────────────────────────────────────────────────────────────
  // Wider shield with notched top
  if (group === 'silver') {
    const shieldPath = `
      M ${cx - s * 0.15} ${cy - s * 0.42}
      L ${cx + s * 0.15} ${cy - s * 0.42}
      L ${cx + s * 0.4} ${cy - s * 0.18}
      L ${cx + s * 0.4} ${cy + s * 0.08}
      L ${cx} ${cy + s * 0.43}
      L ${cx - s * 0.4} ${cy + s * 0.08}
      L ${cx - s * 0.4} ${cy - s * 0.18}
      Z
    `
    return (
      <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} fill="none" className={className} style={{ overflow: 'visible' }}>
        {showGlow && <path d={shieldPath} fill={rank.glowColor} style={{ filter: `blur(${s * 0.15}px)`, transform: 'scale(1.1)', transformOrigin: 'center' }} />}
        <path d={shieldPath} fill={`${c}15`} stroke={c} strokeWidth={s * 0.05} />
        <ellipse cx={cx} cy={cy - s * 0.06} rx={s * 0.2} ry={s * 0.2} fill={c} fillOpacity="0.12" stroke={c} strokeWidth={s * 0.03} strokeOpacity="0.5" />
        {divisionDots}
      </svg>
    )
  }

  // ── GOLD ──────────────────────────────────────────────────────────────────
  // Ornate shield with top flourishes
  if (group === 'gold') {
    const shieldPath = `
      M ${cx} ${cy - s * 0.44}
      L ${cx + s * 0.12} ${cy - s * 0.36}
      L ${cx + s * 0.42} ${cy - s * 0.2}
      L ${cx + s * 0.42} ${cy + s * 0.1}
      L ${cx} ${cy + s * 0.44}
      L ${cx - s * 0.42} ${cy + s * 0.1}
      L ${cx - s * 0.42} ${cy - s * 0.2}
      L ${cx - s * 0.12} ${cy - s * 0.36}
      Z
    `
    return (
      <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} fill="none" className={className} style={{ overflow: 'visible' }}>
        {showGlow && <path d={shieldPath} fill={rank.glowColor} style={{ filter: `blur(${s * 0.15}px)`, transform: 'scale(1.15)', transformOrigin: 'center' }} />}
        <path d={shieldPath} fill={`${c}15`} stroke={c} strokeWidth={s * 0.055} />
        <polygon points={`${cx},${cy - s * 0.22} ${cx + s * 0.18},${cy} ${cx},${cy + s * 0.22} ${cx - s * 0.18},${cy}`}
          fill={c} fillOpacity="0.18" stroke={c} strokeWidth={s * 0.03} strokeOpacity="0.6" />
        {divisionDots}
      </svg>
    )
  }

  // ── PLATINUM ──────────────────────────────────────────────────────────────
  // Crystal/angular shape
  if (group === 'platinum') {
    const shieldPath = `
      M ${cx} ${cy - s * 0.44}
      L ${cx + s * 0.44} ${cy - s * 0.1}
      L ${cx + s * 0.3} ${cy + s * 0.42}
      L ${cx - s * 0.3} ${cy + s * 0.42}
      L ${cx - s * 0.44} ${cy - s * 0.1}
      Z
    `
    return (
      <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} fill="none" className={className} style={{ overflow: 'visible' }}>
        {showGlow && <path d={shieldPath} fill={rank.glowColor} style={{ filter: `blur(${s * 0.18}px)`, transform: 'scale(1.1)', transformOrigin: 'center' }} />}
        <path d={shieldPath} fill={`${c}12`} stroke={c} strokeWidth={s * 0.055} />
        {/* Inner crystal facets */}
        <line x1={cx} y1={cy - s * 0.44} x2={cx + s * 0.44} y2={cy - s * 0.1} stroke={c} strokeWidth={s * 0.025} strokeOpacity="0.3" />
        <line x1={cx} y1={cy - s * 0.44} x2={cx - s * 0.44} y2={cy - s * 0.1} stroke={c} strokeWidth={s * 0.025} strokeOpacity="0.3" />
        <line x1={cx} y1={cy - s * 0.44} x2={cx} y2={cy + s * 0.42} stroke={c} strokeWidth={s * 0.03} strokeOpacity="0.35" />
        <circle cx={cx} cy={cy - s * 0.06} r={s * 0.12} fill={c} fillOpacity="0.15" stroke={c} strokeWidth={s * 0.03} strokeOpacity="0.6" />
        {divisionDots}
      </svg>
    )
  }

  // ── DIAMOND ───────────────────────────────────────────────────────────────
  // Gem/diamond cut shape
  if (group === 'diamond') {
    return (
      <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} fill="none" className={className} style={{ overflow: 'visible' }}>
        {showGlow && (
          <polygon
            points={`${cx},${cy - s * 0.44} ${cx + s * 0.44},${cy} ${cx},${cy + s * 0.44} ${cx - s * 0.44},${cy}`}
            fill={rank.glowColor}
            style={{ filter: `blur(${s * 0.18}px)`, transform: 'scale(1.15)', transformOrigin: 'center' }}
          />
        )}
        {/* Outer diamond */}
        <polygon
          points={`${cx},${cy - s * 0.44} ${cx + s * 0.44},${cy} ${cx},${cy + s * 0.44} ${cx - s * 0.44},${cy}`}
          fill={`${c}12`} stroke={c} strokeWidth={s * 0.055}
        />
        {/* Top facet */}
        <polygon
          points={`${cx},${cy - s * 0.44} ${cx + s * 0.25},${cy - s * 0.08} ${cx - s * 0.25},${cy - s * 0.08}`}
          fill={c} fillOpacity="0.2"
        />
        {/* Inner gem */}
        <polygon
          points={`${cx},${cy - s * 0.18} ${cx + s * 0.2},${cy + s * 0.04} ${cx},${cy + s * 0.26} ${cx - s * 0.2},${cy + s * 0.04}`}
          fill={c} fillOpacity="0.15" stroke={c} strokeWidth={s * 0.03} strokeOpacity="0.5"
        />
        {/* Facet lines */}
        <line x1={cx} y1={cy - s * 0.44} x2={cx + s * 0.44} y2={cy} stroke={c} strokeWidth={s * 0.025} strokeOpacity="0.25" />
        <line x1={cx} y1={cy - s * 0.44} x2={cx - s * 0.44} y2={cy} stroke={c} strokeWidth={s * 0.025} strokeOpacity="0.25" />
        {divisionDots}
      </svg>
    )
  }

  // ── CHAMPION ──────────────────────────────────────────────────────────────
  // Crown-like shape with pointed top
  if (group === 'champion') {
    const crownPath = `
      M ${cx - s * 0.42} ${cy + s * 0.38}
      L ${cx - s * 0.42} ${cy - s * 0.1}
      L ${cx - s * 0.18} ${cy - s * 0.38}
      L ${cx} ${cy - s * 0.12}
      L ${cx + s * 0.18} ${cy - s * 0.38}
      L ${cx + s * 0.42} ${cy - s * 0.1}
      L ${cx + s * 0.42} ${cy + s * 0.38}
      Z
    `
    return (
      <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} fill="none" className={className} style={{ overflow: 'visible' }}>
        {showGlow && <path d={crownPath} fill={rank.glowColor} style={{ filter: `blur(${s * 0.18}px)`, transform: 'scale(1.1)', transformOrigin: 'center' }} />}
        <path d={crownPath} fill={`${c}15`} stroke={c} strokeWidth={s * 0.055} />
        {/* Crown gems */}
        <circle cx={cx - s * 0.18} cy={cy - s * 0.38} r={s * 0.06} fill={c} fillOpacity="0.8" />
        <circle cx={cx} cy={cy - s * 0.12} r={s * 0.07} fill={c} fillOpacity="0.9" />
        <circle cx={cx + s * 0.18} cy={cy - s * 0.38} r={s * 0.06} fill={c} fillOpacity="0.8" />
        {divisionDots}
      </svg>
    )
  }

  // ── GRAND CHAMPION ────────────────────────────────────────────────────────
  // Elaborate crown with wings/flourishes
  if (group === 'grandchampion') {
    const crownPath = `
      M ${cx - s * 0.44} ${cy + s * 0.35}
      L ${cx - s * 0.44} ${cy - s * 0.05}
      L ${cx - s * 0.28} ${cy - s * 0.35}
      L ${cx - s * 0.1} ${cy - s * 0.15}
      L ${cx} ${cy - s * 0.42}
      L ${cx + s * 0.1} ${cy - s * 0.15}
      L ${cx + s * 0.28} ${cy - s * 0.35}
      L ${cx + s * 0.44} ${cy - s * 0.05}
      L ${cx + s * 0.44} ${cy + s * 0.35}
      Z
    `
    return (
      <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} fill="none" className={className} style={{ overflow: 'visible' }}>
        {showGlow && <path d={crownPath} fill={rank.glowColor} style={{ filter: `blur(${s * 0.2}px)`, transform: 'scale(1.1)', transformOrigin: 'center' }} />}
        <path d={crownPath} fill={`${c}15`} stroke={c} strokeWidth={s * 0.055} />
        {/* Top gem */}
        <polygon points={`${cx},${cy - s * 0.42} ${cx + s * 0.08},${cy - s * 0.28} ${cx},${cy - s * 0.2} ${cx - s * 0.08},${cy - s * 0.28}`}
          fill={c} fillOpacity="0.9" />
        {/* Side gems */}
        <circle cx={cx - s * 0.28} cy={cy - s * 0.35} r={s * 0.055} fill={c} fillOpacity="0.8" />
        <circle cx={cx + s * 0.28} cy={cy - s * 0.35} r={s * 0.055} fill={c} fillOpacity="0.8" />
        {/* Base band */}
        <rect x={cx - s * 0.44} y={cy + s * 0.18} width={s * 0.88} height={s * 0.08}
          fill={c} fillOpacity="0.2" />
        {divisionDots}
      </svg>
    )
  }

  // ── SUPERSONIC LEGEND ─────────────────────────────────────────────────────
  // Starburst / sunburst — the most distinctive shape
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} fill="none" className={className} style={{ overflow: 'visible' }}>
      {showGlow && (
        <circle cx={cx} cy={cy} r={s * 0.44}
          fill={rank.glowColor}
          style={{ filter: `blur(${s * 0.2}px)` }} />
      )}
      {/* Outer starburst — 8 points */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => {
        const rad = (angle * Math.PI) / 180
        const x1 = cx + Math.cos(rad) * s * 0.28
        const y1 = cy + Math.sin(rad) * s * 0.28
        const x2 = cx + Math.cos(rad) * s * 0.44
        const y2 = cy + Math.sin(rad) * s * 0.44
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={c} strokeWidth={s * 0.06} strokeLinecap="round" />
      })}
      {/* Outer ring */}
      <circle cx={cx} cy={cy} r={s * 0.28} fill={`${c}12`} stroke={c} strokeWidth={s * 0.05} />
      {/* Inner ring */}
      <circle cx={cx} cy={cy} r={s * 0.18} fill={`${c}20`} stroke={c} strokeWidth={s * 0.04} strokeOpacity="0.7" />
      {/* Core */}
      <circle cx={cx} cy={cy} r={s * 0.09} fill={c} />
      {/* SSL text at tiny size is replaced by the starburst — no division dots */}
    </svg>
  )
}
