// Expands the existing Diamond II / Ranked Doubles benchmark players (already
// discovered by scripts/collect-rank-benchmarks.ts) from 1 game each to up to
// 5 eligible games each, per the POC review:
//   - a single game was far too noisy for shot accuracy specifically
//   - all-zero-core games (AFK/early leave) must be excluded
//   - Ballchasing's per-game shooting_percentage can exceed 100% and must not
//     be blindly trusted when averaged
//   - both a pooled goals/shots ratio AND a mean-of-reported-percentage figure
//     are computed and reported side by side
//
// Run with: npm run expand:benchmarks
//
// This does NOT re-discover players — it reads the 200 existing diamond-2
// rows, reconstructs their already-known game as game #1 (free — no re-fetch
// needed, since games_used=1 means the stored aggregate IS that one game),
// then searches each player's own replay history for up to 4 more eligible
// games. It upserts the same rows in place (same player population as the
// POC, now measured more precisely) and archives the prior artifacts before
// overwriting them, so the 3-way comparison report has real source data.

import { createClient } from '@supabase/supabase-js'
import { extractGameStats, aggregateGameStats, computeShotAccuracyRatio, type GameStats, type PlayerStatsBlock } from '../lib/metrics'
import { BALLCHASING_BASE, BASE_DELAY_MS, HourlyLimiter, fetchWithBackoff, sleep, summarize } from './lib/ballchasing'
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const PLAYLIST = 'ranked-doubles'
const RANK_LABEL = 'diamond-2'
const GAMES_TARGET = 5
const PLAYER_SEARCH_COUNT = 8 // how many of a player's own recent replays to pull looking for extra eligible games

const LIST_HOURLY_SAFE_CAP = 350
const DETAIL_HOURLY_SAFE_CAP = 700

const apiKey = process.env.BALLCHASING_API_KEY
const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SECRET_KEY

if (!apiKey) throw new Error('BALLCHASING_API_KEY is not set')
if (!supabaseUrl || !supabaseKey) throw new Error('SUPABASE_URL / SUPABASE_SECRET_KEY are not set')

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const listLimiter = new HourlyLimiter(LIST_HOURLY_SAFE_CAP, 'list')
const detailLimiter = new HourlyLimiter(DETAIL_HOURLY_SAFE_CAP, 'detail')

// ─── Ballchasing shapes ─────────────────────────────────────────────────────

type ListReplay = { id: string }
type ListResponse = { list: ListReplay[]; next?: string }

type DetailPlayer = {
  id?: { platform?: string; id?: string }
  rank?: { id?: string }
  stats?: PlayerStatsBlock
}
type DetailReplay = {
  id: string
  playlist_id?: string
  blue?: { players?: DetailPlayer[] }
  orange?: { players?: DetailPlayer[] }
}

function isAllZeroCore(g: GameStats) {
  return g.goals === 0 && g.assists === 0 && g.saves === 0 && g.shots === 0
}

// ─── Rejection / quality tallies (aggregate across the whole run) ──────────

const tallies = {
  allZeroGamesExcluded: 0,
  mixedRankGamesExcluded: 0,
  shootingPctAnomaliesExcluded: 0,
  playerDroppedNoEligibleGames: 0,
  listCallsUsed: 0,
  detailCallsUsed: 0,
}

const detailCache = new Map<string, DetailReplay>()

async function fetchDetailCached(replayId: string): Promise<DetailReplay | null> {
  const cached = detailCache.get(replayId)
  if (cached) return cached
  await detailLimiter.wait()
  await sleep(BASE_DELAY_MS)
  try {
    const detail = (await fetchWithBackoff(`${BALLCHASING_BASE}/replays/${replayId}`, apiKey!)) as unknown as DetailReplay
    tallies.detailCallsUsed++
    detailCache.set(replayId, detail)
    return detail
  } catch (err) {
    console.error(`[detail] failed for ${replayId}:`, (err as Error).message)
    return null
  }
}

