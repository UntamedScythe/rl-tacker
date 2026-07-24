// Regenerates data/generated/rank-benchmarks.json + .review.md from whatever
// is currently in benchmark_player_observations, without any API calls. Safe
// to re-run any time the underlying rows change (e.g. after
// fix-shot-accuracy-anomalies.ts corrects a few rows in place).
//
// Run with: npm run regenerate:benchmark-report

import { createClient } from '@supabase/supabase-js'
import { summarize } from './lib/ballchasing'
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const PLAYLIST = 'ranked-doubles'
const RANK_LABEL = 'diamond-2'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SECRET_KEY
if (!supabaseUrl || !supabaseKey) throw new Error('SUPABASE_URL / SUPABASE_SECRET_KEY are not set')
const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } })

const CURRENT_HARDCODED_DIAMOND_GUESS = {
  shotAccuracy: 33, savesPerGame: 1.6, avgBoost: 56, supersonicPct: 15, neutralPct: 33, shotsPerGame: 2.5,
}

// Extracts finite numeric values, correctly treating SQL NULL (which arrives
// as JS `null`) as "no data" rather than letting `Number(null) === 0` sneak a
// fake zero into the distribution.
function numericValues(rows: Record<string, unknown>[], column: string): number[] {
  return rows
    .filter(r => r[column] !== null && r[column] !== undefined)
    .map(r => Number(r[column]))
    .filter(v => Number.isFinite(v))
}

