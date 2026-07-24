// Targeted correction for the 4 diamond-2 players whose accepted games included
// a shooting_percentage > 100% anomaly. The expansion pass only excluded that
// anomalous value from the mean-of-reported-% method, while the pooled ratio
// method still summed its raw (untrustworthy) goals/shots — an asymmetric
// comparison. This re-fetches just these 4 players' known replays, drops the
// anomalous game entirely from BOTH methods (all metrics, not just shooting,
// since we can't be confident only the shot fields are affected), and — since
// dropping a game shrinks a player's sample — searches for a replacement game
// to bring them back toward their prior games_used count where possible.
//
// Run with: npm run fix:shot-accuracy-anomalies

import { createClient } from '@supabase/supabase-js'
import { extractGameStats, aggregateGameStats, computeShotAccuracyRatio, type GameStats, type PlayerStatsBlock } from '../lib/metrics'
import { BALLCHASING_BASE, BASE_DELAY_MS, HourlyLimiter, fetchWithBackoff, sleep } from './lib/ballchasing'

const PLAYLIST = 'ranked-doubles'
const RANK_LABEL = 'diamond-2'
const GAMES_TARGET = 5
const PLAYER_SEARCH_COUNT = 8

const apiKey = process.env.BALLCHASING_API_KEY
const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SECRET_KEY
if (!apiKey) throw new Error('BALLCHASING_API_KEY is not set')
if (!supabaseUrl || !supabaseKey) throw new Error('SUPABASE_URL / SUPABASE_SECRET_KEY are not set')

const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } })
const listLimiter = new HourlyLimiter(350, 'list')
const detailLimiter = new HourlyLimiter(700, 'detail')

type DetailPlayer = { id?: { platform?: string; id?: string }; rank?: { id?: string }; stats?: PlayerStatsBlock }
type DetailReplay = { id: string; playlist_id?: string; blue?: { players?: DetailPlayer[] }; orange?: { players?: DetailPlayer[] } }
type ListReplay = { id: string }
type ListResponse = { list: ListReplay[] }

function isAllZeroCore(g: GameStats) {
  return g.goals === 0 && g.assists === 0 && g.saves === 0 && g.shots === 0
}

async function fetchDetail(replayId: string): Promise<DetailReplay | null> {
  await detailLimiter.wait()
  await sleep(BASE_DELAY_MS)
  try {
    return (await fetchWithBackoff(`${BALLCHASING_BASE}/replays/${replayId}`, apiKey!)) as unknown as DetailReplay
  } catch (err) {
    console.error(`[detail] failed for ${replayId}:`, (err as Error).message)
    return null
  }
}

async function findReplacementGame(
  platform: string, playerId: string, excludeReplayIds: Set<string>
): Promise<{ game: GameStats; replayId: string } | null> {
  await listLimiter.wait()
  await sleep(BASE_DELAY_MS)
  const url =
    `${BALLCHASING_BASE}/replays?player-id=${encodeURIComponent(`${platform}:${playerId}`)}` +
    `&playlist=${PLAYLIST}&count=${PLAYER_SEARCH_COUNT}&sort-by=replay-date&sort-dir=desc`
  let page: ListResponse
  try {
    page = (await fetchWithBackoff(url, apiKey!)) as unknown as ListResponse
  } catch {
    return null
  }

  for (const replay of page.list) {
    if (excludeReplayIds.has(replay.id)) continue
    const detail = await fetchDetail(replay.id)
    if (!detail || detail.playlist_id !== PLAYLIST) continue
    const players = [...(detail.blue?.players ?? []), ...(detail.orange?.players ?? [])]
    const me = players.find(p => p.id?.platform === platform && p.id?.id === playerId)
    if (!me) continue
    if (me.rank?.id && me.rank.id !== RANK_LABEL) continue
    if (!me.stats?.core || !me.stats?.boost || !me.stats?.movement || !me.stats?.positioning) continue
    const game = extractGameStats(me.stats)
    if (isAllZeroCore(game)) continue
    if (game.shootingPercentage > 100) continue // don't replace one untrustworthy game with another
    return { game, replayId: replay.id }
  }
  return null
}

