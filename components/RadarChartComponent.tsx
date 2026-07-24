'use client'

import { memo, useState, useCallback, useMemo, useRef } from 'react'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  ResponsiveContainer, Tooltip,
} from 'recharts'
import type { Stats } from '@/lib/advice'

function normalize(value: number, min: number, max: number) {
  return Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100))
}

const RANGES = {
  shooting:   { min: 0,  max: 80 },
  defense:    { min: 0,  max: 3  },
  boost:      { min: 20, max: 80 },
  speed:      { min: 5,  max: 30 },
  rotation:   { min: 20, max: 45 },
  aggression: { min: 0,  max: 4  },
}

const AXIS_CONTEXT: Record<string, {
  what: string; high: string; low: string; unit: string; category: string
}> = {
  Shooting: {
    what: 'Shot accuracy — goals divided by shots taken',
    high: 'Your shots are a genuine threat. Keepers have to respect them.',
    low: 'You\'re shooting from bad positions. Be more selective.',
    unit: '%', category: 'Shooting',
  },
  Defense: {
    what: 'Saves per game — how often you prevent goals',
    high: 'Strong last line of defense. Your team can push knowing you\'re back.',
    low: 'Either rarely in position to save, or the ball rarely gets through.',
    unit: 'saves/g', category: 'Defense',
  },
  Boost: {
    what: 'Average boost amount maintained throughout games',
    high: 'Excellent boost management. You have options when teammates don\'t.',
    low: 'You\'re going empty too often. Fix your pad routes first.',
    unit: 'avg', category: 'Boost',
  },
  Speed: {
    what: 'Time at supersonic speed (above ~2200 uu/s)',
    high: 'You arrive fast. Opponents react instead of predict.',
    low: 'You\'re consistently a half-second late to your own plays.',
    unit: '% game', category: 'Speed',
  },
  Rotation: {
    what: 'Time in midfield — proxy for rotation quality',
    high: 'Good rotation rhythm between attack and defense.',
    low: 'Too far forward or camping goal. Find the middle.',
    unit: '% game', category: 'Rotation',
  },
  Aggression: {
    what: 'Shots per game — how actively you challenge',
    high: 'You create pressure and demand attention from defenders.',
    low: 'Too passive in attack. More attempts forces keeper mistakes.',
    unit: 'shots/g', category: 'Aggression',
  },
}

const RANK_BENCHMARKS = {
  Bronze:   { shotAccuracy: 18, saves: 0.8,  boost: 38, supersonic: 6,  neutral: 28, shots: 1.5 },
  Silver:   { shotAccuracy: 22, saves: 1.0,  boost: 43, supersonic: 9,  neutral: 30, shots: 1.8 },
  Gold:     { shotAccuracy: 26, saves: 1.2,  boost: 48, supersonic: 11, neutral: 31, shots: 2.0 },
  Platinum: { shotAccuracy: 29, saves: 1.4,  boost: 52, supersonic: 13, neutral: 32, shots: 2.2 },
  Diamond:  { shotAccuracy: 33, saves: 1.6,  boost: 56, supersonic: 15, neutral: 33, shots: 2.5 },
  Champion: { shotAccuracy: 37, saves: 1.8,  boost: 60, supersonic: 18, neutral: 34, shots: 2.8 },
  GC:       { shotAccuracy: 41, saves: 2.1,  boost: 64, supersonic: 22, neutral: 35, shots: 3.1 },
  SSL:      { shotAccuracy: 46, saves: 2.4,  boost: 68, supersonic: 26, neutral: 37, shots: 3.5 },
}

const RANKS = [
  { key: 'Bronze',   label: 'B',   color: '#cd7f32', full: 'Bronze'            },
  { key: 'Silver',   label: 'S',   color: '#a8a9ad', full: 'Silver'            },
  { key: 'Gold',     label: 'G',   color: '#ffd700', full: 'Gold'              },
  { key: 'Platinum', label: 'P',   color: '#00b4d8', full: 'Platinum'          },
  { key: 'Diamond',  label: 'D',   color: '#4cc9f0', full: 'Diamond'           },
  { key: 'Champion', label: 'C',   color: '#9b5de5', full: 'Champion'          },
  { key: 'GC',       label: 'GC',  color: '#f72585', full: 'Grand Champ'       },
  { key: 'SSL',      label: 'SSL', color: '#ff9e00', full: 'Supersonic Legend' },
]

