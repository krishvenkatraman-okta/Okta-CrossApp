import { NextRequest, NextResponse } from 'next/server'
import { exchangeIdJagForAuth0Token } from '@/lib/server-token-exchange'

export async function POST(request: NextRequest) {
  try {
    const { idJagToken, resourceType } = await request.json()
    
    if (!idJagToken) {
      return NextResponse.json(
        { message: 'ID-JAG token is required' },
        { status: 400 }
      )
    }
    
    console.log(`[v0] Gateway Test: Exchanging ID-JAG for Auth0 token (${resourceType || 'default'})`)
    
    const accessToken = await exchangeIdJagForAuth0Token(idJagToken, resourceType)
    
    console.log('[v0] Gateway Test: Auth0 Access Token received')
    
    return NextResponse.json({ accessToken })
  } catch (error) {
    console.error('[v0] Gateway Test: Auth0 token exchange failed:', error)
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Failed to exchange for Auth0 token' },
      { status: 500 }
    )
  }
}
