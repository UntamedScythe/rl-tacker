import { describe, it, expect } from 'vitest'
import { aggregateStats, type Replay } from '@/app/api/stats/route'
import { singleReplayToStats } from '@/app/page'
import type { PlayerStatsBlock } from '@/lib/metrics'

// Guards against the exact bug found while auditing the radar's rank benchmarks:
// the search flow (aggregateStats, used by the Player ID / Find by Name tabs) and
// the upload flow (singleReplayToStats, used by the Upload Replay tab) used to
// compute shotAccuracy with two different formulas. Both must now derive every
// metric from the same shared lib/metrics.ts functions, so feeding each flow the
// same underlying replay data must produce identical numbers.

const RAW_STATS: PlayerStatsBlock = {
  core: { goals: 3, assists: 2, saves: 1, shots: 7, shooting_percentage: 42.9, score: 611 },
  boost: { avg_amount: 58.4, amount_stolen: 120, amount_collected_big: 14 },
  movement: { avg_speed: 1387, percent_supersonic_speed: 15.2, percent_slow_speed: 36.8 },
  positioning: { percent_offensive_third: 33.1, percent_defensive_third: 28.4, percent_neutral_third: 38.5 },
  demo: { inflicted: 1, taken: 2 },
}

function buildSingleReplay(playerId: string): Replay {
  return {
    blue: {
      players: [
        { id: { platform: 'steam', id: playerId }, name: 'TestPlayer', rank: { tier: 14, division: 1, name: 'Diamond II' }, stats: RAW_STATS },
        { id: { platform: 'steam', id: 'teammate1' }, name: 'Teammate', stats: RAW_STATS },
      ],
    },
    orange: {
      players: [
        { id: { platform: 'steam', id: 'opp1' }, name: 'Opponent1', stats: RAW_STATS },
        { id: { platform: 'steam', id: 'opp2' }, name: 'Opponent2', stats: RAW_STATS },
      ],
    },
  }
}

describe('search flow vs upload flow metric consistency', () => {
  it('produces identical numeric Stats fields from equivalent single-replay data', () => {
    const searchFlowResult = aggregateStats([buildSingleReplay('me-123')], 'me-123')
    const uploadFlowResult = singleReplayToStats(RAW_STATS)

    const { playerName, playerRank, topTeammates, ...searchMetrics } = searchFlowResult
    void playerName; void playerRank; void topTeammates

    expect(uploadFlowResult).toEqual(searchMetrics)
  })

  it('specifically agrees on shotAccuracy, computed as the pooled goals/shots ratio', () => {
    const searchFlowResult = aggregateStats([buildSingleReplay('me-456')], 'me-456')
    const uploadFlowResult = singleReplayToStats(RAW_STATS)

    // goals(3)/shots(7)*100 = 42.857..., rounds to 42.9 — matches the fixture's
    // shooting_percentage (42.9) by coincidence here, not because that field is read.
    expect(uploadFlowResult.shotAccuracy).toBe(42.9)
    expect(searchFlowResult.shotAccuracy).toBe(42.9)
    expect(uploadFlowResult.shotAccuracy).toBe(searchFlowResult.shotAccuracy)
  })
})
