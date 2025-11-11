import { OKTA_CONFIG } from "./okta-config"

/**
 * Creates a JWT client assertion for client authentication
 */
export async function createClientAssertion(audience: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000)

  const header = {
    alg: "RS256",
    kid: OKTA_CONFIG.privateKeyJWT.kid,
    typ: "JWT",
  }

  const payload = {
    iss: OKTA_CONFIG.clientId,
    sub: OKTA_CONFIG.clientId,
    aud: audience,
    iat: now,
    exp: now + 300, // 5 minutes
    jti: generateJti(),
  }

  const headerB64 = base64UrlEncode(JSON.stringify(header))
  const payloadB64 = base64UrlEncode(JSON.stringify(payload))
  const signatureInput = `${headerB64}.${payloadB64}`

  // Import the private key
  const privateKey = await importPrivateKey(OKTA_CONFIG.privateKeyJWT)

  // Sign the JWT
  const signature = await signJWT(signatureInput, privateKey)
  const signatureB64 = arrayBufferToBase64Url(signature)

  return `${signatureInput}.${signatureB64}`
}

/**
 * Imports the private key for signing
 */
async function importPrivateKey(jwk: any): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    "jwk",
    jwk,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["sign"],
  )
}

/**
 * Signs the JWT
 */
async function signJWT(data: string, privateKey: CryptoKey): Promise<ArrayBuffer> {
  const encoder = new TextEncoder()
  const dataBuffer = encoder.encode(data)
  return await crypto.subtle.sign("RSASSA-PKCS1-v1_5", privateKey, dataBuffer)
}

/**
 * Base64 URL encode a string
 */
function base64UrlEncode(str: string): string {
  const base64 = btoa(unescape(encodeURIComponent(str)))
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "")
}

/**
 * Convert ArrayBuffer to Base64 URL
 */
function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ""
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  const base64 = btoa(binary)
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "")
}

/**
 * Generates a unique JWT ID
 */
function generateJti(): string {
  const array = new Uint8Array(16)
  crypto.getRandomValues(array)
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("")
}
