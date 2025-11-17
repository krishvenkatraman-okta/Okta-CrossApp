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
    
    const auth0Domain = process.env.AUTH0_DOMAIN
    const auth0Audience = process.env.AUTH0_AUDIENCE
    
    if (!auth0Domain) {
      return NextResponse.json(
        { message: 'AUTH0_DOMAIN environment variable not set' },
        { status: 500 }
      )
    }
    
    const meResource = `${auth0Domain}/me/`
    console.log(`[v0]   ME Resource: ${meResource}`)
    console.log(`[v0]   Audience: ${auth0Audience}`)
    
    const idJagToken = await requestIdJag(idToken, meResource, auth0Audience || auth0Domain)
    
    console.log('[v0] Gateway Test: ME ID-JAG received')
    console.log(`[v0]   Token preview: ${idJagToken.substring(0, 50)}...`)
    
    return NextResponse.json({ idJagToken })
  } catch (error) {
    console.error('[v0] Gateway Test: ME ID-JAG request failed:', error)
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Failed to request ME ID-JAG' },
      { status: 500 }
    )
  }
}
