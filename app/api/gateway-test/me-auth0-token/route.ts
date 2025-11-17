import { NextRequest, NextResponse } from 'next/server'
import { exchangeIdJagForAuth0Token } from '@/lib/server-token-exchange'

export async function POST(request: NextRequest) {
  try {
    const { idJagToken } = await request.json()
    
    if (!idJagToken) {
      return NextResponse.json(
        { message: 'ID-JAG token is required' },
        { status: 400 }
      )
    }
    
    console.log('[v0] Gateway Test: Exchanging ME ID-JAG for Auth0 token')
    
    const accessToken = await exchangeIdJagForAuth0Token(idJagToken, 'me')
    
    console.log('[v0] Gateway Test: ME Auth0 Access Token received')
    
    return NextResponse.json({ accessToken })
  } catch (error) {
    console.error('[v0] Gateway Test: ME Auth0 token exchange failed:', error)
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Failed to exchange for ME Auth0 token' },
      { status: 500 }
    )
  }
}
