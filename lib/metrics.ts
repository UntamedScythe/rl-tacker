import type { Stats } from '@/lib/advice'

// Single source of truth for turning a Ballchasing player `stats` block into
// the app's metric fields. Used by the live search flow, the upload flow, and
// the rank-benchmark collector — all three must agree on what each field means.

export type PlayerStatsBlock = {
  core?: {
    score?: number
    goals?: number
    assists?: number
    saves?: number
    shots?: number
    shooting_percentage?: number
  }
  boost?: {
    avg_amount?: number
    amount_stolen?: number
    amount_collected_big?: number
  }
  movement?: {
    avg_speed?: number
    percent_supersonic_speed?: number
    percent_slow_speed?: number
  }
  positioning?: {
    percent_offensive_third?: number
    percent_defensive_third?: number
    percent_neutral_third?: number
  }
  demo?: {
    inflicted?: number
    taken?: number
  }
}

export type GameStats = {
  goals: number
  assists: number
  saves: number
  shots: number
  shootingPercentage: number
  score: number
  avgBoost: number
  boostStolen: number
  boostCollectedBig: number
  avgSpeed: number
  percentSupersonic: number
  percentSlow: number
  percentOffensive: number
  percentDefensive: number
  percentNeutral: number
  demosInflicted: number
  demosTaken: number
}

// Extract one game's worth of fields from a raw Ballchasing player.stats block.
export function extractGameStats(raw: PlayerStatsBlock | undefined | null): GameStats {
  const c = raw?.core ?? {}
  const b = raw?.boost ?? {}
  const m = raw?.movement ?? {}
  const pos = raw?.positioning ?? {}
  const d = raw?.demo ?? {}
  return {
    goals: c.goals ?? 0,
    assists: c.assists ?? 0,
    saves: c.saves ?? 0,
    shots: c.shots ?? 0,
    shootingPercentage: c.shooting_percentage ?? 0,
    score: c.score ?? 0,
    avgBoost: b.avg_amount ?? 0,
    boostStolen: b.amount_stolen ?? 0,
    boostCollectedBig: b.amount_collected_big ?? 0,
    avgSpeed: m.avg_speed ?? 0,
    percentSupersonic: m.percent_supersonic_speed ?? 0,
    percentSlow: m.percent_slow_speed ?? 0,
    percentOffensive: pos.percent_offensive_third ?? 0,
    percentDefensive: pos.percent_defensive_third ?? 0,
    percentNeutral: pos.percent_neutral_third ?? 0,
    demosInflicted: d.inflicted ?? 0,
    demosTaken: d.taken ?? 0,
  }
}

// Pooled ratio of total goals over total shots across every game — the
// statistically correct way to combine games with unequal shot counts, unlike
// averaging each game's own percentage (which weights a 1-shot game the same
// as a 10-shot game). Deliberately ignores Ballchasing's own per-game
// shooting_percentage field, which can itself report impossible values (over
// 100%) on individual games. Returns null when no shots were taken in any
// game, rather than dividing by zero — callers that need a plain number
// (aggregateGameStats) fall back to 0; callers that need to distinguish "no
// shot data" from "0% on real attempts" (the rank-benchmark scripts) can use
// the null directly. Exported so the live app and the benchmark generator
// call the exact same function rather than two copies of the same formula.
export function computeShotAccuracyRatio(games: GameStats[]): number | null {
  const totalGoals = games.reduce((acc, g) => acc + g.goals, 0)
  const totalShots = games.reduce((acc, g) => acc + g.shots, 0)
  return totalShots > 0 ? +((totalGoals / totalShots) * 100).toFixed(1) : null
}

// Average a list of per-game extracts into one Stats-shaped row. Same formula
// whether the list has 10 games (live multi-replay analysis), 1 game (upload
// flow), or 1-5 games (one benchmark player's contribution to a rank sample).
export function aggregateGameStats(
  games: GameStats[]
): Omit<Stats, 'playerName' | 'playerRank' | 'topTeammates'> {
  const n = games.length || 1
  const sum = (f: (g: GameStats) => number) => games.reduce((acc, g) => acc + f(g), 0)
  const round = (v: number, digits = 1) => +v.toFixed(digits)

  const totalGoals = sum(g => g.goals)
  const totalShots = sum(g => g.shots)
  const shotAccuracy = computeShotAccuracyRatio(games) ?? 0

  return {
    gamesAnalyzed: games.length,
    goalsPerGame: round(totalGoals / n, 2),
    assistsPerGame: round(sum(g => g.assists) / n, 2),
    savesPerGame: round(sum(g => g.saves) / n, 2),
    shotsPerGame: round(totalShots / n, 2),
    shotAccuracy,
    avgScore: round(sum(g => g.score) / n, 0),
    avgBoost: round(sum(g => g.avgBoost) / n, 1),
    boostStolenPerGame: round(sum(g => g.boostStolen) / n, 1),
    bigPadsPerGame: round(sum(g => g.boostCollectedBig) / n, 1),
    avgSpeed: round(sum(g => g.avgSpeed) / n, 1),
    supersonicPct: round(sum(g => g.percentSupersonic) / n, 1),
    slowPct: round(sum(g => g.percentSlow) / n, 1),
    offensivePct: round(sum(g => g.percentOffensive) / n, 1),
    defensivePct: round(sum(g => g.percentDefensive) / n, 1),
    neutralPct: round(sum(g => g.percentNeutral) / n, 1),
    demosInflictedPerGame: round(sum(g => g.demosInflicted) / n, 2),
    demosTakenPerGame: round(sum(g => g.demosTaken) / n, 2),
  }
}
