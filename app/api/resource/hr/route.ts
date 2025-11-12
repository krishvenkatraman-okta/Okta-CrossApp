import { type NextRequest, NextResponse } from "next/server"
import { validateAccessToken } from "@/lib/token-validator"
import { HR_DATA } from "@/lib/enterprise-data"

export async function GET(request: NextRequest) {
  try {
    // Extract Bearer token from Authorization header
    const authHeader = request.headers.get("authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Missing or invalid authorization header" }, { status: 401 })
    }

    const token = authHeader.substring(7)

    const claims = await validateAccessToken(token)
    console.log("[v0] Validated ID-JAG token for HR resource")

    const scopes = claims.scope?.split(" ") || []
    if (!scopes.includes("hr:read")) {
      return NextResponse.json({ error: "Insufficient permissions. Required scope: hr:read" }, { status: 403 })
    }

    console.log("[v0] Accessing HR data with ID-JAG token")

    return NextResponse.json({
      success: true,
      data: HR_DATA,
      metadata: {
        requestedBy: claims.sub,
        clientId: claims.client_id,
        scopes: scopes,
        timestamp: new Date().toISOString(),
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
