import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { meAccessToken, connectionId } = await request.json()

    if (!meAccessToken) {
      return NextResponse.json({ message: 'ME access token is required' }, { status: 400 })
    }

    if (!connectionId) {
      return NextResponse.json({ message: 'Connection ID is required' }, { status: 400 })
    }

    const auth0Domain = process.env.NEXT_PUBLIC_AUTH0_DOMAIN

    if (!auth0Domain) {
      return NextResponse.json(
        { message: 'AUTH0_DOMAIN environment variable not set' },
        { status: 500 }
      )
    }

    const deleteUrl = `${auth0Domain}/me/v1/connected-accounts/${connectionId}`
    
    console.log('[v0] Deleting connected account')
    console.log(`[v0]   URL: ${deleteUrl}`)
    console.log(`[v0]   Connection ID: ${connectionId}`)

    const response = await fetch(deleteUrl, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${meAccessToken}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[v0] Failed to delete connected account:', errorText)
      return NextResponse.json(
        { message: `Failed to delete connected account: ${errorText}` },
        { status: response.status }
      )
    }

    console.log('[v0] Connected account deleted successfully')

    return NextResponse.json({ 
      success: true,
      message: 'Connected account deleted successfully' 
    })
  } catch (error) {
    console.error('Error deleting connected account:', error)
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Unknown error occurred' },
      { status: 500 }
    )
  }
}
