import { getWebIdToken } from "./web-auth-client"
import { tokenStore } from "./token-store"

export interface GatewayConfig {
  enabled: boolean
  url: string
}

export const GATEWAY_CONFIG: GatewayConfig = {
  enabled: process.env.GATEWAY_MODE === "true",
  url: process.env.GATEWAY_URL || "",
}

export interface GatewayError {
  error: string
  message?: string
}

export interface ConnectedAccountRequest {
  connection: string
  redirect_uri: string
  state: string
  scopes: string[]
}

export interface ConnectedAccountResponse {
  auth_session: string
  connect_uri: string
  connect_params: {
    ticket: string
  }
  expires_in: number
}

export interface CompleteConnectionRequest {
  auth_session: string
  connect_code: string
  redirect_uri: string
}

/**
 * Makes a request through the gateway with Auth0 access token
 */
export async function makeGatewayRequest(
  endpoint: string,
  gatewayHost: string,
  auth0AccessToken: string,
  options: RequestInit = {}
): Promise<Response> {
  if (!GATEWAY_CONFIG.enabled) {
    throw new Error("Gateway mode is not enabled")
  }

  const url = `${GATEWAY_CONFIG.url}${endpoint}`

  console.log("[v0] Gateway request:", url)
  console.log("[v0] Gateway host:", gatewayHost)

  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${auth0AccessToken}`,
      "X-GATEWAY-Host": gatewayHost,
    },
  })

  return response
}

/**
 * Request ID-JAG for Auth0 /me/ API access
 */
async function requestMeIdJag(): Promise<string> {
  const idToken = getWebIdToken()
  if (!idToken) {
    throw new Error("Not authenticated")
  }

  const auth0Domain = process.env.AUTH0_AUDIENCE || ""
  const meResource = `https://${auth0Domain}/me/`

  console.log("[v0] Requesting ID-JAG for /me/ API")
  console.log("[v0] Resource:", meResource)

  const response = await fetch("/api/token-exchange/me", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      idToken,
      resource: meResource,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || "Failed to get /me/ ID-JAG")
  }

  const data = await response.json()
  console.log("[v0] /me/ ID-JAG received")

  return data.idJag
}

/**
 * Exchange ID-JAG for Auth0 access token with specific scope
 */
async function exchangeForMeToken(idJag: string, scope: string): Promise<string> {
  const auth0TokenEndpoint = process.env.AUTH0_TOKEN_ENDPOINT || ""
  const clientId = process.env.AUTH0_REQUESTING_APP_CLIENT_ID || ""
  const clientSecret = process.env.AUTH0_REQUESTING_APP_CLIENT_SECRET || ""

  console.log("[v0] Exchanging ID-JAG for /me/ access token")
  console.log("[v0] Scope:", scope)

  const params = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: idJag,
    client_id: clientId,
    client_secret: clientSecret,
    scope,
  })

  const response = await fetch(auth0TokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error_description || "Failed to exchange for /me/ token")
  }

  const data = await response.json()
  console.log("[v0] /me/ access token received")

  return data.access_token
}

/**
 * Create a connected account
 */
export async function createConnectedAccount(
  connection: string,
  redirectUri: string,
  scopes: string[]
): Promise<ConnectedAccountResponse> {
  console.log("[v0] Creating connected account:", connection)

  // Step 1: Get ID-JAG for /me/ API
  const idJag = await requestMeIdJag()
  tokenStore.setToken("me_id_jag_token", idJag)

  // Step 2: Exchange for access token with create:me:connected_accounts scope
  const meToken = await exchangeForMeToken(idJag, "create:me:connected_accounts")
  tokenStore.setToken("me_access_token", meToken)

  // Step 3: Create connected account
  const auth0Domain = process.env.AUTH0_AUDIENCE || ""
  const state = crypto.randomUUID()

  const response = await fetch(`https://${auth0Domain}/me/v1/connected-accounts/connect`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${meToken}`,
    },
    body: JSON.stringify({
      connection,
      redirect_uri: redirectUri,
      state,
      scopes,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || "Failed to create connected account")
  }

  const data = await response.json()
  console.log("[v0] Connected account initiated")

  // Store auth_session for later
  tokenStore.setToken("auth_session", data.auth_session)

  return data
}

/**
 * Complete the connected account flow
 */
export async function completeConnectedAccount(
  authSession: string,
  connectCode: string,
  redirectUri: string
): Promise<any> {
  console.log("[v0] Completing connected account")

  const meToken = tokenStore.getToken("me_access_token")
  if (!meToken) {
    throw new Error("No /me/ access token found")
  }

  const auth0Domain = process.env.AUTH0_AUDIENCE || ""

  const response = await fetch(`https://${auth0Domain}/me/v1/connected-accounts/complete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${meToken}`,
    },
    body: JSON.stringify({
      auth_session: authSession,
      connect_code: connectCode,
      redirect_uri: redirectUri,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || "Failed to complete connected account")
  }

  const data = await response.json()
  console.log("[v0] Connected account completed")

  return data
}

/**
 * Handle gateway request with connected account flow
 */
export async function makeGatewayRequestWithFallback(
  endpoint: string,
  gatewayHost: string,
  auth0AccessToken: string,
  connection: string,
  options: RequestInit = {}
): Promise<any> {
  // Try the gateway request
  const response = await makeGatewayRequest(endpoint, gatewayHost, auth0AccessToken, options)

  // Check for connected account error
  if (!response.ok) {
    const error: GatewayError = await response.json()

    if (error.error === "federated_connection_refresh_token_not_found") {
      console.log("[v0] Connected account not found, initiating connection flow")

      // Initiate connected account flow
      const connectData = await createConnectedAccount(
        connection,
        `${window.location.origin}/agent/connect-callback`,
        ["openid", "profile"]
      )

      // Return connection data to trigger UI flow
      return {
        requiresConnection: true,
        connectUri: connectData.connect_uri,
        ticket: connectData.connect_params.ticket,
        authSession: connectData.auth_session,
      }
    }

    throw new Error(error.message || "Gateway request failed")
  }

  return await response.json()
}
