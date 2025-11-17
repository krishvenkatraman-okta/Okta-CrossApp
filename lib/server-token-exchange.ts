/**
 * Server-side token exchange functions for API routes
 * These don't rely on browser APIs like localStorage
 */

interface TokenExchangeResult {
  idJag: string
  accessToken: string
}

/**
 * Server-side: Exchange ID token for Auth0 access token for Finance
 */
export async function exchangeForAuth0Token(idToken: string): Promise<TokenExchangeResult> {
  console.log("[v0] ===== AUTH0 TOKEN EXCHANGE (FINANCE) STARTED =====")
  console.log("[v0] Requesting Auth0 access token via ID-JAG for Finance")
  console.log("[v0] ID Token length:", idToken.length)

  const apiUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/token-exchange/auth0`
  console.log("[v0] API URL:", apiUrl)

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ idToken }),
    })

    console.log("[v0] Token exchange API response status:", response.status)

    if (!response.ok) {
      const error = await response.json()
      console.error("[v0] Token exchange failed:", error)
      throw new Error(error.message || "Auth0 token exchange failed")
    }

    const data = await response.json()
    console.log("[v0] Auth0 access token received for Finance")
    console.log("[v0] - ID-JAG length:", data.idJag?.length || 0)
    console.log("[v0] - Access Token length:", data.accessToken?.length || 0)
    console.log("[v0] ===== AUTH0 TOKEN EXCHANGE (FINANCE) COMPLETED =====")

    return {
      idJag: data.idJag,
      accessToken: data.accessToken,
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

  const apiUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/token-exchange/auth0`
  console.log("[v0] API URL:", apiUrl)

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ idToken, resourceType: "salesforce" }),
    })

    console.log("[v0] Token exchange API response status:", response.status)

    if (!response.ok) {
      const error = await response.json()
      console.error("[v0] Token exchange failed:", error)
      throw new Error(error.message || "Auth0 token exchange failed for Salesforce")
    }

    const data = await response.json()
    console.log("[v0] Auth0 access token received for Salesforce")
    console.log("[v0] - ID-JAG length:", data.idJag?.length || 0)
    console.log("[v0] - Access Token length:", data.accessToken?.length || 0)
    console.log("[v0] ===== AUTH0 TOKEN EXCHANGE (SALESFORCE) COMPLETED =====")

    return {
      idJag: data.idJag,
      accessToken: data.accessToken,
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
