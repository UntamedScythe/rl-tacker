// Shared fetch/rate-limit helpers for the rank-benchmark collector scripts.
// Not used by the live app — only by scripts/collect-rank-benchmarks.ts and
// scripts/expand-rank-benchmark-games.ts.

export const BALLCHASING_BASE = 'https://ballchasing.com/api'
export const BASE_DELAY_MS = 600

export function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Stays well under Ballchasing's documented free-tier caps (2/sec, 500/hr
// list, 1000/hr detail) rather than planning to exhaust them.
export class HourlyLimiter {
  private windowStart = Date.now()
  private count = 0
  constructor(private cap: number, private label: string) {}

  async wait() {
    const elapsed = Date.now() - this.windowStart
    if (elapsed > 60 * 60 * 1000) {
      this.windowStart = Date.now()
      this.count = 0
    }
    if (this.count >= this.cap) {
      const waitMs = 60 * 60 * 1000 - elapsed
      console.log(`[rate-limit] ${this.label} hit safe cap (${this.cap}/hr) — sleeping ${Math.ceil(waitMs / 1000)}s`)
      await sleep(waitMs)
      this.windowStart = Date.now()
      this.count = 0
    }
    this.count++
  }
}

export async function fetchWithBackoff(url: string, apiKey: string, retries = 4): Promise<Record<string, unknown>> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, { headers: { Authorization: apiKey } })
    if (res.status === 429) {
      const wait = 3000 * (attempt + 1)
      console.log(`[429] rate limited, waiting ${wait}ms (attempt ${attempt + 1}/${retries + 1})`)
      await sleep(wait)
      continue
    }
    if (!res.ok) {
      if (attempt < retries) {
        await sleep(2000 * (attempt + 1))
        continue
      }
      throw new Error(`Ballchasing request failed: ${res.status} ${await res.text().catch(() => '')}`)
    }
    return res.json()
  }
  throw new Error('Max retries exceeded')
}

export function mean(xs: number[]) {
  return xs.reduce((a, b) => a + b, 0) / (xs.length || 1)
}
export function stdev(xs: number[]) {
  const m = mean(xs)
  return Math.sqrt(mean(xs.map(x => (x - m) ** 2)))
}
export function percentile(xs: number[], p: number) {
  const sorted = [...xs].sort((a, b) => a - b)
  const idx = (p / 100) * (sorted.length - 1)
  const lo = Math.floor(idx), hi = Math.ceil(idx)
  if (lo === hi) return sorted[lo]
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
}
export function summarize(xs: number[]) {
  if (xs.length === 0) return { mean: null, median: null, p25: null, p75: null, stdev: null }
  return {
    mean: +mean(xs).toFixed(2),
    median: +percentile(xs, 50).toFixed(2),
    p25: +percentile(xs, 25).toFixed(2),
    p75: +percentile(xs, 75).toFixed(2),
    stdev: +stdev(xs).toFixed(2),
  }
}
