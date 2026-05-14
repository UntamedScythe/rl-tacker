import { NextRequest, NextResponse } from 'next/server'

// We pull the player name from Ballchasing directly since it's already there.
// Steam avatar requires a Steam API key - if not set we return a null avatar
// and the UI will show a fallback icon.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const steamId = searchParams.get('steamId')
  const nameFromReplay = searchParams.get('name') // passed from the replay data

  if (!steamId) {
    return NextResponse.json({ error: 'steamId required' }, { status: 400 })
  }

  // If we already have the name from replay data, use it
  // Still try Steam for the avatar if we have an API key
  const apiKey = process.env.STEAM_API_KEY

  if (!apiKey) {
    return NextResponse.json({
      name: nameFromReplay ?? steamId,
      avatarUrl: null,
    })
  }

  try {
    const res = await fetch(
      `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${apiKey}&steamids=${steamId}`
    )
    const data = await res.json()
    const player = data?.response?.players?.[0]

    return NextResponse.json({
      name: player?.personaname ?? nameFromReplay ?? steamId,
      avatarUrl: player?.avatarmedium ?? null,
    })
  } catch {
    return NextResponse.json({
      name: nameFromReplay ?? steamId,
      avatarUrl: null,
    })
  }
}
