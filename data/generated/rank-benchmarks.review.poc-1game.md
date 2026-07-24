# Diamond II benchmark — candidate review (2026-07-24T05:00:12.445Z)

Proof of concept run. Playlist: ranked-doubles. Rank: diamond-2.

## Collection summary
- Unique players collected: 200
- Unique replays used: 72
- List calls used: 12
- Detail calls used: 72

## Rejections
- missingOrMismatchedRank: 52
- duplicatePlayer: 36
- duplicateReplay: 0
- malformedStats: 0
- wrongPlaylistOrSeason: 0
- noNewCandidateInListPreview: 2002

## Old (hardcoded guess) vs new (measured) — radar-relevant metrics

| Metric | Old guess (broad Diamond) | New mean (diamond-2) | New median | p25 | p75 | stdev | Diff vs old |
|---|---|---|---|---|---|---|---|
| shotAccuracy | 33 | 38.6 | 33.3 | 0 | 50 | 35.36 | 5.60 |
| savesPerGame | 1.6 | 1.5 | 1 | 1 | 2 | 1.2 | -0.10 |
| avgBoost | 56 | 51.12 | 51.3 | 47.58 | 54.8 | 5.91 | -4.88 |
| supersonicPct | 15 | 10.98 | 10.75 | 8.28 | 13.43 | 3.73 | -4.02 |
| neutralPct | 33 | 30.19 | 30.05 | 27.18 | 32.8 | 4.09 | -2.81 |
| shotsPerGame | 2.5 | 3.42 | 3 | 2 | 5 | 1.93 | 0.92 |

## Suspicious observations
- ps4:George_daouk — all-zero core stats (possible AFK/early leave)
- epic:1a189fe3ac964972b65a982af8f58c7d — all-zero core stats (possible AFK/early leave)
- steam:76561198101231428 — shotAccuracy=200 is >4 stdev from mean (38.6)
- xbox:588e777777370900 — shotAccuracy=200 is >4 stdev from mean (38.6)
- epic:d98335ed6c254ccdbf0d81802f77cbc6 — neutralPct=48.4 is >4 stdev from mean (30.19)
- epic:8c338e95e77d41ec9d5bb74a2e05fc65 — assistsPerGame=4 is >4 stdev from mean (0.52)

Full metric distributions (including non-radar fields) are in `rank-benchmarks.json` under `benchmarks.diamond-2.metrics`.