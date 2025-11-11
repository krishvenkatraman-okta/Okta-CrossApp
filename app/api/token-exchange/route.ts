import { type NextRequest, NextResponse } from "next/server"
import { OKTA_CONFIG, OAUTH_ENDPOINTS } from "@/lib/okta-config"
import { createClientAssertion } from "@/lib/jwt-utils"

export async function POST(request: NextRequest) {
  try {
    const { idToken } = await request.json()

    if (!idToken) {
      return NextResponse.json({ error: "Missing idToken" }, { status: 400 })
    }

    const clientAssertion = await createClientAssertion()

    console.log("[v0] Token exchange request details:")
    console.log("[v0] Token endpoint:", OAUTH_ENDPOINTS.token)
    console.log("[v0] Audience:", OKTA_CONFIG.authServerIssuer)
    console.log("[v0] Scope:", OKTA_CONFIG.tokenExchangeScope)
    console.log("[v0] Client ID:", OKTA_CONFIG.clientId)
    console.log("[v0] Client assertion (first 50 chars):", clientAssertion.substring(0, 50))

    const requestBody = {
      grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
      requested_token_type: "urn:ietf:params:oauth:token-type:id-jag",
      subject_token: idToken,
      subject_token_type: "urn:ietf:params:oauth:token-type:id_token",
      client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
      client_assertion: clientAssertion,
      audience: OKTA_CONFIG.authServerIssuer,
      scope: OKTA_CONFIG.tokenExchangeScope,
    }

    console.log("[v0] Request body keys:", Object.keys(requestBody))

    const response = await fetch(OAUTH_ENDPOINTS.token, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(requestBody),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[v0] Token exchange failed:", errorText)
      return NextResponse.json({ error: "Token exchange failed", details: errorText }, { status: response.status })
    }

    const data = await response.json()
    console.log("[v0] Token exchange successful")

    return NextResponse.json({
      accessToken: data.access_token,
      tokenType: data.token_type,
      expiresIn: data.expires_in,
      scope: data.scope,
    })
  } catch (error) {
    console.error("[v0] Token exchange error:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
