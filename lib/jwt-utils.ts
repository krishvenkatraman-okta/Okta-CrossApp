import { OKTA_CONFIG } from "./okta-config"

/**
 * Creates a JWT client assertion for client authentication
 */
export async function createClientAssertion(): Promise<string> {
  const now = Math.floor(Date.now() / 1000)

  const header = {
    kid: OKTA_CONFIG.privateKeyJWT.kid,
    alg: "RS256",
  }

  // For OAuth 2.0 client assertion, iss and sub must be the client_id
  const payload = {
    iss: OKTA_CONFIG.clientId,
    aud: `${OKTA_CONFIG.orgDomain}/oauth2/v1/token`,
    sub: OKTA_CONFIG.clientId,
    exp: now + 60,
    iat: now,
    jti: generateJti(),
  }

  console.log("[v0] Creating client assertion JWT")
  console.log("[v0] JWT Payload:", payload)

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

  console.log("[v0] Client assertion created")

  return jwt
}

/**
 * Base64 URL encode
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
 * Generates a unique JWT ID
 */
function generateJti(): string {
  const array = new Uint8Array(16)
  crypto.getRandomValues(array)
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("")
}
