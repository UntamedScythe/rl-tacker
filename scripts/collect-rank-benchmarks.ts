// Standalone, resumable-in-spirit collector for one rank's real benchmark data.
// Run with: npm run collect:benchmarks
//
// PROOF OF CONCEPT SCOPE (see conversation history / plan for full context):
//   - Ranked Doubles only.
//   - One rank bucket only: diamond-2 (division-level, not the broad 8-tier UI bucket).
//   - One game per accepted player (not the eventual 3-5 game per-player aggregate).
// This writes raw observations + progress to Supabase, then generates a
// candidate static JSON artifact + review report. It does NOT touch
// components/RadarChartComponent.tsx — that only happens after manual review.
//
// Rank filtering happens server-side via min-rank/max-rank, but Ballchasing only
// attaches an individual `rank` field to the (usually one) tracked/verified
// player in a replay — everyone else reads `rank: null` even though they have
// full stats. That single tracked player is often the uploader, so duplicate
// players across replays is the dominant attrition source, not rank mismatches.
// Empirically (see console output during development): ~800 replays scanned via
// the list endpoint yielded 512 unique diamond-2 candidates with ~9% appearing
// more than once — so the list endpoint alone is used to pre-screen for a NEW
// candidate before ever spending a detail call, which is the scarcer budget.

import { createClient } from '@supabase/supabase-js'
import { extractGameStats, aggregateGameStats, type PlayerStatsBlock } from '../lib/metrics'
import { writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'

const BALLCHASING_BASE = 'https://ballchasing.com/api'
const PLAYLIST = 'ranked-doubles'
const RANK_LABEL = 'diamond-2'
const TARGET_SAMPLE_SIZE = Number(process.env.BENCHMARK_TARGET_SAMPLE_SIZE ?? 200)
const GAMES_PER_PLAYER_CAP = 1 // POC only — see header comment
const LIST_COUNT = 200
const QUEUE_BUFFER_FACTOR = 1.4 // queue extra candidates to absorb detail-stage rejections

// Stay well under Ballchasing's documented free-tier caps (2/sec, 500/hr list,
// 1000/hr detail) rather than planning to exhaust them.
const LIST_HOURLY_SAFE_CAP = 350
const DETAIL_HOURLY_SAFE_CAP = 700
const BASE_DELAY_MS = 600

const apiKey = process.env.BALLCHASING_API_KEY
const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SECRET_KEY

if (!apiKey) throw new Error('BALLCHASING_API_KEY is not set')
if (!supabaseUrl || !supabaseKey) throw new Error('SUPABASE_URL / SUPABASE_SECRET_KEY are not set')

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// ─── Rate limiting ──────────────────────────────────────────────────────────

class HourlyLimiter {
  private windowStart = Date.now()
  private count = 0
  constructor(private cap: number, private label: string) {}

  async wait() {
    const elapsed = Date.now() - this.windowStart
    if (elapsed > 60 * 60 * 1000) {
      this.windowStart = Date.now()
      this.count = 0
    }
    if (this.count >= this.cap) {
      const waitMs = 60 * 60 * 1000 - elapsed
      console.log(`[rate-limit] ${this.label} hit safe cap (${this.cap}/hr) — sleeping ${Math.ceil(waitMs / 1000)}s`)
      await sleep(waitMs)
      this.windowStart = Date.now()
      this.count = 0
    }
    this.count++
  }
}

const listLimiter = new HourlyLimiter(LIST_HOURLY_SAFE_CAP, 'list')
const detailLimiter = new HourlyLimiter(DETAIL_HOURLY_SAFE_CAP, 'detail')

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchWithBackoff(url: string, retries = 4): Promise<Record<string, unknown>> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, { headers: { Authorization: apiKey! } })
    if (res.status === 429) {
      const wait = 3000 * (attempt + 1)
      console.log(`[429] rate limited, waiting ${wait}ms (attempt ${attempt + 1}/${retries + 1})`)
      await sleep(wait)
      continue
    }
    if (!res.ok) {
      if (attempt < retries) {
        await sleep(2000 * (attempt + 1))
        continue
      }
      throw new Error(`Ballchasing request failed: ${res.status} ${await res.text().catch(() => '')}`)
    }
    return res.json()
  }
  throw new Error('Max retries exceeded')
}

// ─── Ballchasing shapes (only the fields we use) ───────────────────────────

type ListPlayer = {
  name?: string
  id?: { platform?: string; id?: string }
  rank?: { id?: string; tier?: number; division?: number; name?: string }
}
type ListReplay = {
  id: string
  playlist_id?: string
  season?: number | string
  blue?: { players?: ListPlayer[] }
  orange?: { players?: ListPlayer[] }
}
type ListResponse = { list: ListReplay[]; next?: string }