type RankKey = keyof typeof RANK_BENCHMARKS

type DataPoint = {
  label: string
  player: number
  benchmark: number
  rawPlayer: number
  rawBenchmark: number
}

// ── Tooltip panel — fixed below chart, never overlaps ───────────────────────
function TooltipPanel({ data, rankColor, rankFull }: {
  data: DataPoint | null
  rankColor: string
  rankFull: string
}) {
  if (!data) {
    return (
      <div style={{
        height: '72px', display: 'flex', alignItems: 'center',
        justifyContent: 'center',
        border: '1px solid rgba(76,201,240,0.1)',
        borderRadius: '2px', background: 'rgba(76,201,240,0.03)',
      }}>
        <p style={{
          fontFamily: 'var(--font-geist-mono)', fontSize: '11px',
          color: 'rgba(76,201,240,0.45)', textTransform: 'uppercase',
          letterSpacing: '0.1em',
        }}>
          Hover an axis to inspect
        </p>
      </div>
    )
  }

  const ctx = AXIS_CONTEXT[data.label]
  const isStrong = data.player >= data.benchmark
  const gap = Math.abs(data.player - data.benchmark).toFixed(0)

  return (
    <div style={{
      border: '1px solid rgba(76,201,240,0.22)', borderRadius: '2px',
      background: '#0A0D10', padding: '14px 16px',
    }}>
      {/* Axis name + description */}
      <div style={{ marginBottom: '12px' }}>
        <p style={{
          fontFamily: 'var(--font-geist-mono)', fontSize: '11px',
          color: '#4CC9F0', textTransform: 'uppercase',
          letterSpacing: '0.12em', marginBottom: '5px',
        }}>
          {data.label}
        </p>
        <p style={{ fontSize: '13px', color: '#B8BCC8', lineHeight: 1.6 }}>
          {ctx?.what}
        </p>
      </div>

      {/* Score comparison — raw values prominent, normalized score secondary */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
        <div style={{
          flex: 1, background: 'rgba(255,92,26,0.08)',
          border: '1px solid rgba(255,92,26,0.22)',
          borderRadius: '2px', padding: '10px 12px',
        }}>
          <p style={{
            fontFamily: 'var(--font-geist-mono)', fontSize: '10px',
            color: '#FF5C1A', textTransform: 'uppercase',
            letterSpacing: '0.08em', marginBottom: '6px',
          }}>You</p>
          {/* Raw value — the meaningful number */}
          <p style={{ fontSize: '20px', fontWeight: 800, color: '#FF5C1A', lineHeight: 1, marginBottom: '3px' }}>
            {data.rawPlayer.toFixed(1)}
            <span style={{ fontSize: '11px', fontWeight: 500, marginLeft: '3px', opacity: 0.7 }}>{ctx?.unit}</span>
          </p>
          {/* Normalized score — secondary context */}
          <p style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '11px', color: 'rgba(255,92,26,0.55)' }}>
            {data.player.toFixed(0)} / 100
          </p>
        </div>
        <div style={{
          flex: 1,
          background: `${rankColor}12`,
          border: `1px solid ${rankColor}30`,
          borderRadius: '2px', padding: '10px 12px',
        }}>
          <p style={{
            fontFamily: 'var(--font-geist-mono)', fontSize: '10px',
            color: rankColor, textTransform: 'uppercase',
            letterSpacing: '0.08em', marginBottom: '6px',
          }}>{rankFull}</p>
          <p style={{ fontSize: '20px', fontWeight: 800, color: rankColor, lineHeight: 1, marginBottom: '3px' }}>
            {data.rawBenchmark.toFixed(1)}
            <span style={{ fontSize: '11px', fontWeight: 500, marginLeft: '3px', opacity: 0.7 }}>{ctx?.unit}</span>
          </p>
          <p style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '11px', color: `${rankColor}70` }}>
            {data.benchmark.toFixed(0)} / 100
          </p>
        </div>
      </div>

      {/* Gap indicator */}
      <div style={{
        padding: '8px 10px',
        background: isStrong ? 'rgba(34,201,122,0.08)' : 'rgba(245,75,75,0.08)',
        border: `1px solid ${isStrong ? 'rgba(34,201,122,0.2)' : 'rgba(245,75,75,0.2)'}`,
        borderRadius: '2px', marginBottom: '10px',
      }}>
        <span style={{ fontSize: '13px', color: isStrong ? '#22C97A' : '#F54B4B', fontWeight: 600 }}>
          {isStrong ? '▲' : '▼'} {gap} pts {isStrong ? 'above' : 'below'} {rankFull}
        </span>
      </div>

      {/* Coaching read */}
      <p style={{ fontSize: '13px', color: isStrong ? '#22C97A' : '#B8BCC8', lineHeight: 1.7 }}>
        {isStrong ? ctx?.high : ctx?.low}
      </p>
    </div>
  )
}

