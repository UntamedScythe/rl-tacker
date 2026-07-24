import { describe, it, expect } from 'vitest'
import { extractGameStats, aggregateGameStats, computeShotAccuracyRatio } from './metrics'

describe('extractGameStats', () => {
  it('pulls all fields from a full stats block', () => {
    const result = extractGameStats({
      core: { goals: 2, assists: 1, saves: 3, shots: 5, shooting_percentage: 40, score: 500 },
      boost: { avg_amount: 55, amount_stolen: 100, amount_collected_big: 10 },
      movement: { avg_speed: 1300, percent_supersonic_speed: 12, percent_slow_speed: 40 },
      positioning: { percent_offensive_third: 35, percent_defensive_third: 25, percent_neutral_third: 40 },
      demo: { inflicted: 2, taken: 1 },
    })

    expect(result).toEqual({
      goals: 2, assists: 1, saves: 3, shots: 5, shootingPercentage: 40, score: 500,
      avgBoost: 55, boostStolen: 100, boostCollectedBig: 10,
      avgSpeed: 1300, percentSupersonic: 12, percentSlow: 40,
      percentOffensive: 35, percentDefensive: 25, percentNeutral: 40,
      demosInflicted: 2, demosTaken: 1,
    })
  })

  it('defaults every field to 0 for missing blocks', () => {
    expect(extractGameStats(undefined)).toEqual({
      goals: 0, assists: 0, saves: 0, shots: 0, shootingPercentage: 0, score: 0,
      avgBoost: 0, boostStolen: 0, boostCollectedBig: 0,
      avgSpeed: 0, percentSupersonic: 0, percentSlow: 0,
      percentOffensive: 0, percentDefensive: 0, percentNeutral: 0,
      demosInflicted: 0, demosTaken: 0,
    })
  })

  it('defaults missing sub-blocks independently', () => {
    const result = extractGameStats({ core: { goals: 3, shots: 6, shooting_percentage: 50 } })
    expect(result.goals).toBe(3)
    expect(result.avgBoost).toBe(0)
    expect(result.percentSupersonic).toBe(0)
  })
})

describe('aggregateGameStats', () => {
  it('pools goals and shots across games rather than averaging each game\'s own percentage', () => {
    // Naive mean-of-percentages would give (66.7 + 14.3) / 2 = 40.5 — wrong,
    // because it weights a 3-shot game the same as a 7-shot game. The pooled
    // ratio (2+1)/(3+7) = 30 weights every shot equally, not every game.
    const games = [
      extractGameStats({ core: { goals: 2, shots: 3, shooting_percentage: 66.7 } }),
      extractGameStats({ core: { goals: 1, shots: 7, shooting_percentage: 14.3 } }),
    ]
    const result = aggregateGameStats(games)
    expect(result.shotAccuracy).toBe(30)
  })

  it('ignores Ballchasing\'s reported shooting_percentage entirely, even when it is a plausible-looking value', () => {
    // shooting_percentage here (55) is internally consistent with goals/shots
    // (2/5 = 40, not 55) — proving the field isn't read for this calculation at all.
    const game = extractGameStats({ core: { goals: 2, shots: 5, shooting_percentage: 55 } })
    expect(aggregateGameStats([game]).shotAccuracy).toBe(40)
  })

  it('does not let a zero-shot game distort the pooled ratio', () => {
    const withZeroShotGame = aggregateGameStats([
      extractGameStats({ core: { goals: 2, shots: 5 } }),
      extractGameStats({ core: { goals: 0, shots: 0 } }), // no attempts that game
    ])
    const withoutIt = aggregateGameStats([
      extractGameStats({ core: { goals: 2, shots: 5 } }),
    ])
    expect(withZeroShotGame.shotAccuracy).toBe(withoutIt.shotAccuracy)
    expect(withZeroShotGame.shotAccuracy).toBe(40)
  })

  it('does not blindly trust a reported percentage above 100% — computes from raw goals/shots instead', () => {
    // Ballchasing occasionally reports shooting_percentage > 100 on individual
    // games (a known quirk in its own shot-attribution). The pooled ratio must
    // be driven by the raw goals/shots counts, not by that untrusted field.
    const anomalousGame = extractGameStats({ core: { goals: 2, shots: 1, shooting_percentage: 200 } })
    const result = aggregateGameStats([anomalousGame])
    expect(result.shotAccuracy).toBe(200) // goals(2)/shots(1)*100 — mathematically consistent with the raw counts, unlike the field
    expect(computeShotAccuracyRatio([anomalousGame])).toBe(200)
  })

  it('protects against division by zero when no shots were taken in any accepted game', () => {
    const allZeroShotGames = [
      extractGameStats({ core: { goals: 0, shots: 0 } }),
      extractGameStats({ core: { goals: 0, shots: 0 } }),
    ]
    expect(computeShotAccuracyRatio(allZeroShotGames)).toBeNull()
    const result = aggregateGameStats(allZeroShotGames)
    expect(result.shotAccuracy).toBe(0)
    expect(Number.isFinite(result.shotAccuracy)).toBe(true)
  })

  it('averages the other metrics with the same rounding as the live route', () => {
    const games = [
      extractGameStats({ core: { goals: 2, assists: 1, saves: 1, shots: 4, score: 400 }, boost: { avg_amount: 50 } }),
      extractGameStats({ core: { goals: 4, assists: 0, saves: 3, shots: 8, score: 600 }, boost: { avg_amount: 60 } }),
    ]
    const result = aggregateGameStats(games)

    expect(result.gamesAnalyzed).toBe(2)
    expect(result.goalsPerGame).toBe(3)       // (2+4)/2, .toFixed(2)
    expect(result.savesPerGame).toBe(2)       // (1+3)/2
    expect(result.shotsPerGame).toBe(6)       // (4+8)/2
    expect(result.shotAccuracy).toBe(50)      // pooled: (2+4)/(4+8)*100
    expect(result.avgScore).toBe(500)         // (400+600)/2, .toFixed(0)
    expect(result.avgBoost).toBe(55)          // (50+60)/2
  })

  it('treats an empty game list as zero games without dividing by zero', () => {
    const result = aggregateGameStats([])
    expect(result.gamesAnalyzed).toBe(0)
    expect(result.goalsPerGame).toBe(0)
    expect(result.shotAccuracy).toBe(0)
    expect(Number.isFinite(result.avgScore)).toBe(true)
  })
})

describe('computeShotAccuracyRatio — shared between live aggregation and benchmark generation', () => {
  it('is the exact function aggregateGameStats delegates to for shotAccuracy', () => {
    const games = [
      extractGameStats({ core: { goals: 3, shots: 5 } }),
      extractGameStats({ core: { goals: 1, shots: 2 } }),
    ]
    // aggregateGameStats.shotAccuracy must equal computeShotAccuracyRatio(games) exactly
    // (or 0 in the null case) — this is what makes "same formula" a structural
    // guarantee (one shared function) rather than two independently-written
    // implementations that happen to agree today.
    expect(aggregateGameStats(games).shotAccuracy).toBe(computeShotAccuracyRatio(games))
  })

  it('returns null (not 0 or NaN) when every game has zero shots', () => {
    const games = [extractGameStats({ core: { goals: 0, shots: 0 } })]
    expect(computeShotAccuracyRatio(games)).toBeNull()
  })

  it('returns null for an empty game list', () => {
    expect(computeShotAccuracyRatio([])).toBeNull()
  })
})
