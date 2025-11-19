import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { idJagToken } = await request.json()

    if (!idJagToken) {
      return NextResponse.json({ message: 'ID-JAG token is required' }, { status: 400 })
    }

    const auth0TokenEndpoint = process.env.AUTH0_TOKEN_ENDPOINT
    const requestingAppClientId = process.env.AUTH0_REQUESTING_APP_CLIENT_ID
    const requestingAppClientSecret = process.env.AUTH0_REQUESTING_APP_CLIENT_SECRET
    const auth0Audience = process.env.AUTH0_AUDIENCE

    if (!auth0TokenEndpoint || !requestingAppClientId || !requestingAppClientSecret || !auth0Audience) {
      return NextResponse.json(
        { message: 'Auth0 configuration is incomplete' },
        { status: 500 }
      )
    }

    const tokenResponse = await fetch(auth0TokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
        subject_token: idJagToken,
        subject_token_type: 'urn:ietf:params:oauth:token-type:id_token',
        client_id: requestingAppClientId,
        client_secret: requestingAppClientSecret,
        audience: auth0Audience,
        scope: 'delete:me:connected_accounts', // Delete scope
      }),
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('Auth0 ME delete token exchange failed:', errorText)
      return NextResponse.json(
        { message: `Auth0 token exchange failed: ${errorText}` },
        { status: tokenResponse.status }
      )
    }

    const tokenData = await tokenResponse.json()

    console.log('[v0] ME Delete Access Token received')
    console.log(`[v0]   Token preview: ${tokenData.access_token.substring(0, 50)}...`)
    console.log(`[v0]   Scope: delete:me:connected_accounts`)

    return NextResponse.json({ accessToken: tokenData.access_token })
  } catch (error) {
    console.error('Error in ME delete token exchange:', error)
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unknown error occurred' },
      { status: 500 }
    )
  }
}
