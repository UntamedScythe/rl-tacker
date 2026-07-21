import 'server-only'
import { adminClient } from './supabase/admin'
import type { PlayerCandidate } from './discover'

// ─── Normalisation ────────────────────────────────────────────────────────────
// Single shared helper used for both cache keys and match-quality scoring.
// Order matters: trim → Unicode NFC → lowercase → collapse whitespace.

export function normalizeName(raw: string): string {
  return raw
    .trim()
    .normalize('NFC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

// ─── TTL constants ────────────────────────────────────────────────────────────

const HIT_TTL_MS   = 12 * 60 * 60 * 1000  // 12 hours for results with candidates
const MISS_TTL_MS  = 10 * 60 * 1000        // 10 minutes for zero-result searches

// ─── L1: in-memory cache ──────────────────────────────────────────────────────

type L1Entry = {
  candidates: PlayerCandidate[]
  expiresAt:  number  // ms since epoch
}

const l1: Map<string, L1Entry> = new Map()

function l1Get(key: string): PlayerCandidate[] | null {
  const entry = l1.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) { l1.delete(key); return null }
  return entry.candidates
}

function l1Set(key: string, candidates: PlayerCandidate[], ttlMs: number): void {
  l1.set(key, { candidates, expiresAt: Date.now() + ttlMs })
}

// ─── L2: Supabase ─────────────────────────────────────────────────────────────

type CacheRow = {
  normalized_name: string
  search_name:     string
  candidates:      PlayerCandidate[]
  expires_at:      string  // ISO timestamp
}

async function l2Get(normalizedName: string): Promise<PlayerCandidate[] | null> {
  if (!adminClient) return null
  try {
    const { data, error } = await adminClient
      .from('player_name_cache')
      .select('candidates, expires_at')
      .eq('normalized_name', normalizedName)
      .single()

    if (error || !data) return null

    const row = data as Pick<CacheRow, 'candidates' | 'expires_at'>
    if (new Date(row.expires_at) <= new Date()) return null  // expired

    return row.candidates
  } catch (err) {
    console.error('[playerNameCache] l2Get error (non-fatal):', err)
    return null
  }
}

async function l2Set(
  normalizedName: string,
  searchName:     string,
  candidates:     PlayerCandidate[],
  ttlMs:          number,
): Promise<void> {
  if (!adminClient) return
  try {
    const expiresAt = new Date(Date.now() + ttlMs).toISOString()
    const { error } = await adminClient
      .from('player_name_cache')
      .upsert(
        {
          normalized_name: normalizedName,
          search_name:     searchName,
          candidates:      candidates as unknown as Record<string, unknown>[],
          expires_at:      expiresAt,
        },
        { onConflict: 'normalized_name' },
      )

    if (error) {
      console.error('[playerNameCache] l2Set error (non-fatal):', error.message)
    }
  } catch (err) {
    console.error('[playerNameCache] l2Set exception (non-fatal):', err)
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Read from L1 then L2. Returns null on a full cache miss.
 * Populates L1 from L2 when L2 hits.
 */
export async function cacheGet(
  normalizedName: string,
): Promise<{ candidates: PlayerCandidate[]; cached: true } | null> {
  // L1
  const mem = l1Get(normalizedName)
  if (mem !== null) return { candidates: mem, cached: true }

  // L2
  const db = await l2Get(normalizedName)
  if (db !== null) {
    // Repopulate L1 using remaining TTL — approximate by using full hit TTL.
    // Slight over-caching is acceptable; it only matters after a server restart.
    const ttl = db.length > 0 ? HIT_TTL_MS : MISS_TTL_MS
    l1Set(normalizedName, db, ttl)
    return { candidates: db, cached: true }
  }

  return null
}

/**
 * Write to both L1 and L2.
 * Uses a shorter TTL for zero-result searches.
 * L2 failures are logged but do not throw.
 */
export async function cacheSet(
  normalizedName: string,
  searchName:     string,
  candidates:     PlayerCandidate[],
): Promise<void> {
  const ttlMs = candidates.length > 0 ? HIT_TTL_MS : MISS_TTL_MS
  l1Set(normalizedName, candidates, ttlMs)
  await l2Set(normalizedName, searchName, candidates, ttlMs)
}
