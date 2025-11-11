import { type NextRequest, NextResponse } from "next/server"
import { OKTA_CONFIG, OAUTH_ENDPOINTS } from "@/lib/okta-config"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { code, codeVerifier, redirectUri } = body

    if (!code || !codeVerifier || !redirectUri) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 })
    }

    // Exchange code for tokens on the server
    const response = await fetch(OAUTH_ENDPOINTS.token, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: code,
        redirect_uri: redirectUri,
        client_id: OKTA_CONFIG.clientId,
        client_secret: OKTA_CONFIG.clientSecret,
        code_verifier: codeVerifier,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error("[v0] Token exchange failed:", error)
      return NextResponse.json({ error: "Token exchange failed", details: error }, { status: response.status })
    }

    const tokens = await response.json()

    return NextResponse.json({
      accessToken: tokens.access_token,
      idToken: tokens.id_token,
      refreshToken: tokens.refresh_token,
      expiresIn: tokens.expires_in,
    })
  } catch (error) {
    console.error("[v0] Callback API error:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
