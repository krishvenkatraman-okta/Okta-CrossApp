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
}

export async function testSalesforceGatewayFlow(): Promise<GatewayTestResult> {
  const logs: string[] = []
  const tokens: GatewayTestResult['tokens'] = {}
  
  try {
    logs.push('=== Starting Salesforce Gateway Test Flow ===')
    
    // Step 1: Get Web ID Token from session
    logs.push('Step 1: Retrieving Web ID Token from session')
    const idToken = sessionStorage.getItem('web_id_token')
    if (!idToken) {
      throw new Error('Not authenticated. Please log in with Okta Gateway first.')
    }
    tokens.idToken = idToken
    logs.push('✓ Web ID Token retrieved')
    
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
      logs.push(`  Request: GET ${fullUrl}`)
      logs.push(`  Headers:`)
      logs.push(`    Authorization: Bearer ${auth0Data.accessToken.substring(0, 30)}...`)
      logs.push(`    X-GATEWAY-Host: ${hostname}`)
      
      const gatewayResponse = await fetch('/api/gateway-test/salesforce-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          accessToken: auth0Data.accessToken,
          gatewayUrl: fullUrl,
          hostname
        })
      })
      
      logs.push(`  Response: ${gatewayResponse.status} ${gatewayResponse.statusText}`)
      
      if (!gatewayResponse.ok) {
        const errorData = await gatewayResponse.json()
        logs.push(`  Error Body: ${JSON.stringify(errorData, null, 2)}`)
        
        // Check for federated connection error
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
          logs.push('  Please complete the connected account setup in the UI')
          
          return {
            success: false,
            error: 'federated_connection_refresh_token_not_found',
            tokens,
            logs
          }
        }
        
        throw new Error(errorData.message || `Gateway request failed: ${gatewayResponse.status}`)
      }
      
      const data = await gatewayResponse.json()
      logs.push(`✓ Gateway API call successful`)
      logs.push(`  Response: ${JSON.stringify(data, null, 2)}`)
      
      logs.push('=== Gateway Test Flow Completed Successfully ===')
      
      return {
        success: true,
        data,
        tokens,
        logs
      }
    } else {
      logs.push('✗ Gateway mode is not enabled or GATEWAY_URL not configured')
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