type DetailPlayer = ListPlayer & { stats?: PlayerStatsBlock }
type DetailReplay = {
  id: string
  match_guid?: string
  playlist_id?: string
  season?: number | string
  season_type?: string
  blue?: { players?: DetailPlayer[] }
  orange?: { players?: DetailPlayer[] }
}

function playerKey(p: { id?: { platform?: string; id?: string } }) {
  return `${p.id?.platform ?? '?'}:${p.id?.id ?? '?'}`
}

// ─── Rejection tally ────────────────────────────────────────────────────────

const rejections = {
  missingOrMismatchedRank: 0,
  duplicatePlayer: 0,
  duplicateReplay: 0,
  malformedStats: 0,
  wrongPlaylistOrSeason: 0,
  noNewCandidateInListPreview: 0,
}

// ─── Supabase helpers ───────────────────────────────────────────────────────

async function createRunRow() {
  const { data, error } = await supabase
    .from('benchmark_collection_runs')
    .insert({
      playlist: PLAYLIST,
      rank_label: RANK_LABEL,
      target_sample_size: TARGET_SAMPLE_SIZE,
      status: 'running',
    })
    .select('id')
    .single()
  if (error) throw new Error(`Failed to create run row: ${error.message}`)
  return data.id as string
}

async function updateRunRow(runId: string, patch: Record<string, unknown>) {
  const { error } = await supabase.from('benchmark_collection_runs').update(patch).eq('id', runId)
  if (error) console.error('[supabase] checkpoint update failed (non-fatal):', error.message)
}

async function insertObservation(row: Record<string, unknown>) {
  const { error } = await supabase.from('benchmark_player_observations').insert(row)
  if (error) throw new Error(`Failed to insert observation: ${error.message}`)
}

// ─── Main collection ────────────────────────────────────────────────────────

