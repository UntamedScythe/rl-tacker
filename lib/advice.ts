export type Teammate = {
  name: string
  id: string
  platform: string
  count: number
}

export type Stats = {
  gamesAnalyzed: number
  goalsPerGame: number
  assistsPerGame: number
  savesPerGame: number
  shotsPerGame: number
  shotAccuracy: number
  avgScore: number
  avgBoost: number
  boostStolenPerGame: number
  bigPadsPerGame: number
  avgSpeed: number
  supersonicPct: number
  slowPct: number
  offensivePct: number
  defensivePct: number
  neutralPct: number
  demosInflictedPerGame: number
  demosTakenPerGame: number
  topTeammates?: Teammate[]
  playerName?: string
}

export type Tip = {
  category: 'Boost' | 'Positioning' | 'Shooting' | 'Defense' | 'Speed' | 'General'
  severity: 'critical' | 'warning' | 'good'
  title: string
  detail: string
}

// Benchmarks loosely based on Diamond/Champ average play
const BENCHMARKS = {
  avgBoost: { low: 45, good: 60 },
  shotAccuracy: { low: 25, good: 40 },
  savesPerGame: { low: 0.8, good: 2.0 },
  supersonicPct: { low: 10, good: 20 },
  slowPct: { high: 40 }, // high slow% is bad
  offensivePct: { high: 45 }, // too much time attacking = ball chasing
  defensivePct: { low: 20 }, // too little defensive presence
  boostStolenPerGame: { good: 100 },
}

export function generateAdvice(stats: Stats): Tip[] {
  const tips: Tip[] = []

  // --- Boost management ---
  if (stats.avgBoost < BENCHMARKS.avgBoost.low) {
    tips.push({
      category: 'Boost',
      severity: 'critical',
      title: 'Boost starvation',
      detail: `Your average boost is ${stats.avgBoost} — well below the healthy range of 60+. You're likely spending too much time empty. Prioritize small pad collection and avoid boost-heavy aerial attempts when low.`,
    })
  } else if (stats.avgBoost < BENCHMARKS.avgBoost.good) {
    tips.push({
      category: 'Boost',
      severity: 'warning',
      title: 'Boost management needs work',
      detail: `Avg boost of ${stats.avgBoost} is okay but could be better. Focus on small pad pickups along your natural rotation path so you're never caught empty.`,
    })
  } else {
    tips.push({
      category: 'Boost',
      severity: 'good',
      title: 'Solid boost management',
      detail: `Avg boost of ${stats.avgBoost} — you're keeping your tank healthy. Keep it up.`,
    })
  }

  // --- Shot accuracy ---
  if (stats.shotAccuracy < BENCHMARKS.shotAccuracy.low) {
    tips.push({
      category: 'Shooting',
      severity: 'critical',
      title: 'Shot accuracy is low',
      detail: `${stats.shotAccuracy}% shot accuracy means most of your shots aren't threatening. Take fewer, higher-quality shots — only shoot when you have a real angle. Random shots from distance give the goalie free clears.`,
    })
  } else if (stats.shotAccuracy < BENCHMARKS.shotAccuracy.good) {
    tips.push({
      category: 'Shooting',
      severity: 'warning',
      title: 'Room to improve shot quality',
      detail: `${stats.shotAccuracy}% is passable. Work on reading the ball earlier so you can set up proper shooting positions rather than awkward redirects.`,
    })
  } else {
    tips.push({
      category: 'Shooting',
      severity: 'good',
      title: 'Great shot accuracy',
      detail: `${stats.shotAccuracy}% — your shots are a genuine threat. Keep making the keeper work.`,
    })
  }

  // --- Positioning (ball chasing) ---
  if (stats.offensivePct > BENCHMARKS.offensivePct.high) {
    tips.push({
      category: 'Positioning',
      severity: 'critical',
      title: 'Spending too much time attacking',
      detail: `${stats.offensivePct}% of your time in the offensive third suggests ball chasing. Trust your teammates and rotate back — being out of position leaves your team exposed on counters.`,
    })
  }

  if (stats.defensivePct < BENCHMARKS.defensivePct.low) {
    tips.push({
      category: 'Defense',
      severity: 'warning',
      title: 'Low defensive presence',
      detail: `Only ${stats.defensivePct}% of time in your defensive third. Make sure you're rotating back properly and not leaving your net unguarded.`,
    })
  }

  // --- Speed ---
  if (stats.slowPct > BENCHMARKS.slowPct.high) {
    tips.push({
      category: 'Speed',
      severity: 'warning',
      title: 'Moving too slowly',
      detail: `${stats.slowPct}% of the game at slow speed is high. Use your boost to stay at speed during rotations — slow movement makes you late to challenges and gives opponents easy reads.`,
    })
  }

  if (stats.supersonicPct < BENCHMARKS.supersonicPct.low) {
    tips.push({
      category: 'Speed',
      severity: 'warning',
      title: 'Rarely hitting top speed',
      detail: `Only ${stats.supersonicPct}% supersonic time. Practice wave-dashing and boost-efficient routes so you can get across the pitch faster when needed.`,
    })
  }

  // --- Saves ---
  if (stats.savesPerGame < BENCHMARKS.savesPerGame.low) {
    tips.push({
      category: 'Defense',
      severity: 'warning',
      title: 'Few saves recorded',
      detail: `${stats.savesPerGame} saves/game is low. This could mean great positioning (opponents aren't getting shots through) or that you're out of position when they do. Cross-check with your defensive third %.`,
    })
  }

  return tips
}
