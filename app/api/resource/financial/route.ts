import { type NextRequest, NextResponse } from "next/server"
import { validateAuth0Token } from "@/lib/auth0-token-validator"
import { FINANCIAL_DATA } from "@/lib/enterprise-data"

export async function GET(request: NextRequest) {
  try {
    // Extract Bearer token from Authorization header
    const authHeader = request.headers.get("authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Missing or invalid authorization header" }, { status: 401 })
    }

    const token = authHeader.substring(7)

    const claims = await validateAuth0Token(token, process.env.AUTH0_RESOURCE)
    console.log("[v0] Validated Auth0 access token for Financial resource")

    const scopes = claims.scope?.split(" ") || []
    if (!scopes.includes("finance:read")) {
      return NextResponse.json({ error: "Insufficient permissions. Required scope: finance:read" }, { status: 403 })
    }

    console.log("[v0] Accessing Financial data with Auth0 access token")

    // Return financial data
    return NextResponse.json({
      success: true,
      data: FINANCIAL_DATA,
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
