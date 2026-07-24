-- Revises benchmark_player_observations to support multi-game (up to 5)
-- per-player aggregates and dual shot-accuracy reporting, per the 1-game POC
-- review: a single game was too noisy for shot accuracy specifically.
--
-- shot_accuracy (existing column) is kept populated for continuity and now
-- means the same thing as shot_accuracy_ratio (the recommended method).

alter table benchmark_player_observations
  add column if not exists shot_accuracy_ratio numeric,
  add column if not exists shot_accuracy_mean_reported numeric,
  add column if not exists zero_shot_games int not null default 0,
  add column if not exists zero_goal_with_shots_games int not null default 0,
  add column if not exists shooting_pct_anomalies_excluded int not null default 0;
