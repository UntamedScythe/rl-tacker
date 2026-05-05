import { NextRequest, NextResponse } from 'next/server'

const BALLCHASING_BASE = 'https://ballchasing.com/api'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const playerId = searchParams.get('playerId')
  const platform = searchParams.get('platform') ?? 'steam'

  if (!playerId) {
    return NextResponse.json({ error: 'playerId is required' }, { status: 400 })
  }

  const apiKey = process.env.BALLCHASING_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
  }

  try {
    const replaysRes = await fetch(
      `${BALLCHASING_BASE}/replays?player-id=${encodeURIComponent(`${platform}:${playerId}`)}&count=20&sort-by=replay-date&sort-dir=desc`,
      { headers: { Authorization: apiKey } }
    )

    if (!replaysRes.ok) {
      const err = await replaysRes.json()
      return NextResponse.json(
        { error: err.error ?? 'Ballchasing API error' },
        { status: replaysRes.status }
      )
    }

    const replaysData = await replaysRes.json()
    const replays = replaysData.list ?? []

    if (replays.length === 0) {
      return NextResponse.json(
        { error: 'No replays found. Make sure you have public replays on ballchasing.com.' },
        { status: 404 }
      )
    }

    // Fetch full replay details in parallel (list endpoint doesn't include stats)
    const detailedReplays = await Promise.all(
      replays.map((r: { id: string }) =>
        fetch(`${BALLCHASING_BASE}/replays/${r.id}`, {
          headers: { Authorization: apiKey },
        }).then(res => res.json())
      )
    )

    const stats = aggregateStats(detailedReplays, `${platform}:${playerId}`)
    return NextResponse.json({ stats, replayCount: detailedReplays.length })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}

type Replay = {
  blue?: { players?: Player[] }
  orange?: { players?: Player[] }
}

type Player = {
  id?: { id?: string }
  stats?: {
    core?: { score?: number; goals?: number; assists?: number; saves?: number; shots?: number }
    boost?: { avg_amount?: number; amount_stolen?: number; amount_collected_big?: number }
    movement?: { avg_speed?: number; percent_supersonic_speed?: number; percent_slow_speed?: number }
    positioning?: { percent_offensive_third?: number; percent_defensive_third?: number; percent_neutral_third?: number }
    demo?: { inflicted?: number; taken?: number }
  }
}

function aggregateStats(replays: Replay[], playerId: string) {
  const totals = {
    goals: 0, assists: 0, saves: 0, shots: 0, score: 0,
    avgBoost: 0, boostStolen: 0, bigPads: 0,
    avgSpeed: 0, supersonicPct: 0, slowPct: 0,
    offensivePct: 0, defensivePct: 0, neutralPct: 0,
    demosInflicted: 0, demosTaken: 0, count: 0,
  }

  for (const replay of replays) {
    const allPlayers = [
      ...(replay.blue?.players ?? []),
      ...(replay.orange?.players ?? []),
    ]
    const me = allPlayers.find(p => p.id?.id === playerId.split(':')[1])
    if (!me) continue

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
  return {
    gamesAnalyzed:         totals.count,
    goalsPerGame:          +(totals.goals / n).toFixed(2),
    assistsPerGame:        +(totals.assists / n).toFixed(2),
    savesPerGame:          +(totals.saves / n).toFixed(2),
    shotsPerGame:          +(totals.shots / n).toFixed(2),
    shotAccuracy:          totals.shots > 0 ? +((totals.goals / totals.shots) * 100).toFixed(1) : 0,
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
  }
}
