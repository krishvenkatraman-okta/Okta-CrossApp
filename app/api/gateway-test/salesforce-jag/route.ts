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
    
    console.log('[v0] Gateway Test: Requesting Salesforce ID-JAG')
    
    const salesforceDomain = process.env.SALESFORCE_DOMAIN
    const auth0Audience = process.env.AUTH0_AUDIENCE
    
    if (!salesforceDomain) {
      return NextResponse.json(
        { message: 'SALESFORCE_DOMAIN environment variable not set' },
        { status: 500 }
      )
    }
    
    if (!auth0Audience) {
      return NextResponse.json(
        { message: 'AUTH0_AUDIENCE environment variable not set' },
        { status: 500 }
      )
    }
    
    console.log(`[v0]   Resource (Salesforce Domain): ${salesforceDomain}`)
    console.log(`[v0]   Audience (Auth0): ${auth0Audience}`)
    
    const idJagToken = await requestIdJag(idToken, salesforceDomain, auth0Audience)
    
    console.log('[v0] Gateway Test: Salesforce ID-JAG received')
    console.log(`[v0]   ID-JAG preview: ${idJagToken.substring(0, 50)}...`)
    
    return NextResponse.json({ idJagToken })
  } catch (error) {
    console.error('[v0] Gateway Test: Salesforce ID-JAG request failed:', error)
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Failed to request ID-JAG' },
      { status: 500 }
    )
  }
}
