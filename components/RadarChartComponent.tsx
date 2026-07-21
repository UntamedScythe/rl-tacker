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

// What each axis actually measures and what a high/low score means
const AXIS_CONTEXT: Record<string, { what: string; high: string; low: string; unit: string }> = {
  Shooting: {
    what: 'Shot accuracy — goals divided by shots taken',
    high: 'Your shots are a genuine threat. Keepers have to respect them.',
    low: 'You\'re shooting from bad positions or awkward angles. Be more selective.',
    unit: '%',
  },
  Defense: {
    what: 'Saves per game — how often you prevent goals',
    high: 'Strong last line of defense. Your team can push knowing you\'re back.',
    low: 'Either you\'re rarely in position to save, or the ball rarely gets through — check your positioning %.',
    unit: 'saves/game',
  },
  Boost: {
    what: 'Average boost amount maintained throughout games',
    high: 'Excellent boost management. You have options when teammates don\'t.',
    low: 'You\'re going empty too often. Fix your pad routes first.',
    unit: 'avg amount',
  },
  Speed: {
    what: 'Time spent at supersonic speed (above ~2200 uu/s)',
    high: 'You arrive fast. Opponents have to react, not predict.',
    low: 'You\'re consistently a half-second late. Boost harder through rotations.',
    unit: '% of game',
  },
  Rotation: {
    what: 'Time in the neutral (midfield) third — a proxy for rotation quality',
    high: 'Good rotation rhythm. You\'re transitioning between attack and defense.',
    low: 'You\'re either too far forward or camping your own goal. Find the middle.',
    unit: '% of game',
  },
  Aggression: {
    what: 'Shots per game — how actively you challenge for the ball',
    high: 'You create pressure and demand attention from defenders.',
    low: 'You\'re too passive in attack. More shot attempts forces keepers into mistakes.',
    unit: 'shots/game',
  },
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

type DataPoint = {
  label: string
  player: number
  benchmark: number
  rawPlayer: number
  rawBenchmark: number
}

type CustomTooltipProps = {
  active?: boolean
  payload?: { payload: DataPoint }[]
  rankColor: string
  rankFull: string
}

function CustomTooltip({ active, payload, rankColor, rankFull }: CustomTooltipProps) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  const ctx = AXIS_CONTEXT[d.label]
  if (!ctx) return null

  const playerScore = d.player
  const isStrong = playerScore >= d.benchmark
  const gap = Math.abs(playerScore - d.benchmark).toFixed(0)

  return (
    <div style={{
      background: '#0C0F12',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '3px',
      padding: '14px 16px',
      maxWidth: '240px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
    }}>
      {/* Header */}
      <p style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>
        {d.label}
      </p>

      {/* What it measures */}
      <p style={{ fontSize: '11px', color: '#B8BCC8', lineHeight: 1.6, marginBottom: '10px' }}>
        {ctx.what}
      </p>

      {/* Score comparison */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
        <div style={{ flex: 1, background: 'rgba(255,92,26,0.08)', border: '1px solid rgba(255,92,26,0.2)', borderRadius: '2px', padding: '6px 8px' }}>
          <p style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '9px', color: '#FF5C1A', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>You</p>
          <p style={{ fontSize: '14px', fontWeight: 700, color: '#FF5C1A' }}>{playerScore.toFixed(0)}</p>
          <p style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '9px', color: 'rgba(255,92,26,0.6)' }}>{d.rawPlayer.toFixed(1)} {ctx.unit}</p>
        </div>
        <div style={{ flex: 1, background: `${rankColor}12`, border: `1px solid ${rankColor}30`, borderRadius: '2px', padding: '6px 8px' }}>
          <p style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '9px', color: rankColor, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>{rankFull}</p>
          <p style={{ fontSize: '14px', fontWeight: 700, color: rankColor }}>{d.benchmark.toFixed(0)}</p>
          <p style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '9px', color: `${rankColor}80` }}>{d.rawBenchmark.toFixed(1)} {ctx.unit}</p>
        </div>
      </div>

      {/* Gap indicator */}
      <div style={{ marginBottom: '8px', padding: '5px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ fontSize: '11px', color: isStrong ? '#22C97A' : '#F54B4B' }}>
          {isStrong ? '▲' : '▼'} {gap} pts {isStrong ? 'above' : 'below'} {rankFull}
        </span>
      </div>

      {/* Coaching interpretation */}
      <p style={{ fontSize: '11px', color: isStrong ? '#22C97A' : '#B8BCC8', lineHeight: 1.6 }}>
        {isStrong ? ctx.high : ctx.low}
      </p>
    </div>
  )
}

