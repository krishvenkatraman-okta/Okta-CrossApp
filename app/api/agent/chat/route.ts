import { streamText, type CoreMessage } from "ai"
import { getIdTokenFromCookies, requestIdJag, exchangeIdJagForAuth0Token } from "@/lib/server-token-exchange"

export const maxDuration = 30

async function querySalesforceData(
  req: Request,
  objectName: string,
  fields: string[],
  whereClause?: string,
  limit = 10,
): Promise<string> {
  const steps: string[] = []

  steps.push("🔐 Step 1: Retrieved Web ID Token from your authenticated session")

  try {
    const idToken = getIdTokenFromCookies(req)
    if (!idToken) {
      throw new Error("Not authenticated")
    }

    const salesforceDomain = process.env.SALESFORCE_DOMAIN
    const auth0Audience = process.env.AUTH0_AUDIENCE
    const gatewayUrl = process.env.GATEWAY_URL

    if (!salesforceDomain || !auth0Audience || !gatewayUrl) {
      throw new Error("SALESFORCE_DOMAIN, AUTH0_AUDIENCE, or GATEWAY_URL not configured")
    }

    steps.push("🔄 Step 2: Requesting cross-app ID-JAG for Gateway with resource: Salesforce")
    const idJagToken = await requestIdJag(idToken, salesforceDomain, auth0Audience)
    steps.push("✅ Step 2 Complete: Received ID-JAG for Gateway from Okta")

    steps.push("🎫 Step 3: Trading ID-JAG for Okta Relay Access Token")
    const scope = process.env.SALESFORCE_SCOPE || "salesforce:read"
    const accessToken = await exchangeIdJagForAuth0Token(
      idJagToken,
      process.env.AUTH0_TOKEN_ENDPOINT!,
      process.env.AUTH0_REQUESTING_APP_CLIENT_ID!,
      process.env.AUTH0_REQUESTING_APP_CLIENT_SECRET!,
      scope,
      salesforceDomain,
    )
    steps.push("✅ Step 3 Complete: Received Okta Relay Access Token for Gateway")

    const soql = `SELECT ${fields.join(", ")} FROM ${objectName}${whereClause ? ` WHERE ${whereClause}` : ""} LIMIT ${limit}`
    steps.push(`📡 Step 4: Querying Salesforce via Gateway with Okta Relay Access Token`)
    steps.push(`   Query: ${soql}`)

    const encodedQuery = encodeURIComponent(soql)
    const salesforceEndpoint = `/services/data/v62.0/query?q=${encodedQuery}`
    const fullUrl = `${gatewayUrl}${salesforceEndpoint}`
    const hostname = salesforceDomain.replace(/^https?:\/\//, "")

    const response = await fetch(fullUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "X-GATEWAY-Host": hostname,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      const contentType = response.headers.get("content-type") || ""

      if (contentType.includes("text/html")) {
        steps.push("❌ Step 4 Error: Gateway returned HTML error page instead of JSON")
        return `${steps.join("\n")}\n\n❌ Error: Gateway configuration issue`
      }

      steps.push(`❌ Step 4 Error: Gateway returned status ${response.status}`)
      return `${steps.join("\n")}\n\n❌ Error: ${errorText}`
    }

    const data = await response.json()
    steps.push(`✅ Step 4 Complete: Retrieved ${data.records?.length || 0} records from Salesforce`)

    const records = data.records || []
    const formattedRecords = records
      .map((record: any, index: number) => {
        const { attributes, ...rest } = record
        const fields = Object.entries(rest)
          .map(([key, value]) => `  ${key}: ${value}`)
          .join("\n")
        return `Record ${index + 1}:\n${fields}`
      })
      .join("\n\n")

    return `${steps.join("\n")}\n\n📊 Salesforce Query Results:\n\nFound ${records.length} ${objectName} records:\n\n${formattedRecords}`
  } catch (error) {
    console.error(`[v0] Query error:`, error)
    return `${steps.join("\n")}\n\n❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`
  }
}

export async function POST(req: Request) {
  console.log(`[v0] ===== AGENT CHAT REQUEST RECEIVED =====`)

  try {
    const body = await req.json()
    const messages = body?.messages || []

    if (!messages || messages.length === 0) {
      throw new Error("No messages provided")
    }

    const lastMessage = messages[messages.length - 1]
    const userMessage = lastMessage.content.toLowerCase()

    if (userMessage.includes("salesforce") && userMessage.includes("opportunit")) {
      console.log(`[v0] Detected Salesforce opportunity query - executing directly`)

      const result = await querySalesforceData(
        req,
        "Opportunity",
        ["Id", "Name", "Amount", "StageName", "CloseDate", "AccountId"],
        undefined,
        10,
      )

      console.log(`[v0] Query result length: ${result.length}`)
      console.log(`[v0] Query result preview:`, result.substring(0, 300))

      // Return simple text stream
      return new Response(result, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
        },
      })
    }

    const coreMessages: CoreMessage[] = messages.map((msg: any) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content || "",
    }))

    const result = await streamText({
      model: "anthropic/claude-sonnet-4",
      system: `You are an AI agent that helps users access enterprise data through Okta cross-app access.

When users ask for Salesforce opportunities, the system will automatically fetch and display them with all authentication steps.

For other requests, provide helpful guidance.`,
      messages: coreMessages,
      maxTokens: 2000,
    })

    return result.toTextStreamResponse()
  } catch (error) {
    console.error(`[v0] Error:`, error)

    return new Response(`Error: ${error instanceof Error ? error.message : "Unknown error occurred"}`, {
      status: 500,
      headers: { "Content-Type": "text/plain" },
    })
  }
}
