import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { meAccessToken } = await request.json()
    
    if (!meAccessToken) {
      return NextResponse.json(
        { message: 'ME access token is required' },
        { status: 400 }
      )
    }
    
    console.log('[v0] Gateway Test: Initiating Salesforce connected account')
    
    const auth0Domain = process.env.AUTH0_DOMAIN
    
    if (!auth0Domain) {
      return NextResponse.json(
        { message: 'AUTH0_DOMAIN environment variable not set' },
        { status: 500 }
      )
    }
    
    const origin = request.headers.get('origin') || request.headers.get('host') || 'http://localhost:3000'
    const redirectUri = `${origin}/agent/connect-callback`
    
    const connectUrl = `${auth0Domain}/me/v1/connected-accounts/connect`
    
    console.log(`[v0]   Connect URL: ${connectUrl}`)
    console.log(`[v0]   Redirect URI: ${redirectUri}`)
    
    const response = await fetch(connectUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${meAccessToken}`
      },
      body: JSON.stringify({
        connection: 'Salesforce',
        redirect_uri: redirectUri,
        state: crypto.randomUUID(),
        scopes: ['openid', 'profile'] // Already correct - array format required by Auth0
      })
    })
    
    const responseText = await response.text()
    console.log(`[v0] Connect Account Response: ${response.status}`)
    console.log(`[v0]   Body: ${responseText}`)
    
    if (!response.ok) {
      return NextResponse.json(
        { message: `Failed to initiate connected account: ${responseText}` },
        { status: response.status }
      )
    }
    
    const data = JSON.parse(responseText)
    console.log('[v0] Connected account initiated successfully')
    console.log(`[v0]   Auth Session: ${data.auth_session}`)
    console.log(`[v0]   Connect URI: ${data.connect_uri}`)
    
    return NextResponse.json(data)
  } catch (error) {
    console.error('[v0] Gateway Test: Connect account failed:', error)
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Failed to initiate connected account' },
      { status: 500 }
    )
  }
}