function computeShotAccuracy(games: GameStats[]) {
  let zeroShotGames = 0, zeroGoalWithShotsGames = 0
  for (const g of games) {
    if (g.shots === 0) zeroShotGames++
    else if (g.goals === 0) zeroGoalWithShotsGames++
  }
  const ratio = computeShotAccuracyRatio(games) // shared with the live app — see lib/metrics.ts
  const meanReported = games.length > 0
    ? +(games.reduce((a, g) => a + g.shootingPercentage, 0) / games.length).toFixed(1)
    : null
  return { ratio, meanReported, zeroShotGames, zeroGoalWithShotsGames }
}

async function main() {
  const { data: rows, error } = await supabase
    .from('benchmark_player_observations')
    .select('platform, player_id, replay_ids, games_used')
    .eq('playlist', PLAYLIST)
    .eq('rank_label', RANK_LABEL)
    .gt('shooting_pct_anomalies_excluded', 0)
  if (error) throw new Error(error.message)
  if (!rows || rows.length === 0) {
    console.log('No anomaly-affected players found — nothing to fix.')
    return
  }

  console.log(`Fixing ${rows.length} anomaly-affected players (symmetric exclusion from both shot-accuracy methods)...`)

  for (const row of rows) {
    console.log(`\n-- ${row.platform}:${row.player_id} (was ${row.games_used} games) --`)
    const excludeFromSearch = new Set<string>(row.replay_ids as string[]) // never re-fetch a replay already known for this player
    const validGames: GameStats[] = []
    const finalReplayIds: string[] = [] // only replays actually contributing to the final aggregate
    let anomalousCount = 0

    for (const replayId of row.replay_ids as string[]) {
      const detail = await fetchDetail(replayId)
      if (!detail) continue
      const players = [...(detail.blue?.players ?? []), ...(detail.orange?.players ?? [])]
      const me = players.find(p => p.id?.platform === row.platform && p.id?.id === row.player_id)
      if (!me?.stats) continue
      const game = extractGameStats(me.stats)
      if (game.shootingPercentage > 100) {
        anomalousCount++
        console.log(`  dropping anomalous game ${replayId}: goals=${game.goals} shots=${game.shots} reportedPct=${game.shootingPercentage}`)
        continue
      }
      validGames.push(game)
      finalReplayIds.push(replayId)
    }

    // Try to backfill up to the original games_used count (or GAMES_TARGET, whichever
    // is lower) now that an anomalous game was dropped.
    const target = Math.min(row.games_used, GAMES_TARGET)
    while (validGames.length < target) {
      const replacement = await findReplacementGame(row.platform, row.player_id, excludeFromSearch)
      if (!replacement) break
      excludeFromSearch.add(replacement.replayId)
      validGames.push(replacement.game)
      finalReplayIds.push(replacement.replayId)
      console.log(`  backfilled with replacement game ${replacement.replayId}`)
    }

    if (validGames.length === 0) {
      console.log('  no valid games remain — dropping player from sample')
      await supabase.from('benchmark_player_observations')
        .delete()
        .eq('platform', row.platform).eq('player_id', row.player_id)
        .eq('playlist', PLAYLIST).eq('rank_label', RANK_LABEL)
      continue
    }

    const agg = aggregateGameStats(validGames)
    const shotAcc = computeShotAccuracy(validGames)

    await supabase.from('benchmark_player_observations').update({
      replay_ids: finalReplayIds,
      games_used: validGames.length,
      goals_per_game: agg.goalsPerGame,
      assists_per_game: agg.assistsPerGame,
      saves_per_game: agg.savesPerGame,
      shots_per_game: agg.shotsPerGame,
      shot_accuracy: shotAcc.ratio ?? 0,
      shot_accuracy_ratio: shotAcc.ratio,
      shot_accuracy_mean_reported: shotAcc.meanReported,
      zero_shot_games: shotAcc.zeroShotGames,
      zero_goal_with_shots_games: shotAcc.zeroGoalWithShotsGames,
      shooting_pct_anomalies_excluded: anomalousCount,
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
      .eq('platform', row.platform).eq('player_id', row.player_id)
      .eq('playlist', PLAYLIST).eq('rank_label', RANK_LABEL)

    console.log(`  final: ${validGames.length} games, ratio=${shotAcc.ratio}, meanReported=${shotAcc.meanReported}`)
  }

  console.log('\nDone. Re-run npm run regenerate:benchmark-report to refresh the JSON/MD artifacts.')
}

main().catch(err => {
  console.error('Fix failed:', err)
  process.exit(1)
})
