'use client'

import { useState } from 'react'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from 'recharts'
import type { Stats } from '@/lib/advice'

function normalize(value: number, min: number, max: number) {
  return Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100))
}

const RANGES = {
  shooting:   { min: 0,  max: 50 },
  defense:    { min: 0,  max: 3  },
  boost:      { min: 20, max: 80 },
  speed:      { min: 5,  max: 30 },
  rotation:   { min: 20, max: 45 },
  aggression: { min: 0,  max: 4  },
}

const RANK_BENCHMARKS = {
  Bronze:    { shotAccuracy: 18, saves: 0.8,  boost: 38, supersonic: 6,  neutral: 28, shots: 1.5 },
  Silver:    { shotAccuracy: 22, saves: 1.0,  boost: 43, supersonic: 9,  neutral: 30, shots: 1.8 },
  Gold:      { shotAccuracy: 26, saves: 1.2,  boost: 48, supersonic: 11, neutral: 31, shots: 2.0 },
  Platinum:  { shotAccuracy: 29, saves: 1.4,  boost: 52, supersonic: 13, neutral: 32, shots: 2.2 },
  Diamond:   { shotAccuracy: 33, saves: 1.6,  boost: 56, supersonic: 15, neutral: 33, shots: 2.5 },
  Champion:  { shotAccuracy: 37, saves: 1.8,  boost: 60, supersonic: 18, neutral: 34, shots: 2.8 },
  GC:        { shotAccuracy: 41, saves: 2.1,  boost: 64, supersonic: 22, neutral: 35, shots: 3.1 },
  SSL:       { shotAccuracy: 46, saves: 2.4,  boost: 68, supersonic: 26, neutral: 37, shots: 3.5 },
}

const RANKS = [
  { key: 'Bronze',   label: 'B',   color: '#cd7f32', full: 'Bronze'             },
  { key: 'Silver',   label: 'S',   color: '#a8a9ad', full: 'Silver'             },
  { key: 'Gold',     label: 'G',   color: '#ffd700', full: 'Gold'               },
  { key: 'Platinum', label: 'P',   color: '#00b4d8', full: 'Platinum'           },
  { key: 'Diamond',  label: 'D',   color: '#4cc9f0', full: 'Diamond'            },
  { key: 'Champion', label: 'C',   color: '#9b5de5', full: 'Champion'           },
  { key: 'GC',       label: 'GC',  color: '#f72585', full: 'Grand Champ'        },
  { key: 'SSL',      label: 'SSL', color: '#ff9e00', full: 'Supersonic Legend'  },
]

type RankKey = keyof typeof RANK_BENCHMARKS

type TooltipProps = {
  active?: boolean
  payload?: { payload: { label: string; player: number; benchmark: number } }[]
  rankColor: string
  rankFull: string
}

function CustomTooltip({ active, payload, rankColor, rankFull }: TooltipProps) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div style={{ background: '#0F1215', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '10px 14px', fontSize: '12px' }}>
      <p style={{ color: '#4A5060', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>{d.label}</p>
      <p style={{ color: '#E8EBF0' }}>You: <span style={{ color: '#FF5C1A', fontWeight: 600 }}>{d.player.toFixed(0)}</span></p>
      <p style={{ color: rankColor }}>{rankFull}: {d.benchmark.toFixed(0)}</p>
    </div>
  )
}

export default function RadarChartComponent({ stats }: { stats: Stats }) {
  const [selectedRank, setSelectedRank] = useState<RankKey>('Diamond')
  const bench = RANK_BENCHMARKS[selectedRank]
  const rankMeta = RANKS.find(r => r.key === selectedRank)!

  const data = [
    { label: 'Shooting',   player: normalize(stats.shotAccuracy,  RANGES.shooting.min,   RANGES.shooting.max),   benchmark: normalize(bench.shotAccuracy, RANGES.shooting.min,   RANGES.shooting.max) },
    { label: 'Defense',    player: normalize(stats.savesPerGame,  RANGES.defense.min,    RANGES.defense.max),    benchmark: normalize(bench.saves,        RANGES.defense.min,    RANGES.defense.max) },
    { label: 'Boost',      player: normalize(stats.avgBoost,      RANGES.boost.min,      RANGES.boost.max),      benchmark: normalize(bench.boost,        RANGES.boost.min,      RANGES.boost.max) },
    { label: 'Speed',      player: normalize(stats.supersonicPct, RANGES.speed.min,      RANGES.speed.max),      benchmark: normalize(bench.supersonic,   RANGES.speed.min,      RANGES.speed.max) },
    { label: 'Rotation',   player: normalize(stats.neutralPct,    RANGES.rotation.min,   RANGES.rotation.max),   benchmark: normalize(bench.neutral,      RANGES.rotation.min,   RANGES.rotation.max) },
    { label: 'Aggression', player: normalize(stats.shotsPerGame,  RANGES.aggression.min, RANGES.aggression.max), benchmark: normalize(bench.shots,        RANGES.aggression.min, RANGES.aggression.max) },
  ]

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '14px' }}>
        <div style={{ width: '4px', height: '14px', borderRadius: '2px', background: '#FF5C1A' }} />
        <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Performance Radar</span>
      </div>

      {/* Rank selector */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '12px', overflowX: 'auto', paddingBottom: '2px' }}>
        {RANKS.map(rank => (
          <button key={rank.key} onClick={() => setSelectedRank(rank.key as RankKey)} title={rank.full} style={{
            flexShrink: 0,
            padding: '3px 10px', borderRadius: '6px', fontSize: '11px',
            fontFamily: 'monospace', fontWeight: 600, cursor: 'pointer',
            transition: 'all 0.15s',
            background: selectedRank === rank.key ? rank.color : 'transparent',
            color: selectedRank === rank.key ? '#000' : rank.color,
            border: `1px solid ${rank.color}${selectedRank === rank.key ? 'ff' : '50'}`,
          }}>
            {rank.label}
          </button>
        ))}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '14px', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: 'rgba(255,92,26,0.4)' }} />
          <span style={{ fontSize: '11px', color: 'var(--muted)' }}>You</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: `${rankMeta.color}50` }} />
          <span style={{ fontSize: '11px', color: rankMeta.color }}>{rankMeta.full}</span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={250}>
        <RadarChart data={data} margin={{ top: 8, right: 28, bottom: 8, left: 28 }}>
          <PolarGrid stroke="rgba(255,255,255,0.05)" />
          <PolarAngleAxis dataKey="label" tick={{ fill: '#4A5060', fontSize: 10, fontFamily: 'monospace' }} />
          <Tooltip content={<CustomTooltip rankColor={rankMeta.color} rankFull={rankMeta.full} />} />
          <Radar name="Benchmark" dataKey="benchmark" stroke={rankMeta.color} fill={`${rankMeta.color}18`} strokeWidth={1.5} strokeDasharray="4 3" />
          <Radar name="You" dataKey="player" stroke="#FF5C1A" fill="rgba(255,92,26,0.12)" strokeWidth={2} dot={{ fill: '#FF5C1A', r: 3 }} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}
