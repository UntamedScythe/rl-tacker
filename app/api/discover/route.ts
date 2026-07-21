import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { normalizeName } from '@/lib/playerNameCache'
import { cacheGet, cacheSet } from '@/lib/playerNameCache'
import { extractCandidates } from '@/lib/discover'
import type { DiscoverResponse } from '@/lib/discover'

const BALLCHASING_BASE = 'https://ballchasing.com/api'
const SEARCH_COUNT     = 15   // replays to fetch per name search
const CANDIDATE_CAP    = 8    // max candidates returned to client
const TIMEOUT_MS       = 8000

// ─── In-flight deduplication ──────────────────────────────────────────────────
// If two requests for the same normalized name arrive before the first resolves,
// the second awaits the same Promise rather than firing a second Ballchasing call.

const inFlight = new Map<string, Promise<DiscoverResponse>>()

// ─── Helpers ──────────────────────────────────────────────────────────────────

function errorResponse(
  searchName: string,
  error:      string,
  errorCode:  DiscoverResponse['errorCode'],
  status:     number = 400,
): NextResponse {
  const body: DiscoverResponse = {
    candidates: [],
    searchName,
    cached: false,
    error,
    errorCode,
  }
  return NextResponse.json(body, { status })
}

async function fetchWithTimeout(url: string, apiKey: string): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    return await fetch(url, {
      headers: { Authorization: apiKey },
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timer)
  }
}

// ─── Core search (called at most once per in-flight key) ──────────────────────

async function performSearch(
  rawName:        string,
  normalizedName: string,
  apiKey:         string,
): Promise<DiscoverResponse> {
  const url =
    `${BALLCHASING_BASE}/replays` +
    `?player-name=${encodeURIComponent(rawName)}` +
    `&count=${SEARCH_COUNT}` +
    `&sort-by=replay-date&sort-dir=desc`

  let res: Response
  try {
    res = await fetchWithTimeout(url, apiKey)
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return {
        candidates: [],
        searchName: rawName,
        cached: false,
        error: 'Search timed out. Try again, or paste your platform ID directly.',
        errorCode: 'TIMEOUT',
      }
    }
    throw err
  }

  if (res.status === 429) {
    return {
      candidates: [],
      searchName: rawName,
      cached: false,
      error: 'Ballchasing is busy right now. Try again in a moment.',
      errorCode: 'RATE_LIMITED',
    }
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    console.error(`[discover] Ballchasing error ${res.status}:`, text.slice(0, 200))
    return {
      candidates: [],
      searchName: rawName,
      cached: false,
      error: 'Ballchasing returned an unexpected error. Try again.',
      errorCode: 'UPSTREAM_ERROR',
    }
  }

  let data: { list?: unknown[] }
  try {
    data = await res.json()
  } catch {
    console.error('[discover] Failed to parse Ballchasing response as JSON')
    return {
      candidates: [],
      searchName: rawName,
      cached: false,
      error: 'Received an invalid response from Ballchasing. Try again.',
      errorCode: 'UPSTREAM_ERROR',
    }
  }

  const replays = data?.list ?? []

  // Temporary debug
  const allNames = new Set<string>()
    for (const replay of replays as { blue?: { players?: { name?: string }[] }; orange?: { players?: { name?: string }[] } }[]) {
    for (const p of [...(replay.blue?.players ?? []), ...(replay.orange?.players ?? [])]) {
      if (p.name) allNames.add(p.name)
    }
  }
console.log('Names found in replays:', [...allNames])

  const candidates = extractCandidates(replays as Parameters<typeof extractCandidates>[0], rawName, CANDIDATE_CAP)

  // Cache the result — zero results get a shorter TTL (handled inside cacheSet)
  await cacheSet(normalizedName, rawName, candidates)

  if (candidates.length === 0) {
    return {
      candidates: [],
      searchName: rawName,
      cached: false,
      error:
        'No players found for that name. Try a different spelling, or paste your platform ID directly.',
      errorCode: 'NO_RESULTS',
    }
  }

  if (candidates.length >= CANDIDATE_CAP) {
    // We hit the cap — there may be more matches than shown
    return {
      candidates,
      searchName: rawName,
      cached: false,
      error:
        'Too many players match that name. Try adding more of your display name, or paste your platform ID.',
      errorCode: 'TOO_MANY',
    }
  }

  return { candidates, searchName: rawName, cached: false }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 1. Parse body
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return errorResponse('', 'Invalid request body.', 'INVALID_INPUT')
  }

  const rawName =
    typeof (body as Record<string, unknown>)?.name === 'string'
      ? ((body as Record<string, unknown>).name as string)
      : ''

  const trimmed = rawName.trim()
  console.log('Search term chars:', [...trimmed].map(c => `${c}(${c.charCodeAt(0)})`).join(' '))
  // 2. Validate
  if (trimmed.length < 2) {
    return errorResponse(trimmed, 'Enter at least 2 characters.', 'INVALID_INPUT')
  }
  if (trimmed.length > 64) {
    return errorResponse(trimmed, 'Name is too long (max 64 characters).', 'INVALID_INPUT')
  }

  const normalizedName = normalizeName(trimmed)

  // 3. Check API key
  const apiKey = process.env.BALLCHASING_API_KEY
  if (!apiKey) {
    console.error('[discover] BALLCHASING_API_KEY is not set')
    return NextResponse.json(
      {
        candidates: [],
        searchName: trimmed,
        cached: false,
        error: 'Server configuration error.',
        errorCode: 'UPSTREAM_ERROR',
      } satisfies DiscoverResponse,
      { status: 500 },
    )
  }

  // 4. L1 + L2 cache read
  const cached = await cacheGet(normalizedName)
  if (cached) {
    const { candidates } = cached
    if (candidates.length === 0) {
      return NextResponse.json({
        candidates: [],
        searchName: trimmed,
        cached: true,
        error:
          'No players found for that name. Try a different spelling, or paste your platform ID directly.',
        errorCode: 'NO_RESULTS',
      } satisfies DiscoverResponse)
    }
    return NextResponse.json({
      candidates,
      searchName: trimmed,
      cached: true,
    } satisfies DiscoverResponse)
  }

  // 5. In-flight deduplication
  const existing = inFlight.get(normalizedName)
  if (existing) {
    const result = await existing
    return NextResponse.json(result)
  }

  // 6. Perform search, register in-flight promise
  const promise = performSearch(trimmed, normalizedName, apiKey).finally(() => {
    inFlight.delete(normalizedName)
  })
  inFlight.set(normalizedName, promise)

  const result = await promise
  return NextResponse.json(result)
}

