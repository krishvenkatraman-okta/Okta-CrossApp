export interface GatewayTestResult {
  success: boolean
  data?: any
  error?: string
  tokens: {
    idToken?: string
    idJagToken?: string
    auth0AccessToken?: string
    meIdJagToken?: string
    meAuth0AccessToken?: string
  }
  logs: string[]
  connectUri?: string
  authSession?: string
}

export async function getConnectAccountUri(meAccessToken: string): Promise<string> {
  if ((window as any).__connectAccountRequestInProgress) {
    console.log('[v0] Connect account request already in progress, skipping duplicate')
    throw new Error('Request already in progress')
  }
  
  (window as any).__connectAccountRequestInProgress = true
  
  try {
    const sessionId = Date.now().toString()
    
    const response = await fetch('/api/gateway-test/connect-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meAccessToken, sessionId })
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message)
    }
    
    const data = await response.json()
    
    // Store session data using the same session ID
    sessionStorage.setItem(`connect_session_${sessionId}_auth_session`, data.auth_session)
    sessionStorage.setItem(`connect_session_${sessionId}_me_token`, meAccessToken)
    sessionStorage.setItem(`connect_session_${sessionId}_code_verifier`, data.code_verifier)
    
    console.log('[v0] Session data stored with ID:', sessionId)
    
    return data.connect_uri
  } finally {
    (window as any).__connectAccountRequestInProgress = false
  }
}

export async function testSalesforceGatewayFlow(): Promise<GatewayTestResult> {
  const logs: string[] = []
  const tokens: GatewayTestResult['tokens'] = {}
  
  try {
    logs.push('=== Starting Salesforce Gateway Test Flow ===')
    
    // Step 1: Get Web ID Token from session
    logs.push('Step 1: Retrieving Web ID Token from session')
    const idToken = sessionStorage.getItem('web_okta_id_token') // Use correct key
    if (!idToken) {
      logs.push('  Checked sessionStorage keys:')
      logs.push(`    - web_okta_id_token: ${sessionStorage.getItem('web_okta_id_token') ? 'found' : 'not found'}`)
      logs.push(`    - web_id_token: ${sessionStorage.getItem('web_id_token') ? 'found' : 'not found'}`)
      throw new Error('Not authenticated. Please log in with Okta Gateway first.')
    }
    tokens.idToken = idToken
    logs.push('✓ Web ID Token retrieved')
    logs.push(`  Token preview: ${idToken.substring(0, 50)}...`)
    
    // Step 2: Exchange for Salesforce ID-JAG
    logs.push('Step 2: Exchanging Web ID Token for Salesforce ID-JAG')
    logs.push(`  Request: POST /api/gateway-test/salesforce-jag`)
    
    const jagResponse = await fetch('/api/gateway-test/salesforce-jag', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken })
    })
    
    if (!jagResponse.ok) {
      const error = await jagResponse.json()
      logs.push(`✗ ID-JAG exchange failed: ${error.message}`)
      throw new Error(error.message)
    }
    
    const jagData = await jagResponse.json()
    tokens.idJagToken = jagData.idJagToken
    logs.push('✓ Salesforce ID-JAG received')
    logs.push(`  ID-JAG: ${jagData.idJagToken.substring(0, 50)}...`)
    
    // Step 3: Exchange ID-JAG for Auth0 Access Token
    logs.push('Step 3: Exchanging ID-JAG for Auth0 Access Token')
    logs.push(`  Request: POST /api/gateway-test/auth0-token`)
    
    const auth0Response = await fetch('/api/gateway-test/auth0-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idJagToken: jagData.idJagToken, resourceType: 'salesforce' })
    })
    
    if (!auth0Response.ok) {
      const error = await auth0Response.json()
      logs.push(`✗ Auth0 token exchange failed: ${error.message}`)
      throw new Error(error.message)
    }
    
    const auth0Data = await auth0Response.json()
    tokens.auth0AccessToken = auth0Data.accessToken
    logs.push('✓ Auth0 Access Token received')
    logs.push(`  Access Token: ${auth0Data.accessToken.substring(0, 50)}...`)
    
    // Step 4: Call Gateway with Auth0 token
    const gatewayMode = process.env.NEXT_PUBLIC_GATEWAY_MODE === 'true'
    logs.push(`Step 4: Calling ${gatewayMode ? 'Gateway' : 'Direct'} API for Salesforce opportunities`)
    
    const gatewayUrl = process.env.NEXT_PUBLIC_GATEWAY_URL
    const salesforceDomain = process.env.NEXT_PUBLIC_SALESFORCE_DOMAIN || ''
    const hostname = salesforceDomain.replace(/^https?:\/\//, '')
    
    if (gatewayMode && gatewayUrl) {
      const fullUrl = `${gatewayUrl}/opportunities`
      logs.push(`  Gateway URL: ${fullUrl}`)
      logs.push(`  Request Details:`)
      logs.push(`    Method: GET`)
      logs.push(`    Full URL: ${fullUrl}`)
      logs.push(`    Headers:`)
      logs.push(`      Authorization: Bearer ${auth0Data.accessToken.substring(0, 30)}...`)
      logs.push(`      X-GATEWAY-Host: ${hostname}`)
      logs.push(`    Expected Salesforce endpoint: https://${hostname}/opportunities`)
      
      const gatewayResponse = await fetch('/api/gateway-test/salesforce-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          accessToken: auth0Data.accessToken,
          gatewayUrl: fullUrl,
          hostname
        })
      })
      
      logs.push(`  Gateway Response:`)
      logs.push(`    Status: ${gatewayResponse.status} ${gatewayResponse.statusText}`)
      logs.push(`    Headers: ${JSON.stringify(Object.fromEntries(gatewayResponse.headers.entries()), null, 2)}`)
      
      if (!gatewayResponse.ok) {
        const errorText = await gatewayResponse.text()
        let errorData
        try {
          errorData = JSON.parse(errorText)
        } catch {
          errorData = { message: errorText }
        }
        logs.push(`    Error Body: ${JSON.stringify(errorData, null, 2)}`)
        
        if (errorData.error === 'federated_connection_refresh_token_not_found') {
          logs.push('⚠ Federated connection not found - initiating connected account flow')
          logs.push('Step 5: Creating ME access token for connected accounts')
          
          // Exchange for ME ID-JAG
          const meJagResponse = await fetch('/api/gateway-test/me-jag', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken })
          })
          
          if (!meJagResponse.ok) {
            const error = await meJagResponse.json()
            logs.push(`✗ ME ID-JAG exchange failed: ${error.message}`)
            throw new Error(error.message)
          }
          
          const meJagData = await meJagResponse.json()
          tokens.meIdJagToken = meJagData.idJagToken
          logs.push('✓ ME ID-JAG received')
          
          // Exchange for ME Auth0 token
          const meAuth0Response = await fetch('/api/gateway-test/me-auth0-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idJagToken: meJagData.idJagToken })
          })
          
          if (!meAuth0Response.ok) {
            const error = await meAuth0Response.json()
            logs.push(`✗ ME Auth0 token exchange failed: ${error.message}`)
            throw new Error(error.message)
          }
          
          const meAuth0Data = await meAuth0Response.json()
          tokens.meAuth0AccessToken = meAuth0Data.accessToken
          logs.push('✓ ME Auth0 Access Token received')
          logs.push(`  ME Access Token: ${meAuth0Data.accessToken.substring(0, 50)}...`)
          
          // Initiate connected account flow
          logs.push('Step 6: Initiating Salesforce connected account flow')
          
          const connectResponse = await fetch('/api/gateway-test/connect-account', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ meAccessToken: meAuth0Data.accessToken })
          })
          
          if (!connectResponse.ok) {
            const error = await connectResponse.json()
            logs.push(`✗ Failed to initiate connected account: ${error.message}`)
            throw new Error(error.message)
          }
          
          const connectData = await connectResponse.json()
          logs.push('✓ Connected account flow initiated')
          logs.push(`  Auth Session: ${connectData.auth_session}`)
          logs.push(`  Connect URI: ${connectData.connect_uri}`)
          logs.push(`  Ticket: ${connectData.connect_params?.ticket}`)
          
          sessionStorage.setItem('pendingAuthSession', connectData.auth_session)
          sessionStorage.setItem('pendingMEToken', meAuth0Data.accessToken)
          sessionStorage.setItem('pendingCodeVerifier', connectData.code_verifier)
          
          // Construct the full authorization URL
          const authUrl = `${connectData.connect_uri}?ticket=${connectData.connect_params.ticket}`
          logs.push(`  Authorization URL: ${authUrl}`)
          logs.push('  Please complete the connected account setup in the UI')
          
          return {
            success: false,
            error: 'federated_connection_refresh_token_not_found',
            tokens,
            logs,
            connectUri: authUrl,
            authSession: connectData.auth_session
          }
        }
        
        throw new Error(errorData.message || `Gateway request failed: ${gatewayResponse.status}`)
      }
      
      const data = await gatewayResponse.json()
      logs.push(`✓ Gateway API call successful`)
      logs.push(`  Response Data: ${JSON.stringify(data, null, 2)}`)
      
      logs.push('=== Gateway Test Flow Completed Successfully ===')
      
      return {
        success: true,
        data,
        tokens,
        logs
      }
    } else {
      logs.push(`✗ Gateway configuration:`)
      logs.push(`    GATEWAY_MODE: ${process.env.NEXT_PUBLIC_GATEWAY_MODE}`)
      logs.push(`    GATEWAY_URL: ${gatewayUrl || 'not set'}`)
      logs.push(`    SALESFORCE_DOMAIN: ${salesforceDomain || 'not set'}`)
      throw new Error('Gateway mode is not enabled. Please set GATEWAY_MODE=true and GATEWAY_URL')
    }
    
  } catch (error) {
    logs.push(`✗ Flow failed: ${error instanceof Error ? error.message : String(error)}`)
    logs.push('=== Gateway Test Flow Failed ===')
    
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      tokens,
      logs
    }
  }
}