async function main() {
  console.log(`Starting Diamond II collection: playlist=${PLAYLIST} rank=${RANK_LABEL} target=${TARGET_SAMPLE_SIZE}`)
  const runId = await createRunRow()

  const collected = new Set<string>() // playerKey -> already has an accepted observation
  const claimedForQueue = new Set<string>() // playerKey -> already queued for a detail fetch
  const seenReplayIds = new Set<string>()
  const queue: string[] = []

  let listCallsUsed = 0
  let detailCallsUsed = 0

  // ── Stage A: scan the list endpoint, pre-screen with its embedded rank data ──
  let nextUrl: string | undefined =
    `${BALLCHASING_BASE}/replays?playlist=${PLAYLIST}&min-rank=${RANK_LABEL}&max-rank=${RANK_LABEL}` +
    `&count=${LIST_COUNT}&sort-by=replay-date&sort-dir=desc`

  const queueTarget = Math.ceil(TARGET_SAMPLE_SIZE * QUEUE_BUFFER_FACTOR)

  while (nextUrl && queue.length < queueTarget) {
    await listLimiter.wait()
    await sleep(BASE_DELAY_MS)
    const page = (await fetchWithBackoff(nextUrl)) as unknown as ListResponse
    listCallsUsed++

    for (const replay of page.list) {
      if (seenReplayIds.has(replay.id)) {
        rejections.duplicateReplay++
        continue
      }
      seenReplayIds.add(replay.id)

      const players = [...(replay.blue?.players ?? []), ...(replay.orange?.players ?? [])]
      const hasNewCandidate = players.some(p => {
        if (p.rank?.id !== RANK_LABEL) return false
        const key = playerKey(p)
        return !collected.has(key) && !claimedForQueue.has(key)
      })

      if (!hasNewCandidate) {
        rejections.noNewCandidateInListPreview++
        continue
      }

      for (const p of players) {
        if (p.rank?.id === RANK_LABEL) claimedForQueue.add(playerKey(p))
      }
      queue.push(replay.id)
      if (queue.length >= queueTarget) break
    }

    nextUrl = page.next
    if (listCallsUsed % 2 === 0) {
      console.log(`[list] pages=${listCallsUsed} queued=${queue.length}/${queueTarget}`)
    }
  }

  console.log(`List scan done: ${listCallsUsed} list calls, ${queue.length} replays queued, ${seenReplayIds.size} replays seen.`)

  // ── Stage B: fetch details, verify, accept ──
  for (const replayId of queue) {
    if (collected.size >= TARGET_SAMPLE_SIZE) break

    await detailLimiter.wait()
    await sleep(BASE_DELAY_MS)
    let detail: DetailReplay
    try {
      detail = (await fetchWithBackoff(`${BALLCHASING_BASE}/replays/${replayId}`)) as unknown as DetailReplay
    } catch (err) {
      console.error(`[detail] failed for ${replayId}:`, (err as Error).message)
      continue
    }
    detailCallsUsed++

    if (detail.playlist_id !== PLAYLIST) {
      rejections.wrongPlaylistOrSeason++
    } else {
      const players = [...(detail.blue?.players ?? []), ...(detail.orange?.players ?? [])]
      for (const p of players) {
        if (collected.size >= TARGET_SAMPLE_SIZE) break

        if (p.rank?.id !== RANK_LABEL) {
          rejections.missingOrMismatchedRank++
          continue
        }
        const key = playerKey(p)
        if (collected.has(key)) {
          rejections.duplicatePlayer++
          continue
        }
        if (!p.stats?.core || !p.stats?.boost || !p.stats?.movement || !p.stats?.positioning) {
          rejections.malformedStats++
          continue
        }

        const game = extractGameStats(p.stats)
        const row = aggregateGameStats([game]) // POC: games_used = GAMES_PER_PLAYER_CAP = 1

        await insertObservation({
          playlist: PLAYLIST,
          season: String(detail.season ?? ''),
          rank_label: RANK_LABEL,
          platform: p.id?.platform ?? 'unknown',
          player_id: p.id?.id ?? 'unknown',
          replay_ids: [replayId],
          games_used: GAMES_PER_PLAYER_CAP,
          goals_per_game: row.goalsPerGame,
          assists_per_game: row.assistsPerGame,
          saves_per_game: row.savesPerGame,
          shots_per_game: row.shotsPerGame,
          shot_accuracy: row.shotAccuracy,
          avg_score: row.avgScore,
          avg_boost: row.avgBoost,
          boost_stolen_per_game: row.boostStolenPerGame,
          big_pads_per_game: row.bigPadsPerGame,
          avg_speed: row.avgSpeed,
          supersonic_pct: row.supersonicPct,
          slow_pct: row.slowPct,
          offensive_pct: row.offensivePct,
          defensive_pct: row.defensivePct,
          neutral_pct: row.neutralPct,
          demos_inflicted_per_game: row.demosInflictedPerGame,
          demos_taken_per_game: row.demosTakenPerGame,
        })
        collected.add(key)
      }
    }

    await updateRunRow(runId, {
      players_collected: collected.size,
      list_calls_used: listCallsUsed,
      detail_calls_used: detailCallsUsed,
      rejections,
      last_replay_id: replayId,
    })

    if (detailCallsUsed % 20 === 0) {
      console.log(`[detail] processed=${detailCallsUsed} collected=${collected.size}/${TARGET_SAMPLE_SIZE}`)
    }
  }

  await updateRunRow(runId, {
    status: 'complete',
    finished_at: new Date().toISOString(),
    players_collected: collected.size,
    list_calls_used: listCallsUsed,
    detail_calls_used: detailCallsUsed,
    rejections,
  })

  console.log('\n=== Collection complete ===')
  console.log(`Unique players collected: ${collected.size}`)
  console.log(`List calls used: ${listCallsUsed}`)
  console.log(`Detail calls used: ${detailCallsUsed}`)
  console.log('Rejections:', rejections)

  await generateArtifacts(runId, collected.size, listCallsUsed, detailCallsUsed)
}

// ─── Statistics ─────────────────────────────────────────────────────────────

function mean(xs: number[]) {
  return xs.reduce((a, b) => a + b, 0) / (xs.length || 1)
}
function stdev(xs: number[]) {
  const m = mean(xs)
  return Math.sqrt(mean(xs.map(x => (x - m) ** 2)))
}
function percentile(xs: number[], p: number) {
  const sorted = [...xs].sort((a, b) => a - b)
  const idx = (p / 100) * (sorted.length - 1)
  const lo = Math.floor(idx), hi = Math.ceil(idx)
  if (lo === hi) return sorted[lo]
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
}
function summarize(xs: number[]) {
  return {
    mean: +mean(xs).toFixed(2),
    median: +percentile(xs, 50).toFixed(2),
    p25: +percentile(xs, 25).toFixed(2),
    p75: +percentile(xs, 75).toFixed(2),
    stdev: +stdev(xs).toFixed(2),
  }
}

// Current hardcoded guess this POC is being compared against — a manual
// snapshot of components/RadarChartComponent.tsx's RANK_BENCHMARKS.Diamond
// (the broad-tier bucket; there is no existing per-division number to compare against).
const CURRENT_HARDCODED_DIAMOND_GUESS = {
  shotAccuracy: 33, savesPerGame: 1.6, avgBoost: 56, supersonicPct: 15, neutralPct: 33, shotsPerGame: 2.5,
}

