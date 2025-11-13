"use client"

import { OKTA_WEB_CLIENT_CONFIG, OKTA_WEB_ENDPOINTS } from "./okta-config"
import { tokenStore } from "./token-store"

export interface WebAuthTokens {
  accessToken: string
  idToken: string
  refreshToken?: string
  expiresIn: number
}

/**
 * Generates a random state parameter for CSRF protection
 */
function generateState(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("")
}

/**
 * Initiates Okta login with Authorization Code flow (no PKCE)
 * Uses client_secret for token exchange on server side
 */
export async function initiateWebLogin(redirectUri: string): Promise<void> {
  const state = generateState()
  const nonce = generateState()

  // Store state and nonce for validation
  sessionStorage.setItem("web_auth_state", state)
  sessionStorage.setItem("web_auth_nonce", nonce)

  // Build authorization URL (no code_challenge)
  const params = new URLSearchParams({
    client_id: OKTA_WEB_CLIENT_CONFIG.clientId,
    response_type: "code",
    scope: OKTA_WEB_CLIENT_CONFIG.scope,
    redirect_uri: redirectUri,
    state: state,
    nonce: nonce,
  })

  const authUrl = `${OKTA_WEB_ENDPOINTS.authorization}?${params.toString()}`
  window.location.href = authUrl
}

/**
 * Handles OAuth callback and exchanges code for tokens (server-side with client_secret)
 */
export async function handleWebCallback(code: string, state: string, redirectUri: string): Promise<WebAuthTokens> {
  // Verify state parameter
  const storedState = sessionStorage.getItem("web_auth_state")
  if (!storedState || storedState !== state) {
    throw new Error("Invalid state parameter")
  }

  const response = await fetch("/api/auth/web-callback", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      code,
      redirectUri,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Token exchange failed: ${JSON.stringify(error)}`)
  }

  const tokens = await response.json()

  // Clear state and nonce
  sessionStorage.removeItem("web_auth_state")
  sessionStorage.removeItem("web_auth_nonce")

  return {
    accessToken: tokens.accessToken,
    idToken: tokens.idToken,
    refreshToken: tokens.refreshToken,
    expiresIn: tokens.expiresIn,
  }
}

/**
 * Stores web auth tokens
 */
export function storeWebTokens(tokens: WebAuthTokens): void {
  tokenStore.setToken("web_id_token", tokens.idToken)
  tokenStore.setToken("web_access_token", tokens.accessToken)

  sessionStorage.setItem("web_okta_id_token", tokens.idToken)
  sessionStorage.setItem("web_okta_access_token", tokens.accessToken)
  if (tokens.refreshToken) {
    sessionStorage.setItem("web_okta_refresh_token", tokens.refreshToken)
  }
  sessionStorage.setItem("web_okta_token_expires", String(Date.now() + tokens.expiresIn * 1000))
}

/**
 * Retrieves stored web auth ID token
 */
export function getWebIdToken(): string | null {
  return sessionStorage.getItem("web_okta_id_token")
}

/**
 * Clears all web auth tokens
 */
export function clearWebTokens(): void {
  sessionStorage.removeItem("web_okta_id_token")
  sessionStorage.removeItem("web_okta_access_token")
  sessionStorage.removeItem("web_okta_refresh_token")
  sessionStorage.removeItem("web_okta_token_expires")
}

/**
 * Checks if web auth user is authenticated
 */
export function isWebAuthenticated(): boolean {
  const idToken = getWebIdToken()
  const expires = sessionStorage.getItem("web_okta_token_expires")

  if (!idToken || !expires) {
    return false
  }

  return Date.now() < Number.parseInt(expires)
}
