'use client'

import { useState } from 'react'
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
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

// Benchmarks per rank: [shotAccuracy%, savesPerGame, avgBoost, supersonicPct, neutralPct, shotsPerGame]
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
  { key: 'Bronze',   label: 'B',   color: '#cd7f32', full: 'Bronze'   },
  { key: 'Silver',   label: 'S',   color: '#a8a9ad', full: 'Silver'   },
  { key: 'Gold',     label: 'G',   color: '#ffd700', full: 'Gold'     },
  { key: 'Platinum', label: 'P',   color: '#00b4d8', full: 'Platinum' },
  { key: 'Diamond',  label: 'D',   color: '#4cc9f0', full: 'Diamond'  },
  { key: 'Champion', label: 'C',   color: '#9b5de5', full: 'Champion' },
  { key: 'GC',       label: 'GC',  color: '#f72585', full: 'Grand Champ' },
  { key: 'SSL',      label: 'SSL', color: '#ff9e00', full: 'Supersonic Legend' },
]

type RankKey = keyof typeof RANK_BENCHMARKS

type CustomTooltipProps = {
  active?: boolean
  payload?: { payload: { label: string; player: number; benchmark: number } }[]
  rankColor: string
  rankFull: string
}

function CustomTooltip({ active, payload, rankColor, rankFull }: CustomTooltipProps) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-[#111318] border border-white/10 rounded-xl px-3 py-2 text-xs space-y-1">
      <p className="text-white/50 font-mono uppercase tracking-wider">{d.label}</p>
      <p className="text-white font-medium">You: <span className="text-blue-400">{d.player.toFixed(0)}</span></p>
      <p style={{ color: rankColor }}>
        {rankFull}: {d.benchmark.toFixed(0)}
      </p>
    </div>
  )
}

export default function RadarChartComponent({ stats }: { stats: Stats }) {
  const [selectedRank, setSelectedRank] = useState<RankKey>('Diamond')

  const bench = RANK_BENCHMARKS[selectedRank]
  const rankMeta = RANKS.find(r => r.key === selectedRank)!

  const data = [
    {
      label: 'Shooting',
      player:    normalize(stats.shotAccuracy,  RANGES.shooting.min,   RANGES.shooting.max),
      benchmark: normalize(bench.shotAccuracy,  RANGES.shooting.min,   RANGES.shooting.max),
    },
    {
      label: 'Defense',
      player:    normalize(stats.savesPerGame,  RANGES.defense.min,    RANGES.defense.max),
      benchmark: normalize(bench.saves,         RANGES.defense.min,    RANGES.defense.max),
    },
    {
      label: 'Boost',
      player:    normalize(stats.avgBoost,      RANGES.boost.min,      RANGES.boost.max),
      benchmark: normalize(bench.boost,         RANGES.boost.min,      RANGES.boost.max),
    },
    {
      label: 'Speed',
      player:    normalize(stats.supersonicPct, RANGES.speed.min,      RANGES.speed.max),
      benchmark: normalize(bench.supersonic,    RANGES.speed.min,      RANGES.speed.max),
    },
    {
      label: 'Rotation',
      player:    normalize(stats.neutralPct,    RANGES.rotation.min,   RANGES.rotation.max),
      benchmark: normalize(bench.neutral,       RANGES.rotation.min,   RANGES.rotation.max),
    },
    {
      label: 'Aggression',
      player:    normalize(stats.shotsPerGame,  RANGES.aggression.min, RANGES.aggression.max),
      benchmark: normalize(bench.shots,         RANGES.aggression.min, RANGES.aggression.max),
    },
  ]

  const benchColor = rankMeta.color
  const benchFill = `${benchColor}22`

  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
        <span className="text-[11px] text-white/40 uppercase tracking-widest font-mono">Performance Radar</span>
      </div>

      {/* Rank selector */}
      <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1 scrollbar-none">
        {RANKS.map(rank => (
          <button
            key={rank.key}
            onClick={() => setSelectedRank(rank.key as RankKey)}
            title={rank.full}
            className={`flex-shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-mono font-medium transition-all border ${
              selectedRank === rank.key
                ? 'border-transparent text-black'
                : 'border-white/[0.08] text-white/40 hover:text-white/70 hover:border-white/20'
            }`}
            style={selectedRank === rank.key ? { background: rank.color } : {}}
          >
            {rank.label}
          </button>
        ))}
      </div>

      {/* Legend */}
      <div className="flex gap-4 mb-3">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-blue-500/60" />
          <span className="text-xs text-white/40">You</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm" style={{ background: `${benchColor}60` }} />
          <span className="text-xs" style={{ color: benchColor }}>{rankMeta.full}</span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <RadarChart data={data} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
          <PolarGrid stroke="rgba(255,255,255,0.06)" />
          <PolarAngleAxis
            dataKey="label"
            tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11, fontFamily: 'DM Mono, monospace' }}
          />
          <Tooltip content={<CustomTooltip rankColor={benchColor} rankFull={rankMeta.full} />} />
          <Radar
            name="Benchmark"
            dataKey="benchmark"
            stroke={benchColor}
            fill={benchFill}
            strokeWidth={1.5}
            strokeDasharray="4 4"
          />
          <Radar
            name="You"
            dataKey="player"
            stroke="#3b82f6"
            fill="rgba(59,130,246,0.15)"
            strokeWidth={2}
            dot={{ fill: '#3b82f6', r: 3 }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}
