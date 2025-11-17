import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const { idToken, resource } = await request.json()

    if (!idToken) {
      return NextResponse.json({ message: "ID token is required" }, { status: 400 })
    }

    const oktaTokenEndpoint = process.env.OKTA_WEB_ORG_DOMAIN
      ? `${process.env.OKTA_WEB_ORG_DOMAIN}/oauth2/v1/token`
      : ""
    const clientId = process.env.OKTA_REQUESTING_APP_CLIENT_ID || ""
    const clientSecret = process.env.OKTA_REQUESTING_APP_CLIENT_SECRET || ""
    const audience = process.env.AUTH0_AUDIENCE || ""

    console.log("[v0] Requesting ID-JAG for /me/ API")
    console.log("[v0] Resource:", resource)
    console.log("[v0] Audience:", audience)

    // Request ID-JAG from Okta
    const params = new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
      requested_token_type: "urn:ietf:params:oauth:token-type:id-jag",
      audience,
      resource,
      subject_token: idToken,
      subject_token_type: "urn:ietf:params:oauth:token-type:id_token",
      client_id: clientId,
      client_secret: clientSecret,
    })

    const response = await fetch(oktaTokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[v0] Okta ID-JAG request failed:", errorText)
      return NextResponse.json(
        { message: "Failed to get ID-JAG from Okta", details: errorText },
        { status: response.status }
      )
    }

    const data = await response.json()
    console.log("[v0] ID-JAG for /me/ received")

    return NextResponse.json({
      idJag: data.access_token,
    })
  } catch (error: any) {
    console.error("[v0] Token exchange error:", error)
    return NextResponse.json({ message: error.message || "Internal server error" }, { status: 500 })
  }
}
