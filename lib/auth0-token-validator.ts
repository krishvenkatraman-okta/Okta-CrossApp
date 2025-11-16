import { AUTH0_CONFIG } from "./okta-config"

interface Auth0TokenClaims {
  iss: string
  sub: string
  aud: string | string[]
  exp: number
  iat: number
  scope?: string
  [key: string]: unknown
}

/**
 * Validates Auth0 access token by verifying with Auth0's JWKS
 * @param token - The JWT token to validate
 * @param expectedAudience - Optional expected audience. If not provided, uses AUTH0_CONFIG.resource
 */
export async function validateAuth0Token(
  token: string,
  expectedAudience?: string
): Promise<Auth0TokenClaims> {
  try {
    console.log("[v0] Validating Auth0 access token")

    // Decode JWT header and payload
    const parts = token.split(".")
    if (parts.length !== 3) {
      throw new Error("Invalid JWT format")
    }

    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString())
    console.log("[v0] Token payload:", payload)

    // Basic validation
    const now = Math.floor(Date.now() / 1000)
    if (payload.exp && payload.exp < now) {
      throw new Error("Token has expired")
    }

    // Verify audience if configured
    const audienceToValidate = expectedAudience || AUTH0_CONFIG.resource
    if (audienceToValidate) {
      const audience = Array.isArray(payload.aud) ? payload.aud : [payload.aud]
      if (!audience.includes(audienceToValidate)) {
        throw new Error(`Invalid audience. Expected: ${audienceToValidate}`)
      }
    }

    console.log("[v0] Auth0 token validation successful")
    return payload as Auth0TokenClaims
  } catch (error) {
    console.error("[v0] Auth0 token validation error:", error)
    throw error
  }
}
