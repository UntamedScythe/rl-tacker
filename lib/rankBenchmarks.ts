import diamondIIArtifact from '@/data/generated/rank-benchmarks.json'

// Distinguishes ranks with a real measured benchmark from ranks still using a
// loose estimate. Only Diamond (measured as Diamond II specifically — see
// sampleMeta.rank) has real data so far; the other 7 ranks are unchanged
// hand-tuned guesses pending their own collection pass.
export type BenchmarkSource = 'measured' | 'estimated'

export type RankBenchmarkMetrics = {
  shotAccuracy: number
  saves: number
  boost: number
  supersonic: number
  neutral: number
  shots: number
}

export type SampleMeta = {
  uniquePlayers: number
  playlist: string
  rank: string
  gamesPerPlayer: string
  generatedAt: string
  disclaimer: string
}

export type RankBenchmarkEntry = {
  source: BenchmarkSource
  metrics: RankBenchmarkMetrics
  sampleMeta?: SampleMeta
}

export type RankKey = 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond' | 'Champion' | 'GC' | 'SSL'

const METRIC_KEYS: (keyof RankBenchmarkMetrics)[] = ['shotAccuracy', 'saves', 'boost', 'supersonic', 'neutral', 'shots']

// Original hand-tuned guesses (Bronze → SSL), before any real data existed for
// any rank. BASE_ESTIMATED_METRICS.Diamond is kept only as the anchor for
// recalibration below — it is never used directly as a benchmark value.
const BASE_ESTIMATED_METRICS: Record<RankKey, RankBenchmarkMetrics> = {
  Bronze:   { shotAccuracy: 18, saves: 0.8, boost: 38, supersonic: 6,  neutral: 28, shots: 1.5 },
  Silver:   { shotAccuracy: 22, saves: 1.0, boost: 43, supersonic: 9,  neutral: 30, shots: 1.8 },
  Gold:     { shotAccuracy: 26, saves: 1.2, boost: 48, supersonic: 11, neutral: 31, shots: 2.0 },
  Platinum: { shotAccuracy: 29, saves: 1.4, boost: 52, supersonic: 13, neutral: 32, shots: 2.2 },
  Diamond:  { shotAccuracy: 33, saves: 1.6, boost: 56, supersonic: 15, neutral: 33, shots: 2.5 },
  Champion: { shotAccuracy: 37, saves: 1.8, boost: 60, supersonic: 18, neutral: 34, shots: 2.8 },
  GC:       { shotAccuracy: 41, saves: 2.1, boost: 64, supersonic: 22, neutral: 35, shots: 3.1 },
  SSL:      { shotAccuracy: 46, saves: 2.4, boost: 68, supersonic: 26, neutral: 37, shots: 3.5 },
}

const diamondII = diamondIIArtifact.benchmarks['diamond-2']
const m = diamondII.metrics

const measuredDiamond: RankBenchmarkMetrics = {
  shotAccuracy: m.shotAccuracyRatio.mean ?? 0,
  saves: m.savesPerGame.mean ?? 0,
  boost: m.avgBoost.mean ?? 0,
  supersonic: m.supersonicPct.mean ?? 0,
  neutral: m.neutralPct.mean ?? 0,
  shots: m.shotsPerGame.mean ?? 0,
}

const diamondSampleMeta: SampleMeta = {
  uniquePlayers: diamondII.uniquePlayers,
  playlist: 'Ranked Doubles',
  rank: 'Diamond II',
  gamesPerPlayer: '1–5 eligible games per player',
  generatedAt: diamondIIArtifact.generatedAt,
  disclaimer: 'public Ballchasing sample, not an official Rocket League population average',
}

// Recalibration: the only real data point across all 8 ranks is measured
// Diamond II. Without adjustment, the other 7 ranks' hand-tuned guesses were
// built around the OLD Diamond guess and can end up inconsistent with the real
// value — e.g. Platinum's guessed boost (52) was higher than Diamond's real
// measured boost (50.9), which would render as "higher rank, less boost" on
// the radar. Scaling every rank's guess by the ratio between the measured
// value and the guess it's replacing re-anchors the whole curve to one
// confirmed data point while preserving the original relative progression
// between ranks (itself still a guess). These 7 ranks remain 'estimated' —
// this recalibrates guesses, it does not add real per-rank data.
const SCALE_FACTORS = Object.fromEntries(
  METRIC_KEYS.map(key => [key, measuredDiamond[key] / BASE_ESTIMATED_METRICS.Diamond[key]])
) as RankBenchmarkMetrics

function recalibrate(base: RankBenchmarkMetrics): RankBenchmarkMetrics {
  return Object.fromEntries(
    METRIC_KEYS.map(key => [key, +(base[key] * SCALE_FACTORS[key]).toFixed(2)])
  ) as RankBenchmarkMetrics
}

export const RANK_BENCHMARKS: Record<RankKey, RankBenchmarkEntry> = {
  Bronze:   { source: 'estimated', metrics: recalibrate(BASE_ESTIMATED_METRICS.Bronze) },
  Silver:   { source: 'estimated', metrics: recalibrate(BASE_ESTIMATED_METRICS.Silver) },
  Gold:     { source: 'estimated', metrics: recalibrate(BASE_ESTIMATED_METRICS.Gold) },
  Platinum: { source: 'estimated', metrics: recalibrate(BASE_ESTIMATED_METRICS.Platinum) },
  // Measured from real Ballchasing data (see data/generated/rank-benchmarks.json
  // and its accompanying review.md for the full collection methodology). This
  // radar bucket is labeled "Diamond" in the UI but the underlying sample is
  // specifically Diamond II, not a combined Diamond I–III average.
  Diamond: {
    source: 'measured',
    metrics: measuredDiamond,
    sampleMeta: diamondSampleMeta,
  },
  Champion: { source: 'estimated', metrics: recalibrate(BASE_ESTIMATED_METRICS.Champion) },
  GC:       { source: 'estimated', metrics: recalibrate(BASE_ESTIMATED_METRICS.GC) },
  SSL:      { source: 'estimated', metrics: recalibrate(BASE_ESTIMATED_METRICS.SSL) },
}
