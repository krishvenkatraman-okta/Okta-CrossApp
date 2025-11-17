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
  console.log("[v0] Server: Requesting Auth0 access token via ID-JAG")

  const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/token-exchange/auth0`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ idToken }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || "Auth0 token exchange failed")
  }

  const data = await response.json()
  console.log("[v0] Server: Auth0 access token received")

  return {
    idJag: data.idJag,
    accessToken: data.accessToken,
  }
}

/**
 * Server-side: Exchange ID token for Auth0 access token for Salesforce
 */
export async function exchangeForSalesforceAuth0Token(idToken: string): Promise<TokenExchangeResult> {
  console.log("[v0] Server: Requesting Auth0 access token via ID-JAG for Salesforce")

  const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/token-exchange/auth0`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ idToken, resourceType: "salesforce" }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || "Auth0 token exchange failed for Salesforce")
  }

  const data = await response.json()
  console.log("[v0] Server: Auth0 access token received for Salesforce")

  return {
    idJag: data.idJag,
    accessToken: data.accessToken,
  }
}

/**
 * Extract ID token from request cookies
 */
export function getIdTokenFromCookies(req: Request): string | null {
  const cookies = req.headers.get('cookie') || ''
  const webIdToken = cookies.split(';').find(c => c.trim().startsWith('web_okta_id_token='))?.split('=')[1]
  return webIdToken || null
}
