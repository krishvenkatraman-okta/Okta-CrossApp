"use client"

import { OKTA_CONFIG, OAUTH_ENDPOINTS } from "./okta-config"
import { generateCodeVerifier, generateCodeChallenge, generateState } from "./pkce"
import { tokenStore } from "./token-store"

export interface AuthTokens {
  accessToken: string
  idToken: string
  refreshToken?: string
  expiresIn: number
}

/**
 * Initiates Okta login with Authorization Code + PKCE flow
 */
export async function initiateLogin(redirectUri: string): Promise<void> {
  // Generate PKCE parameters
  const codeVerifier = generateCodeVerifier()
  const codeChallenge = await generateCodeChallenge(codeVerifier)
  const state = generateState()
  const nonce = generateState()

  // Store in sessionStorage for callback
  sessionStorage.setItem("pkce_code_verifier", codeVerifier)
  sessionStorage.setItem("pkce_state", state)
  sessionStorage.setItem("pkce_nonce", nonce)

  // Build authorization URL
  const params = new URLSearchParams({
    client_id: OKTA_CONFIG.clientId,
    response_type: "code",
    scope: OKTA_CONFIG.scope,
    redirect_uri: redirectUri,
    state: state,
    nonce: nonce,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  })

  const authUrl = `${OAUTH_ENDPOINTS.authorization}?${params.toString()}`
  window.location.href = authUrl
}

/**
 * Handles OAuth callback and exchanges code for tokens
 */
export async function handleCallback(code: string, state: string, redirectUri: string): Promise<AuthTokens> {
  // Verify state parameter
  const storedState = sessionStorage.getItem("pkce_state")
  if (!storedState || storedState !== state) {
    throw new Error("Invalid state parameter")
  }

  // Get code verifier
  const codeVerifier = sessionStorage.getItem("pkce_code_verifier")
  if (!codeVerifier) {
    throw new Error("Missing code verifier")
  }

  const response = await fetch("/api/auth/callback", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      code,
      codeVerifier,
      redirectUri,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Token exchange failed: ${JSON.stringify(error)}`)
  }

  const tokens = await response.json()

  // Clear PKCE data
  sessionStorage.removeItem("pkce_code_verifier")
  sessionStorage.removeItem("pkce_state")
  sessionStorage.removeItem("pkce_nonce")

  return {
    accessToken: tokens.accessToken,
    idToken: tokens.idToken,
    refreshToken: tokens.refreshToken,
    expiresIn: tokens.expiresIn,
  }
}

/**
 * Stores tokens in sessionStorage
 */
export function storeTokens(tokens: AuthTokens): void {
  tokenStore.setToken("id_token", tokens.idToken)
  tokenStore.setToken("access_token", tokens.accessToken)

  sessionStorage.setItem("okta_id_token", tokens.idToken)
  sessionStorage.setItem("okta_access_token", tokens.accessToken)
  if (tokens.refreshToken) {
    sessionStorage.setItem("okta_refresh_token", tokens.refreshToken)
  }
  sessionStorage.setItem("okta_token_expires", String(Date.now() + tokens.expiresIn * 1000))
}

/**
 * Retrieves stored ID token
 */
export function getIdToken(): string | null {
  return sessionStorage.getItem("okta_id_token")
}

/**
 * Clears all stored tokens
 */
export function clearTokens(): void {
  tokenStore.clearTokens()

  sessionStorage.removeItem("okta_id_token")
  sessionStorage.removeItem("okta_access_token")
  sessionStorage.removeItem("okta_refresh_token")
  sessionStorage.removeItem("okta_token_expires")
}

/**
 * Checks if user is authenticated
 */
export function isAuthenticated(): boolean {
  const idToken = getIdToken()
  const expires = sessionStorage.getItem("okta_token_expires")

  if (!idToken || !expires) {
    return false
  }

  return Date.now() < Number.parseInt(expires)
}
