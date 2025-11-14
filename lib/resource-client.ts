"use client"

import { getIdToken } from "./auth-client"
import { getWebIdToken } from "./web-auth-client"
import { tokenStore } from "./token-store"

export interface EnterpriseDataResponse<T> {
  success: boolean
  data: T
  metadata: {
    requestedBy: string
    clientId: string
    timestamp: string
  }
}

/**
 * Gets ID token from either PKCE auth or Web auth
 */
function getAnyIdToken(): string | null {
  // Try PKCE auth first
  const pkceToken = getIdToken()
  if (pkceToken) {
    console.log("[v0] Using PKCE ID token")
    return pkceToken
  }

  // Try Web auth
  const webToken = getWebIdToken()
  if (webToken) {
    console.log("[v0] Using Web Client ID token")
    return webToken
  }

  return null
}

/**
 * Exchanges ID token for access token (ID-JAG)
 */
async function getAccessToken(): Promise<string> {
  const idToken = getAnyIdToken()
  if (!idToken) {
    throw new Error("Not authenticated. Please log in first.")
  }

  console.log("[v0] Requesting cross-app access token")

  const response = await fetch("/api/token-exchange", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ idToken }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || "Token exchange failed")
  }

  const data = await response.json()
  console.log("[v0] Cross-app access token received")

  tokenStore.setToken("id_jag_token", data.accessToken)

  return data.accessToken
}

/**
 * Exchanges ID token for Auth0 access token via ID-JAG
 */
async function getAuth0AccessToken(): Promise<string> {
  const idToken = getAnyIdToken()
  if (!idToken) {
    throw new Error("Not authenticated. Please log in first.")
  }

  console.log("[v0] Requesting Auth0 access token via ID-JAG")

  const response = await fetch("/api/token-exchange/auth0", {
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
  console.log("[v0] Auth0 access token received")

  // Store both tokens
  tokenStore.setToken("id_jag_token", data.idJag)
  tokenStore.setToken("auth0_access_token", data.accessToken)

  return data.accessToken
}

/**
 * Fetches HR data from resource API
 */
export async function fetchHRData() {
  const accessToken = await getAccessToken()

  console.log("[v0] Fetching HR data from resource API")

  const response = await fetch("/api/resource/hr", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || "Failed to fetch HR data")
  }

  return await response.json()
}

/**
 * Fetches financial data from Auth0-protected resource API
 */
export async function fetchFinancialData() {
  const accessToken = await getAuth0AccessToken()

  console.log("[v0] Fetching financial data from Auth0-protected resource API")

  const response = await fetch("/api/resource/financial", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || "Failed to fetch financial data")
  }

  return await response.json()
}

/**
 * Fetches KPI data from resource API
 */
export async function fetchKPIData() {
  const accessToken = await getAccessToken()

  console.log("[v0] Fetching KPI data from resource API")

  const response = await fetch("/api/resource/kpi", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || "Failed to fetch KPI data")
  }

  return await response.json()
}