export async function completeConnectedAccount(authSession: string, connectCode: string, meAccessToken: string, codeVerifier: string): Promise<void> {
  const auth0Domain = process.env.NEXT_PUBLIC_AUTH0_DOMAIN
  
  if (!auth0Domain) {
    throw new Error('AUTH0_DOMAIN environment variable not set')
  }
  
  const completeUrl = `${auth0Domain}/me/v1/connected-accounts/complete`
  const redirectUri = `${window.location.origin}/agent/connect-callback`
  
  console.log('[v0] Completing connected account')
  console.log(`[v0]   URL: ${completeUrl}`)
  console.log(`[v0]   Auth Session: ${authSession}`)
  console.log(`[v0]   Connect Code: ${connectCode}`)
  console.log(`[v0]   Redirect URI: ${redirectUri}`)
  console.log(`[v0]   Code Verifier: ${codeVerifier.substring(0, 30)}...`)
  
  const response = await fetch(completeUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${meAccessToken}`
    },
    body: JSON.stringify({
      auth_session: authSession,
      connect_code: connectCode,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier // Include PKCE code_verifier
    })
  })
  
  if (!response.ok) {
    const errorText = await response.text()
    console.error('[v0] Failed to complete connected account:', errorText)
    throw new Error(`Failed to complete connected account: ${response.status} ${errorText}`)
  }
  
  const data = await response.json()
  console.log('[v0] Connected account completed successfully:', data)
}
