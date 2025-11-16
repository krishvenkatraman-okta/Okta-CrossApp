"use client"

import { getIdToken } from "./auth-client"
import { getWebIdToken, isWebAuthenticated } from "./web-auth-client"
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
 * Gets ID token from PKCE auth only (for HR and KPI)
 */
function getPKCEIdToken(): string | null {
  return getIdToken()
}

/**
 * Gets ID token from Web auth only (for Finance)
 */
function getWebClientIdToken(): string | null {
  return getWebIdToken()
}

/**
 * Exchanges ID token for access token (ID-JAG) - PKCE flow only
 */
async function getAccessToken(): Promise<string> {
  const idToken = getPKCEIdToken()
  if (!idToken) {
    throw new Error("Not authenticated. Please log in with PKCE flow first.")
  }

  console.log("[v0] Requesting cross-app access token (PKCE)")

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
  console.log("[v0] Cross-app access token received (PKCE)")

  tokenStore.setToken("id_jag_token", data.accessToken)

  return data.accessToken
}

/**
 * Exchanges Web Client ID token for Auth0 access token via ID-JAG
 */
async function getAuth0AccessToken(): Promise<string> {
  const idToken = getWebClientIdToken()
  if (!idToken) {
    throw new Error("Not authenticated. Please log in with Finance API Demo flow first.")
  }

  console.log("[v0] Requesting Auth0 access token via ID-JAG (Web Client)")

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
 * Exchanges Web Client ID token for Auth0 access token via ID-JAG for Salesforce
 */
async function getSalesforceAuth0AccessToken(): Promise<string> {
  const idToken = getWebClientIdToken()
  if (!idToken) {
    throw new Error("Not authenticated. Please log in with Finance API Demo flow first.")
  }

  console.log("[v0] Requesting Auth0 access token via ID-JAG for Salesforce (Web Client)")

  const response = await fetch("/api/token-exchange/auth0", {
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
  console.log("[v0] Auth0 access token received for Salesforce")

  // Store both tokens with salesforce prefix
  tokenStore.setToken("salesforce_id_jag_token", data.idJag)
  tokenStore.setToken("salesforce_auth0_access_token", data.accessToken)

  return data.accessToken
}

/**
 * Fetches HR data from resource API - PKCE flow only
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
 * Fetches financial data from Auth0-protected resource API - Web Client flow only
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
 * Fetches KPI data from resource API - PKCE flow only
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

/**
 * Fetches Salesforce data from Auth0-protected resource API - Web Client flow only
 */
export async function fetchSalesforceData() {
  const accessToken = await getSalesforceAuth0AccessToken()

  console.log("[v0] Fetching Salesforce data from Auth0-protected resource API")

  const response = await fetch("/api/resource/salesforce", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || "Failed to fetch Salesforce data")
  }

  return await response.json()
}

/**
 * Check which auth method is active
 */
export function getAuthMethod(): "pkce" | "web" | null {
  if (getPKCEIdToken()) return "pkce"
  if (isWebAuthenticated()) return "web"
  return null
}
