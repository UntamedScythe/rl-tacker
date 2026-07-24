-- Rank benchmark collection tables.
-- Run this once in the Supabase SQL editor before running
-- scripts/collect-rank-benchmarks.ts. These tables hold raw, per-player
-- observations and collection progress — NOT what the production radar reads.
-- The radar consumes a generated static JSON artifact reviewed by hand
-- (see data/generated/rank-benchmarks.json), never a live query against these.

create extension if not exists pgcrypto;

create table if not exists benchmark_player_observations (
  id                       uuid primary key default gen_random_uuid(),
  collected_at             timestamptz not null default now(),
  playlist                 text not null,
  season                   text,
  rank_label               text not null,      -- e.g. 'diamond-2', matches Ballchasing's rank.id
  platform                 text not null,
  player_id                text not null,
  replay_ids               text[] not null,
  games_used               int not null,
  goals_per_game           numeric not null,
  assists_per_game         numeric not null,
  saves_per_game           numeric not null,
  shots_per_game           numeric not null,
  shot_accuracy            numeric not null,
  avg_score                numeric not null,
  avg_boost                numeric not null,
  boost_stolen_per_game    numeric not null,
  big_pads_per_game        numeric not null,
  avg_speed                numeric not null,
  supersonic_pct           numeric not null,
  slow_pct                 numeric not null,
  offensive_pct            numeric not null,
  defensive_pct            numeric not null,
  neutral_pct              numeric not null,
  demos_inflicted_per_game numeric not null,
  demos_taken_per_game     numeric not null,
  unique (platform, player_id, playlist, rank_label)
);

create index if not exists benchmark_player_observations_rank_idx
  on benchmark_player_observations (playlist, rank_label);

create table if not exists benchmark_collection_runs (
  id                  uuid primary key default gen_random_uuid(),
  started_at          timestamptz not null default now(),
  finished_at         timestamptz,
  status              text not null default 'running', -- 'running' | 'complete' | 'failed'
  playlist            text not null,
  rank_label          text not null,
  target_sample_size  int not null,
  players_collected   int not null default 0,
  list_calls_used     int not null default 0,
  detail_calls_used   int not null default 0,
  rejections          jsonb not null default '{}'::jsonb,
  last_replay_id      text,
  notes               text
);

-- Both tables are only ever touched by the collector script using the
-- service-role key, which bypasses RLS unconditionally. Enabling RLS with no
-- policies locks them to service-role-only access — anon/authenticated
-- clients get denied by default, with no impact on the collector.
alter table benchmark_player_observations enable row level security;
alter table benchmark_collection_runs enable row level security;

-- Tables created via the SQL editor don't always pick up Supabase's default
-- role grants automatically — without this, service_role gets a plain
-- Postgres "permission denied for table" error, which is a GRANT issue, not
-- an RLS policy issue (service_role bypasses RLS once it can reach the table).
grant select, insert, update, delete on benchmark_player_observations to service_role;
grant select, insert, update, delete on benchmark_collection_runs to service_role;
