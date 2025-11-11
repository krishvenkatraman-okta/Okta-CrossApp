import { OKTA_CONFIG, OAUTH_ENDPOINTS } from "./okta-config"

interface JWK {
  kty: string
  use?: string
  kid: string
  n: string
  e: string
  alg?: string
}

interface JWKS {
  keys: JWK[]
}

interface TokenClaims {
  jti: string
  iss: string
  aud: string
  iat: number
  exp: number
  sub: string
  client_id: string
  scope: string
}

// Cache for JWKS
let jwksCache: JWKS | null = null
let jwksCacheTime = 0
const JWKS_CACHE_TTL = 3600000 // 1 hour

/**
 * Fetches JWKS from Okta authorization server
 */
async function fetchJWKS(): Promise<JWKS> {
  const now = Date.now()

  // Return cached JWKS if still valid
  if (jwksCache && now - jwksCacheTime < JWKS_CACHE_TTL) {
    return jwksCache
  }

  const response = await fetch(OAUTH_ENDPOINTS.jwks)
  if (!response.ok) {
    throw new Error("Failed to fetch JWKS")
  }

  jwksCache = await response.json()
  jwksCacheTime = now
  return jwksCache!
}

/**
 * Converts base64url to ArrayBuffer
 */
function base64UrlToArrayBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/")
  const padding = "=".repeat((4 - (base64.length % 4)) % 4)
  const binaryString = atob(base64 + padding)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes.buffer
}

/**
 * Imports a JWK as a CryptoKey for verification
 */
async function importJWK(jwk: JWK): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    "jwk",
    {
      kty: jwk.kty,
      n: jwk.n,
      e: jwk.e,
      alg: jwk.alg || "RS256",
      use: jwk.use || "sig",
      kid: jwk.kid,
    },
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["verify"],
  )
}

/**
 * Decodes JWT without verification
 */
function decodeToken(token: string): { header: any; payload: TokenClaims } {
  const parts = token.split(".")
  if (parts.length !== 3) {
    throw new Error("Invalid JWT format")
  }

  const header = JSON.parse(new TextDecoder().decode(base64UrlToArrayBuffer(parts[0])))
  const payload = JSON.parse(new TextDecoder().decode(base64UrlToArrayBuffer(parts[1])))

  return { header, payload }
}

/**
 * Verifies JWT signature using JWKS
 */
async function verifySignature(token: string, jwks: JWKS): Promise<boolean> {
  const parts = token.split(".")
  const { header } = decodeToken(token)

  // Find the matching key
  const jwk = jwks.keys.find((k) => k.kid === header.kid)
  if (!jwk) {
    throw new Error("No matching key found in JWKS")
  }

  // Import the key
  const cryptoKey = await importJWK(jwk)

  // Verify signature
  const signedData = new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
  const signature = base64UrlToArrayBuffer(parts[2])

  return await crypto.subtle.verify("RSASSA-PKCS1-v1_5", cryptoKey, signature, signedData)
}

/**
 * Validates an Okta access token
 */
export async function validateAccessToken(token: string): Promise<TokenClaims> {
  // Decode token
  const { payload, header } = decodeToken(token)

  console.log("[v0] Validating token with kid:", header.kid)
  console.log("[v0] Token issuer:", payload.iss)
  console.log("[v0] Token audience:", payload.aud)
  console.log("[v0] Token client_id:", payload.client_id)
  console.log("[v0] Fetching JWKS from:", OAUTH_ENDPOINTS.jwks)

  // Validate issuer
  if (payload.iss !== OKTA_CONFIG.orgDomain) {
    throw new Error("Invalid issuer")
  }

  // Validate audience
  if (payload.aud !== OKTA_CONFIG.authServerIssuer) {
    throw new Error("Invalid audience")
  }

  // Validate expiration
  const now = Math.floor(Date.now() / 1000)
  if (payload.exp < now) {
    throw new Error("Token expired")
  }

  // Validate issued at time (not in future)
  if (payload.iat > now + 60) {
    throw new Error("Token issued in future")
  }

  // Fetch JWKS and verify signature
  const jwks = await fetchJWKS()
  console.log(
    "[v0] Available key IDs in JWKS:",
    jwks.keys.map((k) => k.kid),
  )

  const isValid = await verifySignature(token, jwks)

  if (!isValid) {
    throw new Error("Invalid signature")
  }

  return payload
}
