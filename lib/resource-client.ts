"use client"

import { getIdToken } from "./auth-client"

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
 * Exchanges ID token for access token (ID-JAG)
 */
async function getAccessToken(): Promise<string> {
  const idToken = getIdToken()
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
 * Fetches financial data from resource API
 */
export async function fetchFinancialData() {
  const accessToken = await getAccessToken()

  console.log("[v0] Fetching financial data from resource API")

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
