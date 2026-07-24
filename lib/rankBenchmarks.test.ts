import { describe, it, expect } from 'vitest'
import { RANK_BENCHMARKS, type RankKey } from './rankBenchmarks'
import diamondIIArtifact from '@/data/generated/rank-benchmarks.json'

const ALL_RANKS: RankKey[] = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Champion', 'GC', 'SSL']
const METRIC_FIELDS = ['shotAccuracy', 'saves', 'boost', 'supersonic', 'neutral', 'shots'] as const

describe('RANK_BENCHMARKS structure', () => {
  it('has all 8 radar rank buckets', () => {
    for (const rank of ALL_RANKS) {
      expect(RANK_BENCHMARKS[rank]).toBeDefined()
    }
  })

  it('every entry has all 6 radar metric fields as finite numbers', () => {
    for (const rank of ALL_RANKS) {
      for (const field of METRIC_FIELDS) {
        const value = RANK_BENCHMARKS[rank].metrics[field]
        expect(Number.isFinite(value)).toBe(true)
      }
    }
  })

  it('measured entries carry sampleMeta; estimated entries do not', () => {
    for (const rank of ALL_RANKS) {
      const entry = RANK_BENCHMARKS[rank]
      if (entry.source === 'measured') {
        expect(entry.sampleMeta).toBeDefined()
        expect(entry.sampleMeta!.uniquePlayers).toBeGreaterThan(0)
      } else {
        expect(entry.sampleMeta).toBeUndefined()
      }
    }
  })

  it('only Diamond is measured so far — the other 7 ranks stay estimated fallbacks', () => {
    expect(RANK_BENCHMARKS.Diamond.source).toBe('measured')
    for (const rank of ALL_RANKS.filter(r => r !== 'Diamond')) {
      expect(RANK_BENCHMARKS[rank].source).toBe('estimated')
    }
  })

  it('the Diamond entry\'s sampleMeta names Diamond II specifically, not a combined I-III range', () => {
    expect(RANK_BENCHMARKS.Diamond.sampleMeta!.rank).toBe('Diamond II')
  })

  it('Diamond\'s measured numbers match the generated benchmark artifact exactly, so they cannot silently drift apart', () => {
    const artifactMetrics = diamondIIArtifact.benchmarks['diamond-2'].metrics
    const diamond = RANK_BENCHMARKS.Diamond.metrics
    expect(diamond.shotAccuracy).toBe(artifactMetrics.shotAccuracyRatio.mean)
    expect(diamond.saves).toBe(artifactMetrics.savesPerGame.mean)
    expect(diamond.boost).toBe(artifactMetrics.avgBoost.mean)
    expect(diamond.supersonic).toBe(artifactMetrics.supersonicPct.mean)
    expect(diamond.neutral).toBe(artifactMetrics.neutralPct.mean)
    expect(diamond.shots).toBe(artifactMetrics.shotsPerGame.mean)
  })

  it('Diamond\'s sample size matches the artifact\'s unique player count', () => {
    expect(RANK_BENCHMARKS.Diamond.sampleMeta!.uniquePlayers).toBe(diamondIIArtifact.benchmarks['diamond-2'].uniquePlayers)
  })
})

describe('recalibrated estimated ranks', () => {
  const RANK_ORDER: RankKey[] = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Champion', 'GC', 'SSL']

  it('every metric increases monotonically from Bronze to SSL, anchored through the real Diamond value', () => {
    for (const field of METRIC_FIELDS) {
      const values = RANK_ORDER.map(rank => RANK_BENCHMARKS[rank].metrics[field])
      for (let i = 1; i < values.length; i++) {
        expect(values[i]).toBeGreaterThan(values[i - 1])
      }
    }
  })

  it('Platinum no longer exceeds Diamond on boost (the inconsistency recalibration was meant to fix)', () => {
    expect(RANK_BENCHMARKS.Platinum.metrics.boost).toBeLessThan(RANK_BENCHMARKS.Diamond.metrics.boost)
  })

  it('recalibrated ranks stay estimated, not measured, even though their numbers changed', () => {
    for (const rank of RANK_ORDER.filter(r => r !== 'Diamond')) {
      expect(RANK_BENCHMARKS[rank].source).toBe('estimated')
      expect(RANK_BENCHMARKS[rank].sampleMeta).toBeUndefined()
    }
  })
})