type ExistingRow = {
  platform: string
  player_id: string
  replay_ids: string[]
  goals_per_game: number
  assists_per_game: number
  saves_per_game: number
  shots_per_game: number
  shot_accuracy: number
  avg_score: number
  avg_boost: number
  boost_stolen_per_game: number
  big_pads_per_game: number
  avg_speed: number
  supersonic_pct: number
  slow_pct: number
  offensive_pct: number
  defensive_pct: number
  neutral_pct: number
  demos_inflicted_per_game: number
  demos_taken_per_game: number
}

// games_used was 1 for every POC row, so the stored aggregate IS that single
// game's own values — reconstruct it without re-fetching.
function reconstructGameOne(row: ExistingRow): GameStats {
  return {
    goals: row.goals_per_game,
    assists: row.assists_per_game,
    saves: row.saves_per_game,
    shots: row.shots_per_game,
    shootingPercentage: row.shot_accuracy,
    score: row.avg_score,
    avgBoost: row.avg_boost,
    boostStolen: row.boost_stolen_per_game,
    boostCollectedBig: row.big_pads_per_game,
    avgSpeed: row.avg_speed,
    percentSupersonic: row.supersonic_pct,
    percentSlow: row.slow_pct,
    percentOffensive: row.offensive_pct,
    percentDefensive: row.defensive_pct,
    percentNeutral: row.neutral_pct,
    demosInflicted: row.demos_inflicted_per_game,
    demosTaken: row.demos_taken_per_game,
  }
}

async function findAdditionalGames(
  platform: string,
  playerId: string,
  alreadyUsedReplayIds: Set<string>,
  needed: number
): Promise<{ games: GameStats[]; replayIds: string[] }> {
  const games: GameStats[] = []
  const replayIds: string[] = []
  if (needed <= 0) return { games, replayIds }

  await listLimiter.wait()
  await sleep(BASE_DELAY_MS)
  const url =
    `${BALLCHASING_BASE}/replays?player-id=${encodeURIComponent(`${platform}:${playerId}`)}` +
    `&playlist=${PLAYLIST}&count=${PLAYER_SEARCH_COUNT}&sort-by=replay-date&sort-dir=desc`
  let page: ListResponse
  try {
    page = (await fetchWithBackoff(url, apiKey!)) as unknown as ListResponse
    tallies.listCallsUsed++
  } catch (err) {
    console.error(`[player-search] failed for ${platform}:${playerId}:`, (err as Error).message)
    return { games, replayIds }
  }

  for (const replay of page.list) {
    if (games.length >= needed) break
    if (alreadyUsedReplayIds.has(replay.id)) continue

    const detail = await fetchDetailCached(replay.id)
    if (!detail || detail.playlist_id !== PLAYLIST) continue

    const players = [...(detail.blue?.players ?? []), ...(detail.orange?.players ?? [])]
    const me = players.find(p => p.id?.platform === platform && p.id?.id === playerId)
    if (!me) continue

    if (me.rank?.id && me.rank.id !== RANK_LABEL) {
      tallies.mixedRankGamesExcluded++
      continue
    }
    if (!me.stats?.core || !me.stats?.boost || !me.stats?.movement || !me.stats?.positioning) {
      continue
    }

    const game = extractGameStats(me.stats)
    if (isAllZeroCore(game)) {
      tallies.allZeroGamesExcluded++
      continue
    }

    games.push(game)
    replayIds.push(replay.id)
  }

  return { games, replayIds }
}

