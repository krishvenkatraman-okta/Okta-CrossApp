import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { username, password, shortDescription, description, priority, category } = await request.json()

    if (!username || !password) {
      return NextResponse.json({ error: "Missing credentials" }, { status: 400 })
    }

    const servicenowInstance = process.env.SERVICENOW_INSTANCE_URL

    if (!servicenowInstance) {
      return NextResponse.json(
        { error: "SERVICENOW_INSTANCE_URL environment variable not configured" },
        { status: 500 },
      )
    }

    const steps: string[] = []

    // Step 1: Validate credentials with ServiceNow
    steps.push("Validating ServiceNow credentials...")
    console.log("[v0] ServiceNow Create Ticket Request")
    console.log("[v0] =================================")
    console.log("[v0] Instance URL:", servicenowInstance)
    console.log("[v0] Username:", username)

    // Create Basic Auth header
    const basicAuth = Buffer.from(`${username}:${password}`).toString("base64")

    // Step 2: Verify access by getting user info
    steps.push("Verifying ServiceNow access...")
    const userCheckResponse = await fetch(
      `${servicenowInstance}/api/now/table/sys_user?sysparm_query=user_name=${encodeURIComponent(username)}&sysparm_limit=1`,
      {
        method: "GET",
        headers: {
          Authorization: `Basic ${basicAuth}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      },
    )

    if (!userCheckResponse.ok) {
      console.error("[v0] ServiceNow auth failed:", userCheckResponse.status)
      return NextResponse.json(
        {
          error: "ServiceNow authentication failed",
          step: "validate_credentials",
          details: `HTTP ${userCheckResponse.status}`,
        },
        { status: 401 },
      )
    }

    steps.push(`Authenticated as: ${username}`)
    console.log("[v0] ServiceNow authentication successful")

    // Step 3: Create the incident ticket
    steps.push("Creating incident ticket...")

    const ticketPayload = {
      short_description: shortDescription || "Ticket created via Okta PAM Demo",
      description:
        description ||
        "This ticket was created automatically using Okta PAM service account credentials retrieved at runtime.",
      priority: priority || "3",
      category: category || "inquiry",
      caller_id: username,
    }

    console.log("[v0] Creating ticket with payload:")
    console.log("[v0]   short_description:", ticketPayload.short_description)
    console.log("[v0]   priority:", ticketPayload.priority)
    console.log("[v0]   category:", ticketPayload.category)

    const createResponse = await fetch(`${servicenowInstance}/api/now/table/incident`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(ticketPayload),
    })

    if (!createResponse.ok) {
      const errorText = await createResponse.text()
      console.error("[v0] Failed to create ticket:", createResponse.status, errorText)
      return NextResponse.json(
        {
          error: "Failed to create ServiceNow ticket",
          step: "create_ticket",
          details: errorText,
        },
        { status: createResponse.status },
      )
    }

    const ticketData = await createResponse.json()
    const ticket = ticketData.result

    steps.push(`Ticket created successfully!`)
    steps.push(`Ticket Number: ${ticket.number}`)
    steps.push(`Ticket ID: ${ticket.sys_id}`)

    console.log("[v0] Ticket created successfully")
    console.log("[v0]   Number:", ticket.number)
    console.log("[v0]   Sys ID:", ticket.sys_id)

    return NextResponse.json({
      success: true,
      ticketNumber: ticket.number,
      ticketId: ticket.sys_id,
      shortDescription: ticket.short_description,
      priority: ticket.priority,
      state: ticket.state,
      createdBy: username,
      ticketUrl: `${servicenowInstance}/nav_to.do?uri=incident.do?sys_id=${ticket.sys_id}`,
      steps,
    })
  } catch (error) {
    console.error("[v0] ServiceNow ticket creation error:", error instanceof Error ? error.message : "Unknown")
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
