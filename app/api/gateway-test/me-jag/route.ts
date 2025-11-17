import { NextRequest, NextResponse } from 'next/server'
import { requestIdJag } from '@/lib/server-token-exchange'

export async function POST(request: NextRequest) {
  try {
    const { idToken } = await request.json()
    
    if (!idToken) {
      return NextResponse.json(
        { message: 'ID token is required' },
        { status: 400 }
      )
    }
    
    console.log('[v0] Gateway Test: Requesting ME ID-JAG')
    
    const auth0Domain = process.env.AUTH0_DOMAIN || 'mcpagentkrish.us.auth0.com'
    const meResource = `https://${auth0Domain}/me/`
    
    const idJagToken = await requestIdJag(idToken, meResource, `https://${auth0Domain}/`)
    
    console.log('[v0] Gateway Test: ME ID-JAG received')
    
    return NextResponse.json({ idJagToken })
  } catch (error) {
    console.error('[v0] Gateway Test: ME ID-JAG request failed:', error)
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Failed to request ME ID-JAG' },
      { status: 500 }
    )
  }
}
