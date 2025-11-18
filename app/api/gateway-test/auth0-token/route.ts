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
    
    const tokenEndpoint = process.env.AUTH0_TOKEN_ENDPOINT!
    const clientId = process.env.AUTH0_REQUESTING_APP_CLIENT_ID!
    const clientSecret = process.env.AUTH0_REQUESTING_APP_CLIENT_SECRET!
    
    let scope: string
    const envScope = process.env.SALESFORCE_SCOPE
    if (resourceType === 'salesforce') {
      scope = envScope || 'salesforce:read'
      console.log('[v0] Gateway Test: Salesforce scope configuration:')
      console.log(`[v0]   - SALESFORCE_SCOPE env var: ${envScope ? `"${envScope}"` : 'not set'}`)
      console.log(`[v0]   - Using scope: "${scope}"`)
      console.log(`[v0]   - Source: ${envScope ? 'environment variable' : 'default fallback'}`)
    } else {
      const financeEnvScope = process.env.FINANCE_SCOPE
      scope = financeEnvScope || 'finance:read'
      console.log('[v0] Gateway Test: Finance scope configuration:')
      console.log(`[v0]   - FINANCE_SCOPE env var: ${financeEnvScope ? `"${financeEnvScope}"` : 'not set'}`)
      console.log(`[v0]   - Using scope: "${scope}"`)
      console.log(`[v0]   - Source: ${financeEnvScope ? 'environment variable' : 'default fallback'}`)
    }
    
    console.log('[v0] Gateway Test: Token exchange parameters:', {
      tokenEndpoint,
      scope,
      clientId: clientId.substring(0, 10) + '...'
    })
    
    const accessToken = await exchangeIdJagForAuth0Token(
      idJagToken,
      tokenEndpoint,
      clientId,
      clientSecret,
      scope
    )
    
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
