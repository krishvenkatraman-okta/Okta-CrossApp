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
    
    const auth0TokenEndpoint = process.env.AUTH0_TOKEN_ENDPOINT
    const auth0ClientId = process.env.AUTH0_REQUESTING_APP_CLIENT_ID
    const auth0ClientSecret = process.env.AUTH0_REQUESTING_APP_CLIENT_SECRET
    const meScope = 'create:me:connected_accounts'
    
    if (!auth0TokenEndpoint || !auth0ClientId || !auth0ClientSecret) {
      return NextResponse.json(
        { message: 'Auth0 configuration missing (TOKEN_ENDPOINT, CLIENT_ID, or CLIENT_SECRET)' },
        { status: 500 }
      )
    }
    
    console.log(`[v0]   Scope: ${meScope}`)
    console.log(`[v0]   Token Endpoint: ${auth0TokenEndpoint}`)
    
    const accessToken = await exchangeIdJagForAuth0Token(
      idJagToken,
      auth0TokenEndpoint,
      auth0ClientId,
      auth0ClientSecret,
      meScope
    )
    
    console.log('[v0] Gateway Test: ME Auth0 Access Token received')
    console.log(`[v0]   Token preview: ${accessToken.substring(0, 50)}...`)
    
    return NextResponse.json({ accessToken })
  } catch (error) {
    console.error('[v0] Gateway Test: ME Auth0 token exchange failed:', error)
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Failed to exchange for ME Auth0 token' },
      { status: 500 }
    )
  }
}
