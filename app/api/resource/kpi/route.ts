import { type NextRequest, NextResponse } from "next/server"
import { validateAccessToken } from "@/lib/token-validator"
import { KPI_DATA } from "@/lib/enterprise-data"

export async function GET(request: NextRequest) {
  try {
    // Extract Bearer token from Authorization header
    const authHeader = request.headers.get("authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Missing or invalid authorization header" }, { status: 401 })
    }

    const token = authHeader.substring(7)

    const claims = await validateAccessToken(token)
    console.log("[v0] Validated ID-JAG token for KPI resource")

    const scopes = claims.scope?.split(" ") || []
    if (!scopes.includes("kpi:read")) {
      return NextResponse.json({ error: "Insufficient permissions. Required scope: kpi:read" }, { status: 403 })
    }

    console.log("[v0] Accessing KPI data with ID-JAG token")

    // Return KPI data
    return NextResponse.json({
      success: true,
      data: KPI_DATA,
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
