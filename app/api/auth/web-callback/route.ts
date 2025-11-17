import { type NextRequest, NextResponse } from "next/server"
import { OKTA_WEB_CLIENT_CONFIG, OKTA_WEB_ENDPOINTS } from "@/lib/okta-config"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { code, redirectUri } = body

    if (!code || !redirectUri) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 })
    }

    console.log("[v0] Web auth token exchange starting")
    console.log("[v0] Token endpoint:", OKTA_WEB_ENDPOINTS.token)

    // Exchange code for tokens on the server (no PKCE, uses client_secret)
    const response = await fetch(OKTA_WEB_ENDPOINTS.token, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: code,
        redirect_uri: redirectUri,
        client_id: OKTA_WEB_CLIENT_CONFIG.clientId,
        client_secret: OKTA_WEB_CLIENT_CONFIG.clientSecret,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error("[v0] Web auth token exchange failed:", error)
      return NextResponse.json({ error: "Token exchange failed", details: error }, { status: response.status })
    }

    const tokens = await response.json()

    console.log("[v0] Web auth token exchange successful")

    const responseData = NextResponse.json({
      accessToken: tokens.access_token,
      idToken: tokens.id_token,
      refreshToken: tokens.refresh_token,
      expiresIn: tokens.expires_in,
    })

    // Set HTTP-only cookies so server routes can access tokens
    responseData.cookies.set("web_okta_id_token", tokens.id_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: tokens.expires_in,
      path: "/",
    })

    responseData.cookies.set("web_okta_access_token", tokens.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: tokens.expires_in,
      path: "/",
    })

    if (tokens.refresh_token) {
      responseData.cookies.set("web_okta_refresh_token", tokens.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: "/",
      })
    }

    console.log("[v0] Cookies set successfully")

    return responseData
  } catch (error) {
    console.error("[v0] Web callback API error:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
