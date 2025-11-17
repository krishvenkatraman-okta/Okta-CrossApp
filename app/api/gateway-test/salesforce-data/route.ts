import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { accessToken, gatewayUrl, hostname } = await request.json()
    
    if (!accessToken || !gatewayUrl || !hostname) {
      return NextResponse.json(
        { message: 'Missing required parameters' },
        { status: 400 }
      )
    }
    
    console.log('[v0] Gateway Test: Calling gateway API')
    console.log(`[v0]   URL: ${gatewayUrl}`)
    console.log(`[v0]   Host: ${hostname}`)
    console.log(`[v0]   Authorization: Bearer ${accessToken.substring(0, 30)}...`)
    
    const response = await fetch(gatewayUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-GATEWAY-Host': hostname,
        'Content-Type': 'application/json'
      }
    })
    
    console.log(`[v0] Gateway Test: Response status: ${response.status}`)
    
    const data = await response.json()
    console.log(`[v0] Gateway Test: Response body:`, JSON.stringify(data, null, 2))
    
    if (!response.ok) {
      return NextResponse.json(data, { status: response.status })
    }
    
    return NextResponse.json(data)
  } catch (error) {
    console.error('[v0] Gateway Test: Request failed:', error)
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Gateway request failed' },
      { status: 500 }
    )
  }
}
