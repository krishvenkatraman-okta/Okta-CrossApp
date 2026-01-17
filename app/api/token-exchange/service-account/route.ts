import { type NextRequest, NextResponse } from "next/server"
import { OAUTH_ENDPOINTS } from "@/lib/okta-config"
import { createClientAssertion } from "@/lib/jwt-utils"

export async function POST(request: NextRequest) {
  try {
    const { idToken } = await request.json()

    if (!idToken) {
      return NextResponse.json({ error: "Missing idToken" }, { status: 400 })
    }

    const servicenowSecretPath = process.env.SERVICENOW_SECRET_PATH

    if (!servicenowSecretPath) {
      return NextResponse.json({ error: "SERVICENOW_SECRET_PATH environment variable not configured" }, { status: 500 })
    }

    console.log("[v0] Service Account Token Exchange Request")
    console.log("[v0] ========================================")
    console.log("[v0] Token endpoint:", OAUTH_ENDPOINTS.token)
    console.log("[v0] Resource (SERVICENOW_SECRET_PATH):", servicenowSecretPath)

    const clientAssertion = await createClientAssertion()

    const requestBody = {
      grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
      requested_token_type: "urn:okta:params:oauth:token-type:service-account",
      subject_token: idToken,
      subject_token_type: "urn:ietf:params:oauth:token-type:id_token",
      resource: servicenowSecretPath,
      client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
      client_assertion: clientAssertion,
    }

    console.log("[v0] Request parameters:")
    console.log("[v0]   grant_type:", requestBody.grant_type)
    console.log("[v0]   requested_token_type:", requestBody.requested_token_type)
    console.log("[v0]   subject_token_type:", requestBody.subject_token_type)
    console.log("[v0]   resource:", requestBody.resource)
    console.log("[v0]   client_assertion_type:", requestBody.client_assertion_type)

    const response = await fetch(OAUTH_ENDPOINTS.token, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(requestBody),
    })

    const responseText = await response.text()
    console.log("[v0] Response status:", response.status)

    if (!response.ok) {
      console.error("[v0] Service account exchange failed - status:", response.status)
      console.error("[v0] Response:", responseText)
      return NextResponse.json(
        { error: "Service account exchange failed", details: responseText },
        { status: response.status },
      )
    }

    const data = JSON.parse(responseText)

    if (data.issued_token_type !== "urn:okta:params:oauth:token-type:service-account") {
      console.error("[v0] Unexpected issued_token_type:", data.issued_token_type)
      return NextResponse.json(
        { error: "Invalid token response", details: "issued_token_type mismatch" },
        { status: 500 },
      )
    }

    console.log("[v0] Service account exchange successful")
    console.log("[v0]   token_type:", data.token_type)
    console.log("[v0]   expires_in:", data.expires_in)
    console.log("[v0]   issued_token_type:", data.issued_token_type)

    const serviceAccount = data.service_account

    if (!serviceAccount || !serviceAccount.username || !serviceAccount.password) {
      console.error("[v0] Service account credentials not found in response")
      return NextResponse.json(
        { error: "Service account credentials not found", details: "Missing username or password" },
        { status: 500 },
      )
    }

    console.log("[v0] Service account username:", serviceAccount.username)
    console.log("[v0] Service account password: ***REDACTED***")

    return NextResponse.json({
      username: serviceAccount.username,
      password: serviceAccount.password,
      tokenType: data.token_type,
      expiresIn: data.expires_in,
      issuedTokenType: data.issued_token_type,
    })
  } catch (error) {
    console.error("[v0] Service account exchange error:", error instanceof Error ? error.message : "Unknown")
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
