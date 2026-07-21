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
  playerRank?: { tier?: number; division?: number; name?: string }
}

export type Tip = {
  category: 'Boost' | 'Positioning' | 'Shooting' | 'Defense' | 'Speed' | 'General'
  severity: 'critical' | 'warning' | 'good'
  title: string
  observation: string   // what the coach sees in the data
  evidence: string      // the specific stat that supports it
  drill: string         // what to practice tonight
}

// Benchmarks — loose Diamond/low Champ averages
const B = {
  avgBoost:      { low: 45, good: 60 },
  shotAccuracy:  { low: 28, good: 42 },
  savesPerGame:  { low: 0.8, good: 2.0 },
  supersonicPct: { low: 10, good: 20 },
  slowPct:       { high: 38 },
  offensivePct:  { high: 44 },
  defensivePct:  { low: 20 },
}

export function generateAdvice(stats: Stats): Tip[] {
  const tips: Tip[] = []

  // ── Boost ──────────────────────────────────────────────────────────────────
  if (stats.avgBoost < B.avgBoost.low) {
    tips.push({
      category: 'Boost',
      severity: 'critical',
      title: 'You\'re running on empty',
      observation: 'You\'re consistently going into challenges with near-zero boost. This isn\'t a mechanical issue — it\'s a routing habit. You\'re spending boost to chase rather than collecting it on the way.',
      evidence: `Avg boost: ${stats.avgBoost} (healthy range: 60+)`,
      drill: 'In your next 5 games, make a rule: never contest a 50/50 with under 30 boost. Use free play to practice collecting small pads along your natural rotation paths.',
    })
  } else if (stats.avgBoost < B.avgBoost.good) {
    tips.push({
      category: 'Boost',
      severity: 'warning',
      title: 'Boost routes need tightening',
      observation: 'Your boost average is acceptable but there\'s consistent leakage. You\'re probably boosting through pads instead of over them, or cutting rotation short to grab a big pad.',
      evidence: `Avg boost: ${stats.avgBoost} (target: 60+)`,
      drill: 'Watch one of your replays with boost display on. Count how many small pads you drive past. Your goal is to grab every pad within 2 car lengths of your path.',
    })
  } else {
    tips.push({
      category: 'Boost',
      severity: 'good',
      title: 'Boost management is a strength',
      observation: 'You\'re keeping your tank healthy throughout games. This gives you options — the ability to make plays when your teammates can\'t.',
      evidence: `Avg boost: ${stats.avgBoost}`,
      drill: 'Now that your boost is reliable, focus on boost denial. Stealing big pads from opponents is worth double — you gain boost and they don\'t.',
    })
  }

  // ── Shooting ───────────────────────────────────────────────────────────────
  if (stats.shotAccuracy < B.shotAccuracy.low) {
    tips.push({
      category: 'Shooting',
      severity: 'critical',
      title: 'You\'re shooting from bad positions',
      observation: 'Low shot accuracy isn\'t always a mechanics problem — it\'s usually a decision problem. You\'re shooting when the angle isn\'t there, giving the keeper easy reads.',
      evidence: `Shot accuracy: ${stats.shotAccuracy}% (${stats.shotsPerGame} shots/game)`,
      drill: 'For two games, only shoot if you\'re inside the opponent\'s third and have a clear angle. Fewer shots with better positioning will raise your accuracy and your goal rate simultaneously.',
    })
  } else if (stats.shotAccuracy < B.shotAccuracy.good) {
    tips.push({
      category: 'Shooting',
      severity: 'warning',
      title: 'Passing up better shots',
      observation: 'Your accuracy is passable but you\'re settling for difficult angles when a reset or square pass would create something cleaner.',
      evidence: `Shot accuracy: ${stats.shotAccuracy}%`,
      drill: 'Practice redirects in training. When you have the ball in the corner, your first thought should be "can I set up a teammate" before "can I score from here."',
    })
  } else {
    tips.push({
      category: 'Shooting',
      severity: 'good',
      title: 'Your shots are a genuine threat',
      observation: 'You\'re picking your moments well. Keepers have to respect your shots, which opens up passing lanes for your teammates.',
      evidence: `Shot accuracy: ${stats.shotAccuracy}%`,
      drill: 'Use this as leverage. When you notice the keeper playing up, fake the shot and square it. Your accuracy makes that threat real.',
    })
  }

  // ── Positioning ────────────────────────────────────────────────────────────
  if (stats.offensivePct > B.offensivePct.high) {
    tips.push({
      category: 'Positioning',
      severity: 'critical',
      title: 'You\'re ball chasing in disguise',
      observation: `You spend ${stats.offensivePct.toFixed(0)}% of the game in the offensive third. That number should be closer to 30-35%. The extra time you\'re spending up field isn\'t creating — it\'s leaving your team exposed on every turnover.`,
      evidence: `Offensive third: ${stats.offensivePct.toFixed(1)}% (target: ~33%)`,
      drill: 'After every shot attempt, rotate back immediately — even if it looks like your teammate might score. Build the habit first. You can adjust the timing later.',
    })
  }

  if (stats.defensivePct < B.defensivePct.low) {
    tips.push({
      category: 'Defense',
      severity: 'warning',
      title: 'Your net is unguarded too often',
      observation: `Only ${stats.defensivePct.toFixed(0)}% of your time is in the defensive third. Someone needs to be last man — and the data suggests it\'s rarely you.`,
      evidence: `Defensive third: ${stats.defensivePct.toFixed(1)}% (target: 20%+)`,
      drill: 'When your second teammate goes up for the ball, make a conscious decision to hold the backpost. You don\'t have to sit in goal — just be recoverable.',
    })
  }

  // ── Speed ──────────────────────────────────────────────────────────────────
  if (stats.slowPct > B.slowPct.high) {
    tips.push({
      category: 'Speed',
      severity: 'warning',
      title: 'You\'re giving opponents time to read you',
      observation: `${stats.slowPct.toFixed(0)}% of your time at slow speed is too high. Slow movement telegraphs your intentions and lets opponents pre-position against you.`,
      evidence: `Slow speed %: ${stats.slowPct.toFixed(1)}% (target: under 38%)`,
      drill: 'Practice wave dashing from a standstill. Moving quickly between positions — even without the ball — forces opponents to react instead of predict.',
    })
  }

  if (stats.supersonicPct < B.supersonicPct.low) {
    tips.push({
      category: 'Speed',
      severity: 'warning',
      title: 'You\'re arriving late to your own plays',
      observation: 'Low supersonic time means you\'re consistently a half-second behind where you need to be. At higher ranks, that half second is the difference between first touch and second.',
      evidence: `Supersonic %: ${stats.supersonicPct.toFixed(1)}% (target: 10%+)`,
      drill: 'On kickoff rotations, boost hard to your position rather than coasting. Arrive fast, then decide — not the other way around.',
    })
  }

  // ── Saves ──────────────────────────────────────────────────────────────────
  if (stats.savesPerGame < B.savesPerGame.low) {
    tips.push({
      category: 'Defense',
      severity: 'warning',
      title: 'Not enough defensive presence',
      observation: `${stats.savesPerGame.toFixed(1)} saves per game is low. Either the ball isn\'t reaching your net — which is good — or you\'re not there when it does.`,
      evidence: `Saves/game: ${stats.savesPerGame.toFixed(1)} (healthy: 0.8+)`,
      drill: 'Check your replay: when your team gives up goals, where are you? If you\'re in the offensive third, the positioning issue is creating the save deficit.',
    })
  } else if (stats.savesPerGame >= B.savesPerGame.good) {
    tips.push({
      category: 'Defense',
      severity: 'good',
      title: 'Reliable last line of defense',
      observation: 'You\'re making saves when they matter. Your team can push knowing someone is covering.',
      evidence: `Saves/game: ${stats.savesPerGame.toFixed(1)}`,
      drill: 'Now focus on save quality. A save that clears to the corner is better than one that bounces to an opponent. Practice directing saves to your strong side.',
    })
  }

  return tips
}

// ── Practice summary ─────────────────────────────────────────────────────────
// Extracts the single most important drill from a tip list

export function getPracticeTonight(tips: Tip[]): { title: string; drill: string } | null {
  const critical = tips.find(t => t.severity === 'critical')
  const warning  = tips.find(t => t.severity === 'warning')
  const tip = critical ?? warning
  if (!tip) return null
  return { title: tip.title, drill: tip.drill }
}
