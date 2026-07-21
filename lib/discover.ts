import 'server-only'
import { normalizeName } from './playerNameCache'

// ─── Types ────────────────────────────────────────────────────────────────────

export type MatchType = 'exact' | 'normalized' | 'starts-with' | 'substring'

export type PlayerCandidate = {
  /** Display name as it appeared in the replay at time of upload. */
  name: string
  /** "steam" | "epic" | "ps4" | "xbox" */
  platform: string
  /** Stable platform ID — the only value passed to the stats endpoint. */
  id: string
  /** How many of the searched replays this identity appeared in. */
  replayCount: number
  /** Match quality relative to the search term. */
  matchType: MatchType
}

export type DiscoverErrorCode =
  | 'INVALID_INPUT'
  | 'NO_RESULTS'
  | 'TOO_MANY'
  | 'RATE_LIMITED'
  | 'TIMEOUT'
  | 'UPSTREAM_ERROR'

export type DiscoverResponse = {
  candidates:  PlayerCandidate[]
  searchName:  string
  cached:      boolean
  error?:      string
  errorCode?:  DiscoverErrorCode
}

// ─── Raw Ballchasing shapes (list endpoint) ───────────────────────────────────

type BallchasingPlayer = {
  name?:  string
  id?: {
    platform?: string
    id?:       string
  }
}

type BallchasingReplay = {
  blue?:   { players?: BallchasingPlayer[] }
  orange?: { players?: BallchasingPlayer[] }
}

// ─── Match-type scoring ───────────────────────────────────────────────────────
// Lower number = higher quality. Used to sort candidates.

const MATCH_RANK: Record<MatchType, number> = {
  exact:        0,
  normalized:   1,
  'starts-with': 2,
  substring:    3,
}

/**
 * Classify how well a candidate's display name matches the search term.
 *
 * Definitions:
 *  exact       — names match after trim + case-fold only (no Unicode normalisation needed)
 *  normalized  — names match only after full normalisation (NFC + whitespace collapse)
 *  starts-with — normalised candidate starts with normalised search term
 *  substring   — normalised candidate contains normalised search term
 *
 * Returns null if the candidate does not match at all (caller should discard).
 */
export function classifyMatch(
  candidateName: string,
  searchTerm:    string,
): MatchType | null {
  const candidateFolded = candidateName.trim().toLowerCase()
  const searchFolded    = searchTerm.trim().toLowerCase()

  // 1. Exact: trim + case-fold is sufficient
  if (candidateFolded === searchFolded) return 'exact'

  const candidateNorm = normalizeName(candidateName)
  const searchNorm    = normalizeName(searchTerm)

  // 2. Normalized: full normalization is required to match
  if (candidateNorm === searchNorm) return 'normalized'

  // 3. Starts-with
  if (candidateNorm.startsWith(searchNorm)) return 'starts-with'

  // 4. Substring
  if (candidateNorm.includes(searchNorm)) return 'substring'

  return null
}

// ─── Candidate extraction ─────────────────────────────────────────────────────

/**
 * Walk a list of Ballchasing replay summaries, extract player identities that
 * match the search term, deduplicate by platform:id, count appearances, and
 * return a sorted, capped candidate list.
 */
export function extractCandidates(
  replays:    BallchasingReplay[],
  searchTerm: string,
  cap:        number = 8,
): PlayerCandidate[] {
  // identity key → { candidate data, count }
  const seen = new Map<string, { name: string; platform: string; id: string; replayCount: number; matchType: MatchType }>()

  for (const replay of replays) {
    const players: BallchasingPlayer[] = [
      ...(replay.blue?.players   ?? []),
      ...(replay.orange?.players ?? []),
    ]

    for (const player of players) {
      const name     = player?.name
      const platform = player?.id?.platform
      const id       = player?.id?.id

      // Skip incomplete records
      if (!name || !platform || !id) continue

      const matchType = classifyMatch(name, searchTerm)
      if (!matchType) continue

      const key = `${platform}:${id}`

      const existing = seen.get(key)
      if (existing) {
        existing.replayCount++
        // Upgrade match quality if a better match is found in a later replay
        if (MATCH_RANK[matchType] < MATCH_RANK[existing.matchType]) {
          existing.matchType = matchType
          existing.name      = name  // use the name from the better-matching replay
        }
      } else {
        seen.set(key, { name, platform, id, replayCount: 1, matchType })
      }
    }
  }

  return [...seen.values()]
    .sort((a, b) =>
      MATCH_RANK[a.matchType] - MATCH_RANK[b.matchType] ||
      b.replayCount           - a.replayCount
    )
    .slice(0, cap)
}