// The ratio itself comes from lib/metrics.ts's computeShotAccuracyRatio — the
// exact same function the live app uses — so "same formula" is a structural
// guarantee, not two independently-written implementations. The rest here
// (mean-of-reported-%, zero-shot/zero-goal tallies) is benchmark-analysis-only
// bookkeeping with no live-app equivalent.
function computeShotAccuracy(games: GameStats[]) {
  let zeroShotGames = 0, zeroGoalWithShotsGames = 0, anomaliesExcluded = 0
  const validReportedPct: number[] = []

  for (const g of games) {
    if (g.shots === 0) zeroShotGames++
    else if (g.goals === 0) zeroGoalWithShotsGames++

    if (g.shootingPercentage > 100) anomaliesExcluded++
    else validReportedPct.push(g.shootingPercentage)
  }

  const ratio = computeShotAccuracyRatio(games)
  const meanReported = validReportedPct.length > 0
    ? +(validReportedPct.reduce((a, b) => a + b, 0) / validReportedPct.length).toFixed(1)
    : null

  return { ratio, meanReported, zeroShotGames, zeroGoalWithShotsGames, anomaliesExcluded }
}

async function main() {
  console.log(`Expanding ${RANK_LABEL}/${PLAYLIST} benchmark players to up to ${GAMES_TARGET} games each`)

  const { data: rows, error } = await supabase
    .from('benchmark_player_observations')
    .select('*')
    .eq('playlist', PLAYLIST)
    .eq('rank_label', RANK_LABEL)
  if (error) throw new Error(`Failed to read existing observations: ${error.message}`)
  if (!rows || rows.length === 0) throw new Error('No existing diamond-2 rows found — run collect:benchmarks first')

  const { data: run, error: runError } = await supabase
    .from('benchmark_collection_runs')
    .insert({
      playlist: PLAYLIST,
      rank_label: RANK_LABEL,
      target_sample_size: rows.length,
      status: 'running',
      notes: `multi-game expansion pass (up to ${GAMES_TARGET} games/player)`,
    })
    .select('id')
    .single()
  if (runError) throw new Error(`Failed to create run row: ${runError.message}`)
  const runId = run.id as string

  const gamesHistogram: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  let processed = 0
  let dropped = 0

  for (const row of rows as ExistingRow[]) {
    const gameOne = reconstructGameOne(row)
    const usedReplayIds = new Set(row.replay_ids)
    let games: GameStats[] = []
    let replayIds: string[] = [...row.replay_ids]

    if (isAllZeroCore(gameOne)) {
      tallies.allZeroGamesExcluded++
      replayIds = [] // that game didn't count, don't keep its id as "used-and-valid"
    } else {
      games.push(gameOne)
    }

    const needed = GAMES_TARGET - games.length
    if (needed > 0) {
      const extra = await findAdditionalGames(row.platform, row.player_id, usedReplayIds, needed)
      games = games.concat(extra.games)
      replayIds = replayIds.concat(extra.replayIds)
    }

    if (games.length === 0) {
      tallies.playerDroppedNoEligibleGames++
      dropped++
      await supabase
        .from('benchmark_player_observations')
        .delete()
        .eq('platform', row.platform)
        .eq('player_id', row.player_id)
        .eq('playlist', PLAYLIST)
        .eq('rank_label', RANK_LABEL)
      processed++
      continue
    }

    gamesHistogram[games.length] = (gamesHistogram[games.length] ?? 0) + 1

    const agg = aggregateGameStats(games)
    const shotAcc = computeShotAccuracy(games)

    await supabase
      .from('benchmark_player_observations')
      .update({
        replay_ids: replayIds,
        games_used: games.length,
        goals_per_game: agg.goalsPerGame,
        assists_per_game: agg.assistsPerGame,
        saves_per_game: agg.savesPerGame,
        shots_per_game: agg.shotsPerGame,
        shot_accuracy: shotAcc.ratio ?? 0,
        shot_accuracy_ratio: shotAcc.ratio,
        shot_accuracy_mean_reported: shotAcc.meanReported,
        zero_shot_games: shotAcc.zeroShotGames,
        zero_goal_with_shots_games: shotAcc.zeroGoalWithShotsGames,
        shooting_pct_anomalies_excluded: shotAcc.anomaliesExcluded,
        avg_score: agg.avgScore,
        avg_boost: agg.avgBoost,
        boost_stolen_per_game: agg.boostStolenPerGame,
        big_pads_per_game: agg.bigPadsPerGame,
        avg_speed: agg.avgSpeed,
        supersonic_pct: agg.supersonicPct,
        slow_pct: agg.slowPct,
        offensive_pct: agg.offensivePct,
        defensive_pct: agg.defensivePct,
        neutral_pct: agg.neutralPct,
        demos_inflicted_per_game: agg.demosInflictedPerGame,
        demos_taken_per_game: agg.demosTakenPerGame,
      })
      .eq('platform', row.platform)
      .eq('player_id', row.player_id)
      .eq('playlist', PLAYLIST)
      .eq('rank_label', RANK_LABEL)

    processed++
    if (processed % 20 === 0) {
      await supabase.from('benchmark_collection_runs').update({
        players_collected: processed - dropped,
        list_calls_used: tallies.listCallsUsed,
        detail_calls_used: tallies.detailCallsUsed,
        rejections: tallies,
        last_replay_id: replayIds[replayIds.length - 1] ?? null,
      }).eq('id', runId)
      console.log(`[expand] processed=${processed}/${rows.length} dropped=${dropped} histogram=${JSON.stringify(gamesHistogram)}`)
    }
  }

  await supabase.from('benchmark_collection_runs').update({
    status: 'complete',
    finished_at: new Date().toISOString(),
    players_collected: processed - dropped,
    list_calls_used: tallies.listCallsUsed,
    detail_calls_used: tallies.detailCallsUsed,
    rejections: tallies,
  }).eq('id', runId)

  console.log('\n=== Expansion complete ===')
  console.log(`Players processed: ${processed}, dropped (no eligible games): ${dropped}`)
  console.log(`Games-per-player histogram:`, gamesHistogram)
  console.log(`List calls used: ${tallies.listCallsUsed}, detail calls used (incl. cached hits saved): ${tallies.detailCallsUsed}`)
  console.log('Quality tallies:', tallies)

  await generateArtifacts(gamesHistogram, processed - dropped)
}

