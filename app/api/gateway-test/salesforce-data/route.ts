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
    console.log('[v0]   Full URL:', gatewayUrl)
    console.log('[v0]   Method: GET')
    console.log('[v0]   Headers:')
    console.log(`[v0]     Authorization: Bearer ${accessToken.substring(0, 30)}...`)
    console.log(`[v0]     x-gateway-host: ${hostname}`)
    console.log(`[v0]     Content-Type: application/json`)
    console.log(`[v0]   Expected proxied endpoint: https://${hostname}/opportunities`)
    
    const response = await fetch(gatewayUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'x-gateway-host': hostname,
        'Content-Type': 'application/json'
      }
    })
    
    console.log(`[v0] Gateway Response:`)
    console.log(`[v0]   Status: ${response.status} ${response.statusText}`)
    console.log(`[v0]   Headers:`, Object.fromEntries(response.headers.entries()))
    
    const responseText = await response.text()
    console.log(`[v0]   Body:`, responseText)
    
    let data
    try {
      data = JSON.parse(responseText)
    } catch {
      console.log('[v0]   Response is not JSON, returning as text')
      data = { raw: responseText }
    }
    
    if (!response.ok) {
      console.log('[v0] Gateway request failed with status:', response.status)
      return NextResponse.json(data, { status: response.status })
    }
    
    console.log('[v0] Gateway request successful!')
    return NextResponse.json(data)
  } catch (error) {
    console.error('[v0] Gateway Test: Request failed:', error)
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Gateway request failed' },
      { status: 500 }
    )
  }
}
