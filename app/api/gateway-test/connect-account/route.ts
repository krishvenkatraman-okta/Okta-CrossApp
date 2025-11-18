import { NextRequest, NextResponse } from 'next/server'
import { generateCodeVerifier, generateCodeChallenge, generateState } from '@/lib/pkce'

export async function POST(request: NextRequest) {
  try {
    const { meAccessToken, sessionId } = await request.json()
    
    if (!meAccessToken) {
      return NextResponse.json(
        { message: 'ME access token is required' },
        { status: 400 }
      )
    }
    
    console.log('[v0] Gateway Test: Initiating Salesforce connected account')
    console.log('[v0]   Session ID:', sessionId)
    
    const auth0Domain = process.env.AUTH0_DOMAIN
    
    if (!auth0Domain) {
      return NextResponse.json(
        { message: 'AUTH0_DOMAIN environment variable not set' },
        { status: 500 }
      )
    }
    
    const codeVerifier = generateCodeVerifier()
    const codeChallenge = await generateCodeChallenge(codeVerifier)
    const codeChallengeMethod = 'S256'
    const state = generateState()
    
    console.log('[v0]   PKCE parameters generated:')
    console.log(`[v0]     Code Verifier: ${codeVerifier.substring(0, 30)}...`)
    console.log(`[v0]     Code Challenge Method: ${codeChallengeMethod}`)
    console.log(`[v0]     Code Challenge: ${codeChallenge.substring(0, 30)}...`)
    console.log(`[v0]     State: ${state}`)
    
    const origin = request.headers.get('origin') || request.headers.get('host') || 'http://localhost:3000'
    const redirectUri = sessionId 
      ? `${origin}/agent/connect-callback?session_id=${sessionId}`
      : `${origin}/agent/connect-callback`
    
    const connectUrl = `${auth0Domain}/me/v1/connected-accounts/connect`
    
    console.log(`[v0]   Connect URL: ${connectUrl}`)
    console.log(`[v0]   Redirect URI: ${redirectUri}`)
    
    const requestBody = {
      connection: 'Salesforce',
      redirect_uri: redirectUri,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: codeChallengeMethod
    }
    
    console.log('[v0]   Request body:', JSON.stringify(requestBody, null, 2))
    
    const response = await fetch(connectUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${meAccessToken}`
      },
      body: JSON.stringify(requestBody)
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
    console.log(`[v0]   Ticket: ${data.connect_params?.ticket}`)
    
    return NextResponse.json({
      ...data,
      code_verifier: codeVerifier,
      state: state
    })
  } catch (error) {
    console.error('[v0] Gateway Test: Connect account failed:', error)
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Failed to initiate connected account' },
      { status: 500 }
    )
  }
}