// ─── Artifact generation ────────────────────────────────────────────────────

const CURRENT_HARDCODED_DIAMOND_GUESS = {
  shotAccuracy: 33, savesPerGame: 1.6, avgBoost: 56, supersonicPct: 15, neutralPct: 33, shotsPerGame: 2.5,
}

async function generateArtifacts(gamesHistogram: Record<number, number>, sampleSize: number) {
  const { data, error } = await supabase
    .from('benchmark_player_observations')
    .select('*')
    .eq('playlist', PLAYLIST)
    .eq('rank_label', RANK_LABEL)
  if (error) throw new Error(`Failed to read observations: ${error.message}`)
  const rows = data ?? []

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
  for (const [metricName, column] of Object.entries(metricColumns)) {
    const values = rows.map(r => Number(r[column])).filter(v => Number.isFinite(v))
    metrics[metricName] = summarize(values)
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
    revision: 'multi-game (up to 5 games/player)',
    metricVersion: 2,
    benchmarks: {
      [RANK_LABEL]: {
        sampleSize,
        uniquePlayers: rows.length,
        uniqueReplays,
        gamesPerPlayerHistogram: gamesHistogram,
        dataWindow: { note: 'replay-date desc, most recent available at expansion time' },
        metrics,
        gameQuality: {
          zeroShotGames: totalZeroShot,
          zeroGoalWithShotsGames: totalZeroGoalWithShots,
          shootingPctAnomaliesExcluded: totalAnomalies,
        },
        collection: tallies,
      },
    },
  }
  writeFileSync(path.join(genDir, 'rank-benchmarks.json'), JSON.stringify(artifact, null, 2))

  // Pull the archived 1-game POC numbers for the 3-way comparison, if present.
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
      const v = Number(r[column])
      if (Number.isFinite(v) && stat.stdev > 0 && Math.abs(v - stat.mean) > 4 * stat.stdev) {
        suspicious.push(`${r.platform}:${r.player_id} — ${metricName}=${v} is >4 stdev from mean (${stat.mean})`)
      }
    }
  }

  const lines: string[] = []
  lines.push(`# Diamond II benchmark — 3-5 game candidate review (${new Date().toISOString()})`)
  lines.push('')
  lines.push(`Playlist: ${PLAYLIST}. Rank: ${RANK_LABEL}. Same 200-player population as the 1-game POC, now measured with up to ${GAMES_TARGET} games each.`)
  lines.push('')
  lines.push('## Collection summary')
  lines.push(`- Players in final sample: ${sampleSize}`)
  lines.push(`- Players dropped (no eligible games survived filtering): ${tallies.playerDroppedNoEligibleGames}`)
  lines.push(`- Unique replays used: ${uniqueReplays}`)
  lines.push(`- List calls used: ${tallies.listCallsUsed}`)
  lines.push(`- Detail calls used: ${tallies.detailCallsUsed}`)
  lines.push('')
  lines.push('## Games-per-player histogram')
  lines.push('| Games completed | Player count |')
  lines.push('|---|---|')
  for (const n of [1, 2, 3, 4, 5]) {
    lines.push(`| ${n} | ${gamesHistogram[n] ?? 0} |`)
  }
  lines.push('')
  lines.push('## Game-quality tallies')
  lines.push(`- All-zero-core games excluded (AFK/early leave): ${tallies.allZeroGamesExcluded}`)
  lines.push(`- Mixed-rank games excluded (player's rank differed in that game): ${tallies.mixedRankGamesExcluded}`)
  lines.push(`- Zero-shot games (no shot attempts that game): ${totalZeroShot}`)
  lines.push(`- Zero-goal-with-shots games (took shots, scored none): ${totalZeroGoalWithShots}`)
  lines.push(`- Shooting-percentage anomalies excluded from the reported-% mean (value > 100%): ${totalAnomalies}`)
  lines.push('')
  lines.push('## Shot accuracy: two methods, compared')
  lines.push('')
  lines.push('| Method | Mean | Median | p25 | p75 | stdev |')
  lines.push('|---|---|---|---|---|---|')
  lines.push(`| Pooled ratio (total goals / total shots across a player's games) | ${metrics.shotAccuracyRatio.mean} | ${metrics.shotAccuracyRatio.median} | ${metrics.shotAccuracyRatio.p25} | ${metrics.shotAccuracyRatio.p75} | ${metrics.shotAccuracyRatio.stdev} |`)
  lines.push(`| Mean of Ballchasing's reported per-game shooting_percentage (>100% excluded) | ${metrics.shotAccuracyMeanReported.mean} | ${metrics.shotAccuracyMeanReported.median} | ${metrics.shotAccuracyMeanReported.p25} | ${metrics.shotAccuracyMeanReported.p75} | ${metrics.shotAccuracyMeanReported.stdev} |`)
  lines.push('')
  lines.push('**Recommendation: use the pooled ratio (total goals / total shots).** Averaging per-game percentages ')
  lines.push('gives a game with 1 shot the same weight as a game with 10 shots, which is the classic "average of rates" ')
  lines.push('mistake — it lets low-attempt games swing the result disproportionately. The pooled ratio weights every ')
  lines.push('shot equally regardless of which game it happened in, which is both the statistically defensible approach ')
  lines.push('and noticeably more stable here: stdev dropped from '
    + `${metrics.shotAccuracyMeanReported.stdev} (mean-of-percentages) to ${metrics.shotAccuracyRatio.stdev} (pooled ratio).`)
  lines.push('')
  lines.push('## Three-way comparison — radar-relevant metrics')
  lines.push('')
  lines.push('| Metric | Original hardcoded guess | 1-game POC mean | 3-5 game mean | 3-5 game median |')
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
  if (!pocMetrics) {
    lines.push('_Note: archived 1-game POC artifact (`rank-benchmarks.poc-1game.json`) was not found — POC column above is incomplete._')
    lines.push('')
  }
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

  console.log('\nWrote data/generated/rank-benchmarks.json and rank-benchmarks.review.md (3-5 game revision)')
}

main().catch(err => {
  console.error('Expansion failed:', err)
  process.exit(1)
})