export default function RadarChartComponent({ stats }: { stats: Stats }) {
  const [selectedRank, setSelectedRank] = useState<RankKey>('Diamond')
  const bench = RANK_BENCHMARKS[selectedRank]
  const rankMeta = RANKS.find(r => r.key === selectedRank)!

  const data: DataPoint[] = [
    {
      label: 'Shooting',
      player:    normalize(stats.shotAccuracy,  RANGES.shooting.min,   RANGES.shooting.max),
      benchmark: normalize(bench.shotAccuracy,  RANGES.shooting.min,   RANGES.shooting.max),
      rawPlayer: stats.shotAccuracy, rawBenchmark: bench.shotAccuracy,
    },
    {
      label: 'Defense',
      player:    normalize(stats.savesPerGame,  RANGES.defense.min,    RANGES.defense.max),
      benchmark: normalize(bench.saves,         RANGES.defense.min,    RANGES.defense.max),
      rawPlayer: stats.savesPerGame, rawBenchmark: bench.saves,
    },
    {
      label: 'Boost',
      player:    normalize(stats.avgBoost,      RANGES.boost.min,      RANGES.boost.max),
      benchmark: normalize(bench.boost,         RANGES.boost.min,      RANGES.boost.max),
      rawPlayer: stats.avgBoost, rawBenchmark: bench.boost,
    },
    {
      label: 'Speed',
      player:    normalize(stats.supersonicPct, RANGES.speed.min,      RANGES.speed.max),
      benchmark: normalize(bench.supersonic,    RANGES.speed.min,      RANGES.speed.max),
      rawPlayer: stats.supersonicPct, rawBenchmark: bench.supersonic,
    },
    {
      label: 'Rotation',
      player:    normalize(stats.neutralPct,    RANGES.rotation.min,   RANGES.rotation.max),
      benchmark: normalize(bench.neutral,       RANGES.rotation.min,   RANGES.rotation.max),
      rawPlayer: stats.neutralPct, rawBenchmark: bench.neutral,
    },
    {
      label: 'Aggression',
      player:    normalize(stats.shotsPerGame,  RANGES.aggression.min, RANGES.aggression.max),
      benchmark: normalize(bench.shots,         RANGES.aggression.min, RANGES.aggression.max),
      rawPlayer: stats.shotsPerGame, rawBenchmark: bench.shots,
    },
  ]

  return (
    <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: '2px', padding: '16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
        <div style={{ width: '3px', height: '12px', borderRadius: '1px', background: '#FF5C1A' }} />
        <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '10px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Performance Radar</span>
        <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '9px', color: 'var(--muted)', marginLeft: 'auto', opacity: 0.6 }}>hover to explain</span>
      </div>

      {/* Rank selector */}
      <div style={{ display: 'flex', gap: '3px', marginBottom: '10px', overflowX: 'auto', paddingBottom: '2px' }}>
        {RANKS.map(rank => (
          <button key={rank.key} onClick={() => setSelectedRank(rank.key as RankKey)} title={rank.full} style={{
            flexShrink: 0, padding: '3px 9px', borderRadius: '2px',
            fontSize: '10px', fontFamily: 'monospace', fontWeight: 700,
            cursor: 'pointer', transition: 'all 0.15s', border: 'none',
            background: selectedRank === rank.key ? rank.color : 'transparent',
            color: selectedRank === rank.key ? '#000' : rank.color,
            outline: selectedRank === rank.key ? 'none' : `1px solid ${rank.color}40`,
          }}>
            {rank.label}
          </button>
        ))}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <div style={{ width: '10px', height: '3px', borderRadius: '1px', background: 'rgba(255,92,26,0.6)' }} />
          <span style={{ fontSize: '10px', color: 'var(--muted)' }}>You</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <div style={{ width: '10px', height: '3px', borderRadius: '1px', background: `${rankMeta.color}60`, borderTop: `1px dashed ${rankMeta.color}` }} />
          <span style={{ fontSize: '10px', color: rankMeta.color }}>{rankMeta.full}</span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <RadarChart data={data} margin={{ top: 8, right: 24, bottom: 8, left: 24 }}>
          <PolarGrid stroke="rgba(255,255,255,0.05)" />
          <PolarAngleAxis
            dataKey="label"
            tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 10, fontFamily: 'var(--font-geist-mono)' }}
          />
          <Tooltip
            content={<CustomTooltip rankColor={rankMeta.color} rankFull={rankMeta.full} />}
            wrapperStyle={{ zIndex: 100 }}
          />
          <Radar name="Benchmark" dataKey="benchmark"
            stroke={rankMeta.color} fill={`${rankMeta.color}12`}
            strokeWidth={1.5} strokeDasharray="4 3" />
          <Radar name="You" dataKey="player"
            stroke="#FF5C1A" fill="rgba(255,92,26,0.10)"
            strokeWidth={2} dot={{ fill: '#FF5C1A', r: 3, strokeWidth: 0 }} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}