async function generateArtifacts(runId: string, sampleSize: number, listCalls: number, detailCalls: number) {
  const { data, error } = await supabase
    .from('benchmark_player_observations')
    .select('*')
    .eq('playlist', PLAYLIST)
    .eq('rank_label', RANK_LABEL)

  if (error) throw new Error(`Failed to read observations: ${error.message}`)
  const rows = data ?? []

  const metricColumns: Record<string, string> = {
    shotAccuracy: 'shot_accuracy',
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

  const uniqueReplays = new Set(rows.flatMap(r => r.replay_ids as string[])).size

  const artifact = {
    generatedAt: new Date().toISOString(),
    playlist: PLAYLIST,
    proofOfConcept: true,
    metricVersion: 1,
    benchmarks: {
      [RANK_LABEL]: {
        sampleSize,
        uniquePlayers: rows.length,
        uniqueReplays,
        gamesPerPlayer: GAMES_PER_PLAYER_CAP,
        dataWindow: { note: 'replay-date desc, most recent available at collection time' },
        metrics,
        collection: { listCallsUsed: listCalls, detailCallsUsed: detailCalls, rejections },
      },
    },
  }

  const genDir = path.resolve(__dirname, '..', 'data', 'generated')
  mkdirSync(genDir, { recursive: true })
  writeFileSync(path.join(genDir, 'rank-benchmarks.json'), JSON.stringify(artifact, null, 2))

  // Flag suspicious rows: all-zero core stats (likely AFK/left early) or
  // any metric far outside the sample's own distribution.
  const suspicious: string[] = []
  for (const r of rows) {
    if (Number(r.goals_per_game) === 0 && Number(r.shots_per_game) === 0 && Number(r.saves_per_game) === 0) {
      suspicious.push(`${r.platform}:${r.player_id} — all-zero core stats (possible AFK/early leave)`)
    }
  }
  for (const [metricName, column] of Object.entries(metricColumns)) {
    const stat = metrics[metricName]
    for (const r of rows) {
      const v = Number(r[column])
      if (Number.isFinite(v) && stat.stdev > 0 && Math.abs(v - stat.mean) > 4 * stat.stdev) {
        suspicious.push(`${r.platform}:${r.player_id} — ${metricName}=${v} is >4 stdev from mean (${stat.mean})`)
      }
    }
  }

  const reportLines: string[] = []
  reportLines.push(`# Diamond II benchmark — candidate review (${new Date().toISOString()})`)
  reportLines.push('')
  reportLines.push(`Proof of concept run. Playlist: ${PLAYLIST}. Rank: ${RANK_LABEL}.`)
  reportLines.push('')
  reportLines.push('## Collection summary')
  reportLines.push(`- Unique players collected: ${sampleSize}`)
  reportLines.push(`- Unique replays used: ${uniqueReplays}`)
  reportLines.push(`- List calls used: ${listCalls}`)
  reportLines.push(`- Detail calls used: ${detailCalls}`)
  reportLines.push('')
  reportLines.push('## Rejections')
  for (const [reason, count] of Object.entries(rejections)) {
    reportLines.push(`- ${reason}: ${count}`)
  }
  reportLines.push('')
  reportLines.push('## Old (hardcoded guess) vs new (measured) — radar-relevant metrics')
  reportLines.push('')
  reportLines.push('| Metric | Old guess (broad Diamond) | New mean (diamond-2) | New median | p25 | p75 | stdev | Diff vs old |')
  reportLines.push('|---|---|---|---|---|---|---|---|')
  for (const [metricName, oldValue] of Object.entries(CURRENT_HARDCODED_DIAMOND_GUESS)) {
    const stat = metrics[metricName]
    const diff = stat ? (stat.mean - oldValue).toFixed(2) : 'n/a'
    reportLines.push(
      `| ${metricName} | ${oldValue} | ${stat?.mean ?? 'n/a'} | ${stat?.median ?? 'n/a'} | ${stat?.p25 ?? 'n/a'} | ${stat?.p75 ?? 'n/a'} | ${stat?.stdev ?? 'n/a'} | ${diff} |`
    )
  }
  reportLines.push('')
  reportLines.push('## Suspicious observations')
  if (suspicious.length === 0) {
    reportLines.push('None flagged.')
  } else {
    for (const s of suspicious) reportLines.push(`- ${s}`)
  }
  reportLines.push('')
  reportLines.push(`Full metric distributions (including non-radar fields) are in \`rank-benchmarks.json\` under \`benchmarks.${RANK_LABEL}.metrics\`.`)

  writeFileSync(path.join(genDir, 'rank-benchmarks.review.md'), reportLines.join('\n'))

  console.log(`\nWrote data/generated/rank-benchmarks.json and rank-benchmarks.review.md`)
}

main().catch(async err => {
  console.error('Collection failed:', err)
  process.exit(1)
})
