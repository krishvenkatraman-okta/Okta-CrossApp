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

    // Validate the token
    const claims = await validateAccessToken(token)

    // Check if token has required scope
    if (!claims.scope.includes("mcp:read")) {
      return NextResponse.json({ error: "Insufficient permissions. Required scope: mcp:read" }, { status: 403 })
    }

    // Return HR data
    return NextResponse.json({
      success: true,
      data: HR_DATA,
      metadata: {
        requestedBy: claims.sub,
        clientId: claims.client_id,
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error("Token validation error:", error)
    return NextResponse.json(
      {
        error: "Unauthorized",
        message: error instanceof Error ? error.message : "Token validation failed",
      },
      { status: 401 },
    )
  }
}
