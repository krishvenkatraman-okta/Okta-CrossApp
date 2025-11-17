import { OKTA_WEB_ENDPOINTS } from "./okta-config"

/**
 * Server-side token exchange functions for API routes
 * These don't rely on browser APIs like localStorage
 */

interface TokenExchangeResult {
  idJag: string
  accessToken: string
}


/**
 * Request ID-JAG token from Okta
 */
export async function requestIdJag(idToken: string, resource: string, audience: string): Promise<string> {
  console.log("[v0] Requesting ID-JAG from Okta")
  console.log("[v0] - Resource:", resource)
  console.log("[v0] - Audience:", audience)
  
  const jagRequestBody = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
    requested_token_type: "urn:ietf:params:oauth:token-type:id-jag",
    audience,
    resource,
    subject_token: idToken,
    subject_token_type: "urn:ietf:params:oauth:token-type:id_token",
    client_id: process.env.OKTA_REQUESTING_APP_CLIENT_ID!,
    client_secret: process.env.OKTA_REQUESTING_APP_CLIENT_SECRET!,
  })

  const jagResponse = await fetch(OKTA_WEB_ENDPOINTS.token, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: jagRequestBody,
  })

  if (!jagResponse.ok) {
    const errorText = await jagResponse.text()
    console.error("[v0] ID-JAG exchange failed:", errorText)
    throw new Error(`ID-JAG exchange failed: ${errorText}`)
  }

  const jagData = await jagResponse.json()
  console.log("[v0] ID-JAG received")
  
  return jagData.access_token
}

/**
 * Exchange ID-JAG for Auth0 access token
 */
export async function exchangeIdJagForAuth0Token(idJag: string, resourceType?: string): Promise<string> {
  console.log("[v0] Exchanging ID-JAG for Auth0 access token")
  console.log("[v0] - Resource type:", resourceType || 'finance')
  
  let scope = "finance:read"
  
  if (resourceType === 'salesforce') {
    scope = "salesforce:read"
  } else if (resourceType === 'me') {
    scope = "create:me:connected_accounts"
  }
  
  const auth0RequestBody = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: idJag,
    client_id: process.env.AUTH0_REQUESTING_APP_CLIENT_ID!,
    client_secret: process.env.AUTH0_REQUESTING_APP_CLIENT_SECRET!,
    scope,
  })

  console.log("[v0] - Auth0 endpoint:", process.env.AUTH0_TOKEN_ENDPOINT)
  console.log("[v0] - Scope:", scope)

  const auth0Response = await fetch(process.env.AUTH0_TOKEN_ENDPOINT!, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: auth0RequestBody,
  })

  if (!auth0Response.ok) {
    const errorText = await auth0Response.text()
    console.error("[v0] Auth0 token exchange failed:", errorText)
    throw new Error(`Auth0 token exchange failed: ${errorText}`)
  }

  const auth0Data = await auth0Response.json()
  console.log("[v0] Auth0 access token received")
  
  return auth0Data.access_token
}

/**
 * Server-side: Exchange ID token for Auth0 access token for Finance
 */
export async function exchangeForAuth0Token(idToken: string): Promise<TokenExchangeResult> {
  console.log("[v0] ===== AUTH0 TOKEN EXCHANGE (FINANCE) STARTED =====")
  console.log("[v0] Requesting Auth0 access token via ID-JAG for Finance")
  console.log("[v0] ID Token length:", idToken.length)

  try {
    // Step 1: Get ID-JAG from Okta
    console.log("[v0] Step 1: Requesting ID-JAG from Okta")
    
    const idJag = await requestIdJag(idToken, process.env.FINANCE_RESOURCE!, process.env.AUTH0_AUDIENCE!)

    // Step 2: Exchange ID-JAG for Auth0 access token
    console.log("[v0] Step 2: Exchanging ID-JAG for Auth0 access token")
    
    const accessToken = await exchangeIdJagForAuth0Token(idJag)
    console.log("[v0] Step 2 ✓: Auth0 access token received")
    console.log("[v0] ===== AUTH0 TOKEN EXCHANGE (FINANCE) COMPLETED =====")

    return {
      idJag,
      accessToken,
    }
  } catch (error) {
    console.error("[v0] ===== AUTH0 TOKEN EXCHANGE (FINANCE) FAILED =====")
    console.error("[v0] Error:", error)
    throw error
  }
}

/**
 * Server-side: Exchange ID token for Auth0 access token for Salesforce
 */
export async function exchangeForSalesforceAuth0Token(idToken: string): Promise<TokenExchangeResult> {
  console.log("[v0] ===== AUTH0 TOKEN EXCHANGE (SALESFORCE) STARTED =====")
  console.log("[v0] Requesting Auth0 access token via ID-JAG for Salesforce")
  console.log("[v0] ID Token length:", idToken.length)

  try {
    // Step 1: Get ID-JAG from Okta with Salesforce resource
    console.log("[v0] Step 1: Requesting ID-JAG from Okta with Salesforce resource")
    
    const idJag = await requestIdJag(idToken, process.env.SALESFORCE_RESOURCE!, process.env.AUTH0_AUDIENCE!)

    // Step 2: Exchange ID-JAG for Auth0 access token
    console.log("[v0] Step 2: Exchanging ID-JAG for Auth0 access token")
    
    const accessToken = await exchangeIdJagForAuth0Token(idJag, 'salesforce')
    console.log("[v0] Step 2 ✓: Auth0 access token received for Salesforce")
    console.log("[v0] ===== AUTH0 TOKEN EXCHANGE (SALESFORCE) COMPLETED =====")

    return {
      idJag,
      accessToken,
    }
  } catch (error) {
    console.error("[v0] ===== AUTH0 TOKEN EXCHANGE (SALESFORCE) FAILED =====")
    console.error("[v0] Error:", error)
    throw error
  }
}

/**
 * Extract ID token from request cookies
 */
export function getIdTokenFromCookies(req: Request): string | null {
  console.log("[v0] ===== EXTRACTING ID TOKEN FROM COOKIES =====")
  
  const cookieHeader = req.headers.get("cookie")
  
  if (!cookieHeader) {
    console.log("[v0] No cookie header found in request")
    console.log("[v0] ===== ID TOKEN EXTRACTION FAILED =====")
    return null
  }

  console.log("[v0] Cookie header present, length:", cookieHeader.length)

  const cookies = Object.fromEntries(
    cookieHeader.split("; ").map((cookie) => {
      const [name, ...rest] = cookie.split("=")
      return [name, rest.join("=")]
    }),
  )

  console.log("[v0] Available cookies:", Object.keys(cookies))

  const idToken = cookies["web_okta_id_token"]
  
  if (!idToken) {
    console.log("[v0] web_okta_id_token cookie not found")
    console.log("[v0] ===== ID TOKEN EXTRACTION FAILED =====")
  } else {
    console.log("[v0] Found web_okta_id_token cookie, length:", idToken.length)
    console.log("[v0] ===== ID TOKEN EXTRACTION COMPLETED =====")
  }

  return idToken || null
}
