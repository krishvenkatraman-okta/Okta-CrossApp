import { type NextRequest, NextResponse } from "next/server"
import { OAUTH_ENDPOINTS, AUTH0_CONFIG, OKTA_CAA_CONFIG } from "@/lib/okta-config"

export async function POST(request: NextRequest) {
  try {
    const { idToken } = await request.json()

    if (!idToken) {
      return NextResponse.json({ error: "Missing idToken" }, { status: 400 })
    }

    console.log("[v0] Step 1: Requesting ID-JAG from Okta for Auth0 audience")

    // Step 1: Exchange Okta ID token for ID-JAG
    const jagRequestBody = {
      grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
      requested_token_type: "urn:ietf:params:oauth:token-type:id-jag",
      audience: AUTH0_CONFIG.audience,
      resource: AUTH0_CONFIG.resource,
      subject_token: idToken,
      subject_token_type: "urn:ietf:params:oauth:token-type:id_token",
      client_id: OKTA_CAA_CONFIG.clientId,
      client_secret: OKTA_CAA_CONFIG.clientSecret,
    }

    console.log("[v0] JAG request - audience:", AUTH0_CONFIG.audience)
    console.log("[v0] JAG request - resource:", AUTH0_CONFIG.resource)

    const jagResponse = await fetch(OAUTH_ENDPOINTS.token, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(jagRequestBody),
    })

    if (!jagResponse.ok) {
      const errorText = await jagResponse.text()
      console.error("[v0] ID-JAG exchange failed:", errorText)
      return NextResponse.json({ error: "ID-JAG exchange failed", details: errorText }, { status: jagResponse.status })
    }

    const jagData = await jagResponse.json()
    const idJag = jagData.access_token
    console.log("[v0] Step 1 complete: ID-JAG received from Okta")

    // Step 2: Exchange ID-JAG for Auth0 access token
    console.log("[v0] Step 2: Exchanging ID-JAG for Auth0 access token")

    const auth0RequestBody = {
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      client_id: AUTH0_CONFIG.clientId,
      client_secret: AUTH0_CONFIG.clientSecret,
      scope: AUTH0_CONFIG.scope,
      assertion: idJag,
    }

    console.log("[v0] Auth0 token endpoint:", AUTH0_CONFIG.tokenEndpoint)
    console.log("[v0] Auth0 scope:", AUTH0_CONFIG.scope)

    const auth0Response = await fetch(AUTH0_CONFIG.tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(auth0RequestBody),
    })

    if (!auth0Response.ok) {
      const errorText = await auth0Response.text()
      console.error("[v0] Auth0 token exchange failed:", errorText)
      return NextResponse.json(
        { error: "Auth0 token exchange failed", details: errorText },
        { status: auth0Response.status },
      )
    }

    const auth0Data = await auth0Response.json()
    console.log("[v0] Step 2 complete: Auth0 access token received")

    return NextResponse.json({
      accessToken: auth0Data.access_token,
      tokenType: auth0Data.token_type,
      expiresIn: auth0Data.expires_in,
      scope: auth0Data.scope,
      idJag: idJag,
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
