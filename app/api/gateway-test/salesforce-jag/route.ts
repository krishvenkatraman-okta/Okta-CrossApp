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
    
    const salesforceResource = process.env.SALESFORCE_RESOURCE
    if (!salesforceResource) {
      return NextResponse.json(
        { message: 'SALESFORCE_RESOURCE environment variable not set' },
        { status: 500 }
      )
    }
    
    const idJagToken = await requestIdJag(idToken, salesforceResource, 'https://mcpagentkrish.us.auth0.com/')
    
    console.log('[v0] Gateway Test: Salesforce ID-JAG received')
    
    return NextResponse.json({ idJagToken })
  } catch (error) {
    console.error('[v0] Gateway Test: Salesforce ID-JAG request failed:', error)
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Failed to request ID-JAG' },
      { status: 500 }
    )
  }
}
