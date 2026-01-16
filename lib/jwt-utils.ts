import { OKTA_CONFIG } from "./okta-config"

/**
 * Creates a JWT client assertion for client authentication
 * Based on Postman working implementation:
 * - iss and sub must be the principalId (agent principal ID)
 * - aud must be the token endpoint URL
 * - kid must come from the JWK
 */
export async function createClientAssertion(): Promise<string> {
  const now = Math.floor(Date.now() / 1000)

  const header = {
    kid: OKTA_CONFIG.privateKeyJWT.kid,
    alg: "RS256",
  }

  // For OAuth 2.0 client assertion in token exchange, iss and sub must be the agent principal ID
  const payload = {
    iss: OKTA_CONFIG.agentPrincipalId,
    aud: `${OKTA_CONFIG.orgDomain}/oauth2/v1/token`,
    sub: OKTA_CONFIG.agentPrincipalId,
    exp: now + 60,
    iat: now,
    jti: generateJti(),
  }

  console.log("[v0] Creating client assertion JWT")
  console.log("[v0] JWT Header:", JSON.stringify(header))
  console.log("[v0] JWT Payload:", JSON.stringify(payload))
  console.log("[v0] Using agentPrincipalId:", OKTA_CONFIG.agentPrincipalId)
  console.log("[v0] Using orgDomain:", OKTA_CONFIG.orgDomain)

  const encoder = new TextEncoder()

  // Import the private key
  const privateKey = await crypto.subtle.importKey(
    "jwk",
    OKTA_CONFIG.privateKeyJWT,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    true,
    ["sign"],
  )

  // Create the signature input
  const head = base64UrlEncode(encoder.encode(JSON.stringify(header)))
  const body = base64UrlEncode(encoder.encode(JSON.stringify(payload)))
  const signatureInput = head + "." + body

  // Sign the JWT
  const signature = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    privateKey,
    encoder.encode(signatureInput),
  )

  const sig = base64UrlEncode(signature)
  const jwt = signatureInput + "." + sig

  console.log("[v0] Client assertion created successfully")

  return jwt
}

/**
 * Base64 URL encode (matching Postman b64u function)
 */
function base64UrlEncode(input: ArrayBuffer | Uint8Array): string {
  const bytes = input instanceof ArrayBuffer ? new Uint8Array(input) : input

  const arr: string[] = []
  for (let i = 0; i < bytes.byteLength; i += 0x8000) {
    arr.push(String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 0x8000))))
  }
  return btoa(arr.join("")).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_")
}

/**
 * Generates a unique JWT ID (matching Postman: pm.variables.replaceIn('{{$randomUUID}}'))
 */
function generateJti(): string {
  // Generate UUID v4 format
  const array = new Uint8Array(16)
  crypto.getRandomValues(array)

  // Set version (4) and variant (8, 9, a, or b)
  array[6] = (array[6] & 0x0f) | 0x40
  array[8] = (array[8] & 0x3f) | 0x80

  const hex = Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