// ── SilentTooltip — captures hover data WITHOUT causing render loops ─────────
// Key fix: uses a ref to track current active state so we only call onData
// when the value actually changes, not on every render.
function SilentTooltip({
  active,
  payload,
  onData,
}: {
  active?: boolean
  payload?: { payload: DataPoint }[]
  onData: (d: DataPoint | null) => void
}) {
  const prevKeyRef = useRef<string | null>(null)

  if (active && payload?.length) {
    const key = payload[0].payload.label
    // Only fire if the hovered axis actually changed
    if (prevKeyRef.current !== key) {
      prevKeyRef.current = key
      // Use queueMicrotask instead of setTimeout — fires after paint,
      // not on a new event loop tick, preventing the infinite loop
      queueMicrotask(() => onData(payload[0].payload))
    }
  } else if (!active && prevKeyRef.current !== null) {
    // Only fire null once when we leave, not on every inactive render
    prevKeyRef.current = null
    queueMicrotask(() => onData(null))
  }

  return null
}

interface RadarProps {
  stats: Stats
  onAxisHover?: (category: string | null) => void
}

function RadarChartComponent({ stats, onAxisHover }: RadarProps) {
  const [selectedRank, setSelectedRank] = useState<RankKey>('Diamond')
  const [hoveredData, setHoveredData] = useState<DataPoint | null>(null)

  const bench = RANK_BENCHMARKS[selectedRank]
  const rankMeta = RANKS.find(r => r.key === selectedRank)!

  const data: DataPoint[] = useMemo(() => [
    {
      label: 'Shooting',
      player:       normalize(stats.shotAccuracy,  RANGES.shooting.min,   RANGES.shooting.max),
      benchmark:    normalize(bench.shotAccuracy,  RANGES.shooting.min,   RANGES.shooting.max),
      rawPlayer:    stats.shotAccuracy,
      rawBenchmark: bench.shotAccuracy,
    },
    {
      label: 'Defense',
      player:       normalize(stats.savesPerGame,  RANGES.defense.min,    RANGES.defense.max),
      benchmark:    normalize(bench.saves,         RANGES.defense.min,    RANGES.defense.max),
      rawPlayer:    stats.savesPerGame,
      rawBenchmark: bench.saves,
    },
    {
      label: 'Boost',
      player:       normalize(stats.avgBoost,      RANGES.boost.min,      RANGES.boost.max),
      benchmark:    normalize(bench.boost,         RANGES.boost.min,      RANGES.boost.max),
      rawPlayer:    stats.avgBoost,
      rawBenchmark: bench.boost,
    },
    {
      label: 'Speed',
      player:       normalize(stats.supersonicPct, RANGES.speed.min,      RANGES.speed.max),
      benchmark:    normalize(bench.supersonic,    RANGES.speed.min,      RANGES.speed.max),
      rawPlayer:    stats.supersonicPct,
      rawBenchmark: bench.supersonic,
    },
    {
      label: 'Rotation',
      player:       normalize(stats.neutralPct,    RANGES.rotation.min,   RANGES.rotation.max),
      benchmark:    normalize(bench.neutral,       RANGES.rotation.min,   RANGES.rotation.max),
      rawPlayer:    stats.neutralPct,
      rawBenchmark: bench.neutral,
    },
    {
      label: 'Aggression',
      player:       normalize(stats.shotsPerGame,  RANGES.aggression.min, RANGES.aggression.max),
      benchmark:    normalize(bench.shots,         RANGES.aggression.min, RANGES.aggression.max),
      rawPlayer:    stats.shotsPerGame,
      rawBenchmark: bench.shots,
    },
  ], [stats, bench])

  const handleData = useCallback((d: DataPoint | null) => {
    setHoveredData(d)
    onAxisHover?.(d ? AXIS_CONTEXT[d.label]?.category ?? null : null)
  }, [onAxisHover])

  return (
    <div className="radar-frame" style={{ background: 'var(--surface-1)', padding: '16px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
        <div style={{
          width: '2px', height: '12px', borderRadius: '1px',
          background: 'linear-gradient(180deg, #4CC9F0, rgba(76,201,240,0.3))',
        }} />
        <span style={{
          fontFamily: 'var(--font-geist-mono)', fontSize: '11px',
          color: '#4CC9F0', textTransform: 'uppercase', letterSpacing: '0.12em',
        }}>
          Performance Radar
        </span>
        <span style={{
          fontFamily: 'var(--font-geist-mono)', fontSize: '9px',
          color: 'rgba(76,201,240,0.4)', marginLeft: 'auto', letterSpacing: '0.08em',
        }}>
          vs rank benchmark
        </span>
      </div>

      {/* Rank selector */}
      <div style={{ display: 'flex', gap: '3px', marginBottom: '12px', overflowX: 'auto', paddingBottom: '2px' }}>
        {RANKS.map(rank => (
          <button key={rank.key} onClick={() => setSelectedRank(rank.key as RankKey)}
            title={rank.full} style={{
              flexShrink: 0, padding: '3px 9px', borderRadius: '2px',
              fontSize: '10px', fontFamily: 'var(--font-geist-mono)',
              fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s', border: 'none',
              background: selectedRank === rank.key ? rank.color : 'transparent',
              color: selectedRank === rank.key ? '#000' : rank.color,
              outline: selectedRank === rank.key ? 'none' : `1px solid ${rank.color}40`,
            }}>
            {rank.label}
          </button>
        ))}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '14px', marginBottom: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <div style={{ width: '12px', height: '2px', borderRadius: '1px', background: '#FF5C1A' }} />
          <span style={{ fontSize: '10px', color: 'var(--muted-bright)' }}>You</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <div style={{ width: '12px', height: '0px', borderTop: `1px dashed ${rankMeta.color}` }} />
          <span style={{ fontSize: '10px', color: rankMeta.color }}>{rankMeta.full}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginLeft: 'auto' }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'rgba(76,201,240,0.5)' }} />
          <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '9px', color: 'rgba(76,201,240,0.5)', letterSpacing: '0.06em' }}>
            {hoveredData ? hoveredData.label.toUpperCase() : 'HOVER TO INSPECT'}
          </span>
        </div>
      </div>

      {/* Chart */}
      <div style={{ borderTop: '1px solid rgba(76,201,240,0.08)', borderBottom: '1px solid rgba(76,201,240,0.08)', margin: '8px 0' }}>
        <ResponsiveContainer width="100%" height={230}>
          <RadarChart data={data} margin={{ top: 10, right: 26, bottom: 10, left: 26 }}>
            <PolarGrid stroke="rgba(76,201,240,0.08)" />
            <PolarAngleAxis
              dataKey="label"
              tick={(props) => {
                const { x, y, payload, textAnchor } = props as {
                  x: number; y: number; payload: { value: string }
                  textAnchor: 'inherit' | 'end' | 'start' | 'middle'
                }
                const isActive = hoveredData?.label === payload.value
                return (
                  <text
                    x={x} y={y}
                    textAnchor={textAnchor}
                    fill={isActive ? '#4CC9F0' : 'rgba(255,255,255,0.5)'}
                    fontSize={isActive ? 12 : 11}
                    fontWeight={isActive ? 600 : 400}
                    fontFamily="var(--font-geist-mono)"
                    style={{ transition: 'fill 0.2s ease, font-size 0.2s ease' }}
                  >
                    {payload.value}
                  </text>
                )
              }}
            />
            <Tooltip content={<SilentTooltip onData={handleData} />} />
            <Radar name="Benchmark" dataKey="benchmark"
              stroke={rankMeta.color} fill={`${rankMeta.color}10`}
              strokeWidth={1.5} strokeDasharray="4 3" />
            <Radar name="You" dataKey="player"
              stroke="#FF5C1A" fill="rgba(255,92,26,0.10)"
              strokeWidth={2} dot={{ fill: '#FF5C1A', r: 3, strokeWidth: 0 }} />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Fixed tooltip panel below chart */}
      <TooltipPanel data={hoveredData} rankColor={rankMeta.color} rankFull={rankMeta.full} />

    </div>
  )
}

export default memo(RadarChartComponent)
