import { NextRequest, NextResponse } from 'next/server'

const BALLCHASING_BASE = 'https://ballchasing.com/api'

export async function POST(req: NextRequest) {
  const apiKey = process.env.BALLCHASING_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
  }

  const formData = await req.formData()
  const file = formData.get('replay') as File | null

  if (!file) {
    return NextResponse.json({ error: 'No replay file provided' }, { status: 400 })
  }

  if (!file.name.endsWith('.replay')) {
    return NextResponse.json({ error: 'File must be a .replay file' }, { status: 400 })
  }

  // Step 1: Upload replay to Ballchasing
  const uploadForm = new FormData()
  uploadForm.append('file', file, file.name)
  uploadForm.append('visibility', 'public')

  const uploadRes = await fetch(`${BALLCHASING_BASE}/v2/upload`, {
    method: 'POST',
    headers: { Authorization: apiKey },
    body: uploadForm,
  })

  if (uploadRes.status === 409) {
    // Replay already exists — Ballchasing returns the existing ID
    const data = await uploadRes.json()
    const replayId = data.id
    if (!replayId) {
      return NextResponse.json({ error: 'Replay already uploaded but could not retrieve ID' }, { status: 500 })
    }
    return await fetchReplayStats(replayId, apiKey)
  }

  if (uploadRes.status === 429) {
    return NextResponse.json(
      { error: 'Daily or weekly upload limit reached. Please try again tomorrow or use your Ballchasing player ID instead.' },
      { status: 429 }
    )
  }

  if (!uploadRes.ok) {
    const err = await uploadRes.json().catch(() => ({}))
    return NextResponse.json(
      { error: err.error ?? `Upload failed (${uploadRes.status})` },
      { status: uploadRes.status }
    )
  }

  const uploadData = await uploadRes.json()
  const replayId = uploadData.id

  if (!replayId) {
    return NextResponse.json({ error: 'Upload succeeded but no replay ID returned' }, { status: 500 })
  }

  // Step 2: Fetch stats for this replay
  return await fetchReplayStats(replayId, apiKey)
}

async function fetchReplayStats(replayId: string, apiKey: string) {
  // Ballchasing may need a moment to process the replay
  await new Promise(r => setTimeout(r, 2000))

  const replayRes = await fetch(`${BALLCHASING_BASE}/replays/${replayId}`, {
    headers: { Authorization: apiKey },
  })

  if (!replayRes.ok) {
    return NextResponse.json({ error: 'Could not fetch replay stats after upload' }, { status: 500 })
  }

  const replay = await replayRes.json()

  // Return the full replay so the client can let the user pick which player to view
  const blue = replay.blue?.players ?? []
  const orange = replay.orange?.players ?? []
  const allPlayers = [...blue, ...orange].map((p: {
    id?: { platform?: string; id?: string }
    name?: string
    stats?: object
  }) => ({
    id: p.id?.id,
    platform: p.id?.platform,
    name: p.name,
    stats: p.stats,
  }))

  return NextResponse.json({ replayId, players: allPlayers })
}
