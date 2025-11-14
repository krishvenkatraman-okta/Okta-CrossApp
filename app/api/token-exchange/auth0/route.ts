import { type NextRequest, NextResponse } from "next/server"
import { OKTA_WEB_ENDPOINTS } from "@/lib/okta-config"

export async function POST(request: NextRequest) {
  try {
    const { idToken } = await request.json()

    if (!idToken) {
      return NextResponse.json({ error: "Missing idToken" }, { status: 400 })
    }

    const oktaRequestingClientId = process.env.OKTA_REQUESTING_APP_CLIENT_ID
    const oktaRequestingClientSecret = process.env.OKTA_REQUESTING_APP_CLIENT_SECRET
    const auth0Audience = process.env.AUTH0_AUDIENCE
    const auth0Resource = process.env.AUTH0_RESOURCE
    const auth0Scope = process.env.AUTH0_SCOPE || "finance:read"
    const auth0TokenEndpoint = process.env.AUTH0_TOKEN_ENDPOINT

    if (!oktaRequestingClientId || !oktaRequestingClientSecret) {
      return NextResponse.json(
        { error: "Missing Okta requesting app credentials" },
        { status: 500 }
      )
    }

    if (!auth0Audience || !auth0Resource || !auth0TokenEndpoint) {
      return NextResponse.json(
        { error: "Missing Auth0 configuration" },
        { status: 500 }
      )
    }

    console.log("[v0] Step 1: Requesting ID-JAG from Web Client Okta tenant for Auth0 audience")

    // Step 1: Exchange Web Client ID token for ID-JAG from Web Client Okta tenant
    const jagRequestBody = {
      grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
      requested_token_type: "urn:ietf:params:oauth:token-type:id-jag",
      audience: auth0Audience,
      resource: auth0Resource,
      subject_token: idToken,
      subject_token_type: "urn:ietf:params:oauth:token-type:id_token",
      client_id: oktaRequestingClientId,
      client_secret: oktaRequestingClientSecret,
      scope: auth0Scope,
    }

    console.log("[v0] JAG request to:", OKTA_WEB_ENDPOINTS.token)
    console.log("[v0] JAG request - audience:", auth0Audience)
    console.log("[v0] JAG request - resource:", auth0Resource)
    console.log("[v0] JAG request - scope:", auth0Scope)

    const jagResponse = await fetch(OKTA_WEB_ENDPOINTS.token, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(jagRequestBody),
    })

    if (!jagResponse.ok) {
      const errorText = await jagResponse.text()
      console.error("[v0] ID-JAG exchange failed:", errorText)
      return NextResponse.json(
        { error: "ID-JAG exchange failed", details: errorText },
        { status: jagResponse.status }
      )
    }

    const jagData = await jagResponse.json()
    const idJag = jagData.access_token
    console.log("[v0] Step 1 complete: ID-JAG received from Okta")
    console.log("[v0] ID-JAG token:", idJag.substring(0, 50) + "...")

    // Step 2: Exchange ID-JAG for Auth0 access token
    console.log("[v0] Step 2: Exchanging ID-JAG for Auth0 access token")

    const auth0RequestingClientId = process.env.AUTH0_REQUESTING_APP_CLIENT_ID
    const auth0RequestingClientSecret = process.env.AUTH0_REQUESTING_APP_CLIENT_SECRET

    if (!auth0RequestingClientId || !auth0RequestingClientSecret) {
      return NextResponse.json(
        { error: "Missing Auth0 requesting app credentials" },
        { status: 500 }
      )
    }

    const auth0RequestBody = {
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: idJag,
      client_id: auth0RequestingClientId,
      client_secret: auth0RequestingClientSecret,
    }

    console.log("[v0] Auth0 token endpoint:", auth0TokenEndpoint)
    console.log("[v0] Auth0 client_id:", auth0RequestingClientId)
    console.log("[v0] Auth0 assertion (JAG):", idJag.substring(0, 50) + "...")

    const auth0Response = await fetch(auth0TokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(auth0RequestBody),
    })

    console.log("[v0] Auth0 response status:", auth0Response.status)

    if (!auth0Response.ok) {
      const errorText = await auth0Response.text()
      console.error("[v0] Auth0 token exchange failed:")
      console.error("[v0] Status:", auth0Response.status)
      console.error("[v0] Response:", errorText)
      return NextResponse.json(
        { error: "Auth0 token exchange failed", details: errorText },
        { status: auth0Response.status }
      )
    }

    const auth0Data = await auth0Response.json()
    console.log("[v0] Step 2 complete: Auth0 access token received")
    console.log("[v0] Auth0 token data:", { 
      hasAccessToken: !!auth0Data.access_token, 
      tokenType: auth0Data.token_type,
      scope: auth0Data.scope 
    })

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
      { status: 500 }
    )
  }
}
