import { type NextRequest, NextResponse } from "next/server"
import { validateAuth0Token } from "@/lib/auth0-token-validator"
import { SALESFORCE_DATA } from "@/lib/enterprise-data"

export async function GET(request: NextRequest) {
  try {
    // Extract Bearer token from Authorization header
    const authHeader = request.headers.get("authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Missing or invalid authorization header" }, { status: 401 })
    }

    const token = authHeader.substring(7)

    const salesforceResource = process.env.SALESFORCE_RESOURCE
    const claims = await validateAuth0Token(token, salesforceResource)
    console.log("[v0] Validated Auth0 access token for Salesforce resource")

    const scopes = claims.scope?.split(" ") || []
    if (!scopes.includes("salesforce:read")) {
      return NextResponse.json({ error: "Insufficient permissions. Required scope: salesforce:read" }, { status: 403 })
    }

    console.log("[v0] Accessing Salesforce data with Auth0 access token")

    // Return Salesforce data
    return NextResponse.json({
      success: true,
      data: SALESFORCE_DATA,
      metadata: {
        requestedBy: claims.sub,
        scopes: scopes,
        timestamp: new Date().toISOString(),
        protectedBy: "Auth0",
      },
    })
  } catch (error) {
    console.error("[v0] Resource API error:", error)
    return NextResponse.json(
      {
        error: "Unauthorized",
        message: error instanceof Error ? error.message : "Token validation failed",
      },
      { status: 401 },
    )
  }
}
