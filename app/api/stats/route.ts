import { NextRequest, NextResponse } from 'next/server'

const BALLCHASING_BASE = 'https://ballchasing.com/api'
const TIMEOUT_MS = 10000

async function fetchWithTimeout(url: string, options: RequestInit, ms = TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function fetchJSON(url: string, apiKey: string, retries = 2): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetchWithTimeout(url, { headers: { Authorization: apiKey } })
      const text = await res.text()

      let data: Record<string, unknown>
      try {
        data = JSON.parse(text)
      } catch {
        console.error('Non-JSON from Ballchasing:', text.slice(0, 100))
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 2000 * (attempt + 1)))
          continue
        }
        return { ok: false, status: res.status, data: { error: 'Unexpected response from Ballchasing' } }
      }

      // Rate limited — wait and retry
      if (res.status === 429 || data?.error?.toString().toLowerCase().includes('rate')) {
        console.log(`Rate limited on attempt ${attempt + 1}, waiting...`)
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 3000 * (attempt + 1)))
          continue
        }
      }

      return { ok: res.ok, status: res.status, data }
    } catch (err) {
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 2000 * (attempt + 1)))
        continue
      }
      throw err
    }
  }
  return { ok: false, status: 500, data: { error: 'Max retries exceeded' } }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const playerId = searchParams.get('playerId')
  const platform = searchParams.get('platform') ?? 'steam'
  const playlist = searchParams.get('playlist') ?? ''

  if (!playerId) {
    return NextResponse.json({ error: 'playerId is required' }, { status: 400 })
  }

  const apiKey = process.env.BALLCHASING_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
  }

  try {
    // Fetch 10 replays instead of 20 to stay within rate limits
    const replaysResult = await fetchJSON(
      `${BALLCHASING_BASE}/replays?player-id=${encodeURIComponent(`${platform}:${playerId}`)}&count=10&sort-by=replay-date&sort-dir=desc${playlist ? `&playlist=${encodeURIComponent(playlist)}` : ''}`,
      apiKey
    )

    if (!replaysResult.ok) {
      return NextResponse.json(
        { error: replaysResult.data?.error ?? 'Ballchasing API error' },
        { status: replaysResult.status }
      )
    }

    const replays = (replaysResult.data?.list ?? []) as { id: string }[]

    if (replays.length === 0) {
      return NextResponse.json(
        { error: 'No replays found. Make sure you have public replays on ballchasing.com.' },
        { status: 404 }
      )
    }

    // Fetch one at a time with delay to avoid rate limiting
    const detailedReplays: Record<string, unknown>[] = []
    for (const replay of replays) {
      const result = await fetchJSON(`${BALLCHASING_BASE}/replays/${replay.id}`, apiKey)
      if (result.ok && result.data && !result.data.error) {
        detailedReplays.push(result.data)
      }
      // 800ms between each request — stays well within free tier limits
      await new Promise(r => setTimeout(r, 800))
    }

    if (detailedReplays.length === 0) {
      return NextResponse.json({ error: 'Could not load replay details. Try again in a moment.' }, { status: 500 })
    }

    const stats = aggregateStats(detailedReplays as Replay[], playerId)
    console.log(`Matched ${stats.gamesAnalyzed} of ${detailedReplays.length} replays for player ${playerId}`)
    return NextResponse.json({ stats, replayCount: stats.gamesAnalyzed })

  } catch (err) {
    const message = err instanceof Error && err.name === 'AbortError'
      ? 'Request timed out — Ballchasing is slow right now. Try again.'
      : 'Failed to fetch stats. Please try again.'
    console.error(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

type Player = {
  id?: { platform?: string; id?: string }
  name?: string
  stats?: {
    core?: { score?: number; goals?: number; assists?: number; saves?: number; shots?: number; shooting_percentage?: number }
    boost?: { avg_amount?: number; amount_stolen?: number; amount_collected_big?: number }
    movement?: { avg_speed?: number; percent_supersonic_speed?: number; percent_slow_speed?: number }
    positioning?: { percent_offensive_third?: number; percent_defensive_third?: number; percent_neutral_third?: number }
    demo?: { inflicted?: number; taken?: number }
  }
}

type Replay = {
  blue?: { players?: Player[] }
  orange?: { players?: Player[] }
}

function findMe(allPlayers: Player[], playerId: string): Player | undefined {
  return (
    allPlayers.find(p => p.id?.id === playerId) ??
    allPlayers.find(p => p.id?.id?.toLowerCase() === playerId.toLowerCase())
  )
}

function aggregateStats(replays: Replay[], playerId: string) {
  const totals = {
    goals: 0, assists: 0, saves: 0, shots: 0, score: 0,
    avgBoost: 0, boostStolen: 0, bigPads: 0,
    avgSpeed: 0, supersonicPct: 0, slowPct: 0,
    offensivePct: 0, defensivePct: 0, neutralPct: 0,
    demosInflicted: 0, demosTaken: 0, shootingPct: 0,
    count: 0,
  }

  const teammateMap: Record<string, { name: string; id: string; platform: string; count: number }> = {}
  let playerName: string | undefined

  for (const replay of replays) {
    if (!replay || typeof replay !== 'object') continue
    const blue = replay.blue?.players ?? []
    const orange = replay.orange?.players ?? []
    const allPlayers = [...blue, ...orange]

    const me = findMe(allPlayers, playerId)
    if (!me) continue

    if (!playerName && me.name) playerName = me.name

    const myTeam = blue.find(p => p.id?.id === me.id?.id) ? blue : orange
    for (const p of myTeam) {
      if (p.id?.id === me.id?.id) continue
      const tid = p.id?.id ?? p.name ?? 'unknown'
      if (!teammateMap[tid]) {
        teammateMap[tid] = { name: p.name ?? 'Unknown', id: p.id?.id ?? '', platform: p.id?.platform ?? '', count: 0 }
      }
      teammateMap[tid].count++
    }

    const c = me.stats?.core ?? {}
    const b = me.stats?.boost ?? {}
    const m = me.stats?.movement ?? {}
    const pos = me.stats?.positioning ?? {}
    const d = me.stats?.demo ?? {}

    totals.goals         += c.goals ?? 0
    totals.assists       += c.assists ?? 0
    totals.saves         += c.saves ?? 0
    totals.shots         += c.shots ?? 0
    totals.score         += c.score ?? 0
    totals.shootingPct   += c.shooting_percentage ?? 0
    totals.avgBoost      += b.avg_amount ?? 0
    totals.boostStolen   += b.amount_stolen ?? 0
    totals.bigPads       += b.amount_collected_big ?? 0
    totals.avgSpeed      += m.avg_speed ?? 0
    totals.supersonicPct += m.percent_supersonic_speed ?? 0
    totals.slowPct       += m.percent_slow_speed ?? 0
    totals.offensivePct  += pos.percent_offensive_third ?? 0
    totals.defensivePct  += pos.percent_defensive_third ?? 0
    totals.neutralPct    += pos.percent_neutral_third ?? 0
    totals.demosInflicted+= d.inflicted ?? 0
    totals.demosTaken    += d.taken ?? 0
    totals.count++
  }

  const n = totals.count || 1
  const topTeammates = Object.values(teammateMap)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  return {
    playerName,
    gamesAnalyzed:         totals.count,
    goalsPerGame:          +(totals.goals / n).toFixed(2),
    assistsPerGame:        +(totals.assists / n).toFixed(2),
    savesPerGame:          +(totals.saves / n).toFixed(2),
    shotsPerGame:          +(totals.shots / n).toFixed(2),
    shotAccuracy:          +(totals.shootingPct / n).toFixed(1),
    avgScore:              +(totals.score / n).toFixed(0),
    avgBoost:              +(totals.avgBoost / n).toFixed(1),
    boostStolenPerGame:    +(totals.boostStolen / n).toFixed(1),
    bigPadsPerGame:        +(totals.bigPads / n).toFixed(1),
    avgSpeed:              +(totals.avgSpeed / n).toFixed(1),
    supersonicPct:         +(totals.supersonicPct / n).toFixed(1),
    slowPct:               +(totals.slowPct / n).toFixed(1),
    offensivePct:          +(totals.offensivePct / n).toFixed(1),
    defensivePct:          +(totals.defensivePct / n).toFixed(1),
    neutralPct:            +(totals.neutralPct / n).toFixed(1),
    demosInflictedPerGame: +(totals.demosInflicted / n).toFixed(2),
    demosTakenPerGame:     +(totals.demosTaken / n).toFixed(2),
    topTeammates,
  }
}
