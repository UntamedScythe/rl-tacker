# Diamond II benchmark — 3-5 game candidate review, corrected (2026-07-24T05:35:24.076Z)

Playlist: ranked-doubles. Rank: diamond-2. Regenerated from current database rows after correcting two issues found in the prior report:
1. A null "no valid data" value for one player was being coerced to a fake 0% instead of excluded (`Number(null) === 0` in JS).
2. The two shot-accuracy methods weren't treated symmetrically — the pooled ratio method still used raw goals/shots from games whose reported shooting_percentage was >100%, while the mean-of-reported-% method excluded those same games. Both methods now fully exclude anomalous games (all metrics, not just shooting), with a replacement game backfilled where available.

## Sample
- Players in final sample: 199
- Unique replays used: 338

## Games-per-player histogram
| Games completed | Player count |
|---|---|
| 1 | 80 |
| 2 | 38 |
| 3 | 23 |
| 4 | 15 |
| 5 | 43 |

## Game-quality tallies
- Zero-shot games (no shot attempts that game): 11
- Zero-goal-with-shots games (took shots, scored none): 117
- Shooting-percentage anomalies (>100%) excluded from BOTH methods: 3

## Shot accuracy: two methods, compared (now symmetric)

| Method | Mean | Median | p25 | p75 | stdev | Missing data (players) |
|---|---|---|---|---|---|---|
| Pooled ratio (total goals / total shots across a player's eligible games) | 40.32 | 42.5 | 25 | 52.25 | 25.38 | 3 |
| Mean of Ballchasing's reported per-game shooting_percentage | 39.06 | 40 | 22.3 | 52 | 25.9 | 0 |

**Recommendation: use the pooled ratio (total goals / total shots).** This is a recommendation on statistical
principle, not just on which stdev happens to be lower in one sample: averaging per-game percentages gives a
game with 1 shot the same weight as a game with 10 shots (the classic "average of rates" mistake), while the
pooled ratio weights every shot equally regardless of which game it happened in. In this corrected dataset,
the pooled ratio's stdev is 25.38 versus 25.9 for mean-of-percentages — the pooled ratio is now also the tighter distribution, consistent with the theoretical expectation.

## Three-way comparison — radar-relevant metrics

| Metric | Original hardcoded guess | 1-game POC mean | 3-5 game mean (corrected) | 3-5 game median |
|---|---|---|---|---|
| shotAccuracy | 33 | 38.6 | 40.32 | 42.5 |
| savesPerGame | 1.6 | 1.5 | 1.5 | 1.33 |
| avgBoost | 56 | 51.12 | 50.92 | 51 |
| supersonicPct | 15 | 10.98 | 10.69 | 10.3 |
| neutralPct | 33 | 30.19 | 30.11 | 29.8 |
| shotsPerGame | 2.5 | 3.42 | 3.42 | 3.4 |

## Suspicious observations
- epic:cee6c09125f64d6f9741787022b6737a — savesPerGame=6 is >4 stdev from mean (1.5)
- epic:d98335ed6c254ccdbf0d81802f77cbc6 — neutralPct=48.4 is >4 stdev from mean (30.11)
- epic:f092ac8dd9724fb5a85b3981c867a6da — goalsPerGame=6 is >4 stdev from mean (1.38)
- xbox:588e777777370900 — assistsPerGame=3 is >4 stdev from mean (0.56)

Full metric distributions are in `rank-benchmarks.json` under `benchmarks.diamond-2.metrics`.
The 1-game POC snapshot is preserved at `rank-benchmarks.poc-1game.json` / `rank-benchmarks.review.poc-1game.md`.