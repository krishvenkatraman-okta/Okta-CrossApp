import { streamText, type CoreMessage } from "ai"
import { getIdTokenFromCookies, requestIdJag, exchangeIdJagForAuth0Token } from "@/lib/server-token-exchange"

export const maxDuration = 30

async function querySalesforceData(
  req: Request,
  objectName: string,
  fields: string[],
  whereClause?: string,
): Promise<{ result: string; tokens: Record<string, string>; requiresConnection?: boolean }> {
  const steps: string[] = []
  const tokens: Record<string, string> = {}

  try {
    const idToken = getIdTokenFromCookies(req)
    if (!idToken) {
      throw new Error("Not authenticated")
    }
    tokens.web_id_token = idToken

    // Also get access token from cookies if available
    const cookieHeader = req.headers.get("cookie")
    if (cookieHeader) {
      const cookies = Object.fromEntries(
        cookieHeader.split("; ").map((cookie) => {
          const [name, ...rest] = cookie.split("=")
          return [name, rest.join("=")]
        }),
      )
      const accessToken = cookies["web_okta_access_token"]
      if (accessToken) {
        tokens.web_access_token = accessToken
      }
    }

    steps.push("🔐 Step 1: Retrieved Web ID Token and Access Token from Okta")
    steps.push("   ✅ Web ID Token: Retrieved from authenticated session")
    steps.push("   ✅ Web Access Token: Retrieved from authenticated session")

    const salesforceDomain = process.env.SALESFORCE_DOMAIN
    const auth0Audience = process.env.AUTH0_AUDIENCE
    const gatewayUrl = process.env.GATEWAY_URL

    if (!salesforceDomain || !auth0Audience || !gatewayUrl) {
      throw new Error("SALESFORCE_DOMAIN, AUTH0_AUDIENCE, or GATEWAY_URL not configured")
    }

    steps.push("")
    steps.push("👤 Step 2: User requesting Salesforce opportunities")

    steps.push("")
    steps.push("🔄 Step 3: Requesting cross-app ID-JAG for Auth0 with resource: Salesforce")
    const idJagToken = await requestIdJag(idToken, salesforceDomain, auth0Audience)
    tokens.id_jag_token = idJagToken
    steps.push("   ✅ ID-JAG Token: Received from Okta")

    steps.push("")
    steps.push("🎫 Step 4: Trading ID-JAG for Auth0 Access Token with resource: Salesforce")
    const scope = process.env.SALESFORCE_SCOPE || "salesforce:read"
    const auth0AccessToken = await exchangeIdJagForAuth0Token(
      idJagToken,
      process.env.AUTH0_TOKEN_ENDPOINT!,
      process.env.AUTH0_REQUESTING_APP_CLIENT_ID!,
      process.env.AUTH0_REQUESTING_APP_CLIENT_SECRET!,
      scope,
      salesforceDomain,
    )
    tokens.auth0_access_token = auth0AccessToken
    steps.push("   ✅ Auth0 Access Token: Received for Salesforce resource")

    const soql = `SELECT ${fields.join(", ")} FROM ${objectName}${whereClause ? ` WHERE ${whereClause}` : ""}`
    steps.push("")
    steps.push(`📡 Step 5: Calling Egress Okta Relay (Gateway) with Auth0 Access Token`)
    steps.push(`   Query: ${soql}`)

    const encodedQuery = encodeURIComponent(soql)
    const salesforceEndpoint = `/services/data/v62.0/query?q=${encodedQuery}`
    const fullUrl = `${gatewayUrl}${salesforceEndpoint}`
    const hostname = salesforceDomain.replace(/^https?:\/\//, "")

    const response = await fetch(fullUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${auth0AccessToken}`,
        "X-GATEWAY-Host": hostname,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      const contentType = response.headers.get("content-type") || ""

      if (contentType.includes("text/html")) {
        steps.push("")
        steps.push("❌ Error: Gateway returned HTML error page instead of JSON")
        return { result: `${steps.join("\n")}\n\n❌ Gateway configuration issue`, tokens }
      }

      steps.push("")
      steps.push(`❌ Error: Gateway returned status ${response.status}`)
      return { result: `${steps.join("\n")}\n\n❌ ${errorText}`, tokens }
    }

    const data = await response.json()

    if (data.error === "federated_connection_refresh_token_not_found") {
      steps.push("")
      steps.push(`⚠️ Step 6: Federated Account Not Found`)
      steps.push(`   The Gateway could not find a connected Salesforce account for your Auth0 identity.`)
      steps.push("")
      steps.push(`📋 To connect your Salesforce account:`)
      steps.push(`   1. You need to initiate the connected account flow`)
      steps.push(`   2. This requires getting an Auth0 /me/ API access token`)
      steps.push(`   3. Then calling the /me/v1/connected-accounts/connect endpoint`)
      steps.push(`   4. Finally, completing the OAuth flow with Salesforce`)
      steps.push("")
      steps.push(`🔗 Next Steps:`)
      steps.push(`   - Click the "Connect Salesforce Account" button to start the connection flow`)
      steps.push(`   - You will be redirected to Salesforce to authorize access`)
      steps.push(`   - After authorization, you can retry your query`)

      return {
        result: `${steps.join("\n")}\n\n⚠️ Please connect your Salesforce account to continue.`,
        tokens,
        requiresConnection: true,
      }
    }

    steps.push("")
    steps.push(`✅ Step 6: Received response from Egress Okta Relay (Gateway)`)
    steps.push(`   Retrieved ${data.records?.length || 0} Opportunity records from Salesforce`)

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

    return {
      result: `${steps.join("\n")}\n\n📊 Salesforce Query Results:\n\nFound ${records.length} ${objectName} records:\n\n${formattedRecords}`,
      tokens,
    }
  } catch (error) {
    console.error(`[v0] Query error:`, error)
    return {
      result: `${steps.join("\n")}\n\n❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      tokens,
    }
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

      const { result, tokens, requiresConnection } = await querySalesforceData(req, "Opportunity", [
        "Id",
        "Name",
        "Amount",
        "StageName",
        "CloseDate",
        "AccountId",
      ])

      console.log(`[v0] Query result length: ${result.length}`)
      console.log(`[v0] Tokens collected: ${Object.keys(tokens).join(", ")}`)

      if (requiresConnection) {
        return new Response(JSON.stringify({ result, tokens, requiresConnection }), {
          headers: {
            "Content-Type": "application/json; charset=utf-8",
          },
        })
      }

      return new Response(JSON.stringify({ result, tokens }), {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
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
