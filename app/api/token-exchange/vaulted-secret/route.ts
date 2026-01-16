import { type NextRequest, NextResponse } from "next/server"
import { OAUTH_ENDPOINTS } from "@/lib/okta-config"
import { createClientAssertion } from "@/lib/jwt-utils"

export async function POST(request: NextRequest) {
  try {
    const { idToken } = await request.json()

    if (!idToken) {
      return NextResponse.json({ error: "Missing idToken" }, { status: 400 })
    }

    const githubPatPath = process.env.GITHUB_PAT_PATH
    const githubSecretKeyName = process.env.GITHUB_SECRET_KEY_NAME || "githubPAT"

    if (!githubPatPath) {
      return NextResponse.json({ error: "GITHUB_PAT_PATH environment variable not configured" }, { status: 500 })
    }

    console.log("[v0] Vaulted Secret Token Exchange Request")
    console.log("[v0] =====================================")
    console.log("[v0] Token endpoint:", OAUTH_ENDPOINTS.token)
    console.log("[v0] Resource (github_pat_path):", githubPatPath)
    console.log("[v0] Secret key name:", githubSecretKeyName)

    const clientAssertion = await createClientAssertion()

    const requestBody = {
      grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
      requested_token_type: "urn:okta:params:oauth:token-type:vaulted-secret",
      subject_token: idToken,
      subject_token_type: "urn:ietf:params:oauth:token-type:id_token",
      resource: githubPatPath,
      client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
      client_assertion: clientAssertion,
    }

    console.log("[v0] Request parameters:")
    console.log("[v0]   grant_type:", requestBody.grant_type)
    console.log("[v0]   requested_token_type:", requestBody.requested_token_type)
    console.log("[v0]   subject_token_type:", requestBody.subject_token_type)
    console.log("[v0]   resource:", requestBody.resource)
    console.log("[v0]   client_assertion_type:", requestBody.client_assertion_type)
    // Never log: subject_token, client_assertion

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
      console.error("[v0] Vaulted secret exchange failed - status:", response.status)
      return NextResponse.json(
        { error: "Vaulted secret exchange failed", details: responseText },
        { status: response.status },
      )
    }

    const data = JSON.parse(responseText)

    if (data.issued_token_type !== "urn:okta:params:oauth:token-type:vaulted-secret") {
      console.error("[v0] Unexpected issued_token_type:", data.issued_token_type)
      return NextResponse.json(
        { error: "Invalid token response", details: "issued_token_type mismatch" },
        { status: 500 },
      )
    }

    console.log("[v0] Vaulted secret exchange successful")
    console.log("[v0]   token_type:", data.token_type)
    console.log("[v0]   expires_in:", data.expires_in)
    console.log("[v0]   issued_token_type:", data.issued_token_type)

    const githubPat = data.vaulted_secret?.[githubSecretKeyName]

    if (!githubPat) {
      console.error("[v0] GitHub PAT not found with key:", githubSecretKeyName)
      console.error("[v0] Available keys:", Object.keys(data.vaulted_secret || {}))
      return NextResponse.json(
        {
          error: "GitHub PAT not found in vaulted secret",
          details: `Expected key '${githubSecretKeyName}' not found. Available keys: ${Object.keys(data.vaulted_secret || {}).join(", ")}`,
        },
        { status: 500 },
      )
    }

    console.log("[v0] GitHub PAT extracted: github_pat_***")

    return NextResponse.json({
      githubPat,
      tokenType: data.token_type,
      expiresIn: data.expires_in,
      issuedTokenType: data.issued_token_type,
    })
  } catch (error) {
    console.error("[v0] Vaulted secret exchange error:", error instanceof Error ? error.message : "Unknown")
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