async function main() {
  const { data, error } = await supabase
    .from('benchmark_player_observations')
    .select('*')
    .eq('playlist', PLAYLIST)
    .eq('rank_label', RANK_LABEL)
  if (error) throw new Error(`Failed to read observations: ${error.message}`)
  const rows = data ?? []
  if (rows.length === 0) throw new Error('No diamond-2 rows found')

  const metricColumns: Record<string, string> = {
    shotAccuracyRatio: 'shot_accuracy_ratio',
    shotAccuracyMeanReported: 'shot_accuracy_mean_reported',
    savesPerGame: 'saves_per_game',
    avgBoost: 'avg_boost',
    supersonicPct: 'supersonic_pct',
    neutralPct: 'neutral_pct',
    shotsPerGame: 'shots_per_game',
    goalsPerGame: 'goals_per_game',
    assistsPerGame: 'assists_per_game',
    avgScore: 'avg_score',
    avgSpeed: 'avg_speed',
    slowPct: 'slow_pct',
    offensivePct: 'offensive_pct',
    defensivePct: 'defensive_pct',
  }

  const metrics: Record<string, ReturnType<typeof summarize>> = {}
  const nullCounts: Record<string, number> = {}
  for (const [metricName, column] of Object.entries(metricColumns)) {
    const values = numericValues(rows, column)
    nullCounts[metricName] = rows.length - values.length
    metrics[metricName] = summarize(values)
  }

  const gamesHistogram: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  for (const r of rows) {
    const n = Number(r.games_used)
    if (n >= 1 && n <= 5) gamesHistogram[n] = (gamesHistogram[n] ?? 0) + 1
  }

  const totalZeroShot = rows.reduce((a, r) => a + Number(r.zero_shot_games ?? 0), 0)
  const totalZeroGoalWithShots = rows.reduce((a, r) => a + Number(r.zero_goal_with_shots_games ?? 0), 0)
  const totalAnomalies = rows.reduce((a, r) => a + Number(r.shooting_pct_anomalies_excluded ?? 0), 0)
  const uniqueReplays = new Set(rows.flatMap(r => r.replay_ids as string[])).size

  const genDir = path.resolve(__dirname, '..', 'data', 'generated')
  mkdirSync(genDir, { recursive: true })

  const artifact = {
    generatedAt: new Date().toISOString(),
    playlist: PLAYLIST,
    proofOfConcept: true,
    revision: 'multi-game (up to 5 games/player), anomaly-symmetric shot accuracy',
    metricVersion: 3,
    benchmarks: {
      [RANK_LABEL]: {
        sampleSize: rows.length,
        uniquePlayers: rows.length,
        uniqueReplays,
        gamesPerPlayerHistogram: gamesHistogram,
        metrics,
        metricNullCounts: nullCounts,
        gameQuality: {
          zeroShotGames: totalZeroShot,
          zeroGoalWithShotsGames: totalZeroGoalWithShots,
          shootingPctAnomaliesExcludedFromBothMethods: totalAnomalies,
        },
      },
    },
  }
  writeFileSync(path.join(genDir, 'rank-benchmarks.json'), JSON.stringify(artifact, null, 2))

  const pocPath = path.join(genDir, 'rank-benchmarks.poc-1game.json')
  let pocMetrics: Record<string, { mean: number | null }> | null = null
  if (existsSync(pocPath)) {
    const poc = JSON.parse(readFileSync(pocPath, 'utf-8'))
    pocMetrics = poc?.benchmarks?.[RANK_LABEL]?.metrics ?? null
  }

  const suspicious: string[] = []
  for (const [metricName, column] of Object.entries(metricColumns)) {
    const stat = metrics[metricName]
    if (!stat || stat.stdev === null || stat.mean === null) continue
    for (const r of rows) {
      const raw = r[column]
      if (raw === null || raw === undefined) continue
      const v = Number(raw)
      if (Number.isFinite(v) && stat.stdev > 0 && Math.abs(v - stat.mean) > 4 * stat.stdev) {
        suspicious.push(`${r.platform}:${r.player_id} — ${metricName}=${v} is >4 stdev from mean (${stat.mean})`)
      }
    }
  }

  const ratioStat = metrics.shotAccuracyRatio
  const meanReportedStat = metrics.shotAccuracyMeanReported
  const lines: string[] = []
  lines.push(`# Diamond II benchmark — 3-5 game candidate review, corrected (${new Date().toISOString()})`)
  lines.push('')
  lines.push(`Playlist: ${PLAYLIST}. Rank: ${RANK_LABEL}. Regenerated from current database rows after correcting two issues found in the prior report:`)
  lines.push('1. A null "no valid data" value for one player was being coerced to a fake 0% instead of excluded (`Number(null) === 0` in JS).')
  lines.push("2. The two shot-accuracy methods weren't treated symmetrically — the pooled ratio method still used raw goals/shots from games whose reported shooting_percentage was >100%, while the mean-of-reported-% method excluded those same games. Both methods now fully exclude anomalous games (all metrics, not just shooting), with a replacement game backfilled where available.")
  lines.push('')
  lines.push('## Sample')
  lines.push(`- Players in final sample: ${rows.length}`)
  lines.push(`- Unique replays used: ${uniqueReplays}`)
  lines.push('')
  lines.push('## Games-per-player histogram')
  lines.push('| Games completed | Player count |')
  lines.push('|---|---|')
  for (const n of [1, 2, 3, 4, 5]) lines.push(`| ${n} | ${gamesHistogram[n] ?? 0} |`)
  lines.push('')
  lines.push('## Game-quality tallies')
  lines.push(`- Zero-shot games (no shot attempts that game): ${totalZeroShot}`)
  lines.push(`- Zero-goal-with-shots games (took shots, scored none): ${totalZeroGoalWithShots}`)
  lines.push(`- Shooting-percentage anomalies (>100%) excluded from BOTH methods: ${totalAnomalies}`)
  lines.push('')
  lines.push('## Shot accuracy: two methods, compared (now symmetric)')
  lines.push('')
  lines.push('| Method | Mean | Median | p25 | p75 | stdev | Missing data (players) |')
  lines.push('|---|---|---|---|---|---|---|')
  lines.push(`| Pooled ratio (total goals / total shots across a player's eligible games) | ${ratioStat.mean} | ${ratioStat.median} | ${ratioStat.p25} | ${ratioStat.p75} | ${ratioStat.stdev} | ${nullCounts.shotAccuracyRatio} |`)
  lines.push(`| Mean of Ballchasing's reported per-game shooting_percentage | ${meanReportedStat.mean} | ${meanReportedStat.median} | ${meanReportedStat.p25} | ${meanReportedStat.p75} | ${meanReportedStat.stdev} | ${nullCounts.shotAccuracyMeanReported} |`)
  lines.push('')
  const ratioLower = ratioStat.stdev !== null && meanReportedStat.stdev !== null && ratioStat.stdev < meanReportedStat.stdev
  lines.push('**Recommendation: use the pooled ratio (total goals / total shots).** This is a recommendation on statistical')
  lines.push('principle, not just on which stdev happens to be lower in one sample: averaging per-game percentages gives a')
  lines.push('game with 1 shot the same weight as a game with 10 shots (the classic "average of rates" mistake), while the')
  lines.push("pooled ratio weights every shot equally regardless of which game it happened in. In this corrected dataset,")
  if (ratioStat.stdev !== null && meanReportedStat.stdev !== null) {
    lines.push(`the pooled ratio's stdev is ${ratioStat.stdev} versus ${meanReportedStat.stdev} for mean-of-percentages — ${ratioLower ? 'the pooled ratio is now also the tighter distribution, consistent with the theoretical expectation' : 'the pooled ratio is still slightly wider here, which is plausible given it weights high-shot-volume games more heavily and this sample still has some low-shot-count games — the principled argument above is why it remains the recommended method regardless'}.`)
  }
  lines.push('')
  lines.push('## Three-way comparison — radar-relevant metrics')
  lines.push('')
  lines.push('| Metric | Original hardcoded guess | 1-game POC mean | 3-5 game mean (corrected) | 3-5 game median |')
  lines.push('|---|---|---|---|---|')
  const radarRows: [string, string][] = [
    ['shotAccuracy', 'shotAccuracyRatio'],
    ['savesPerGame', 'savesPerGame'],
    ['avgBoost', 'avgBoost'],
    ['supersonicPct', 'supersonicPct'],
    ['neutralPct', 'neutralPct'],
    ['shotsPerGame', 'shotsPerGame'],
  ]
  for (const [oldKey, newKey] of radarRows) {
    const oldValue = (CURRENT_HARDCODED_DIAMOND_GUESS as Record<string, number>)[oldKey]
    const pocValue = pocMetrics?.[oldKey]?.mean ?? 'n/a'
    const stat = metrics[newKey]
    lines.push(`| ${oldKey} | ${oldValue} | ${pocValue} | ${stat.mean} | ${stat.median} |`)
  }
  lines.push('')
  lines.push('## Suspicious observations')
  if (suspicious.length === 0) {
    lines.push('None flagged.')
  } else {
    for (const s of suspicious) lines.push(`- ${s}`)
  }
  lines.push('')
  lines.push(`Full metric distributions are in \`rank-benchmarks.json\` under \`benchmarks.${RANK_LABEL}.metrics\`.`)
  lines.push('The 1-game POC snapshot is preserved at `rank-benchmarks.poc-1game.json` / `rank-benchmarks.review.poc-1game.md`.')

  writeFileSync(path.join(genDir, 'rank-benchmarks.review.md'), lines.join('\n'))
  console.log('Wrote data/generated/rank-benchmarks.json and rank-benchmarks.review.md')
}

main().catch(err => {
  console.error('Regeneration failed:', err)
  process.exit(1)
})
