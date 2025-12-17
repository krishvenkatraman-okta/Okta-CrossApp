import { streamText, tool, type UIMessage } from "ai"
import { z } from "zod"
import { getIdTokenFromCookies, requestIdJag, exchangeIdJagForAuth0Token } from "@/lib/server-token-exchange"

export const maxDuration = 30

function createTools(req: Request) {
  const querySalesforceData = tool({
    description:
      "Query Salesforce data using SOQL via the Auth0 gateway. You can query objects like Opportunity, Account, Lead, etc. The tool handles the complete token exchange and gateway routing automatically.",
    inputSchema: z.object({
      objectName: z.string().describe("Salesforce object name (e.g., 'Opportunity', 'Account', 'Lead')"),
      fields: z.array(z.string()).describe("Fields to retrieve (e.g., ['Id', 'Name', 'Amount', 'StageName'])"),
      whereClause: z.string().optional().describe("Optional WHERE clause (e.g., 'StageName = \\'Closed Won\\'')"),
      limit: z.number().default(10).describe("Maximum number of records to return"),
    }),
    execute: async ({ objectName, fields, whereClause, limit }) => {
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

        const tokenData = {
          salesforce_id_jag_token: idJagToken,
          salesforce_okta_relay_access_token: accessToken,
        }

        const soql = `SELECT ${fields.join(", ")} FROM ${objectName}${whereClause ? ` WHERE ${whereClause}` : ""} LIMIT ${limit}`
        steps.push(`📡 Step 4: Querying Salesforce via Gateway with Okta Relay Access Token`)
        steps.push(`   Query: ${soql}`)

        const encodedQuery = encodeURIComponent(soql)
        const salesforceEndpoint = `/services/data/v62.0/query?q=${encodedQuery}`
        const fullUrl = `${gatewayUrl}${salesforceEndpoint}`
        const hostname = salesforceDomain.replace(/^https?:\/\//, "")

        console.log("[v0] Calling gateway with proper URL construction")
        console.log(`[v0]   Gateway URL: ${gatewayUrl}`)
        console.log(`[v0]   Salesforce Endpoint: ${salesforceEndpoint}`)
        console.log(`[v0]   Full URL: ${fullUrl}`)
        console.log(`[v0]   X-GATEWAY-Host: ${hostname}`)

        const response = await fetch(fullUrl, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "X-GATEWAY-Host": hostname,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        })

        console.log(`[v0] Gateway response status: ${response.status}`)
        const contentType = response.headers.get("content-type") || ""
        console.log(`[v0] Gateway response content-type: ${contentType}`)

        if (!response.ok) {
          const errorText = await response.text()
          console.log(`[v0] Gateway error response:`, errorText.substring(0, 500))

          if (contentType.includes("text/html")) {
            steps.push("❌ Step 4 Error: Gateway returned HTML error page instead of JSON")
            steps.push(`   Status: ${response.status}`)
            steps.push(`   This usually means the gateway URL or configuration is incorrect`)

            return {
              success: false,
              message: steps.join("\n"),
              error: `Gateway returned HTML (status ${response.status}). Check GATEWAY_URL configuration.`,
            }
          }

          let errorData
          try {
            errorData = JSON.parse(errorText)
          } catch {
            errorData = { raw: errorText }
          }

          if (errorData.error === "federated_connection_refresh_token_not_found") {
            steps.push("⚠️ Step 4 Error: Federation account not found in token vault")
            steps.push("💡 Solution: We need to initiate a Connected Account flow to store your Salesforce credentials")
            steps.push("🔄 Initiating Connected Account setup with ME token...")

            const meIdJag = await requestIdJag(idToken, `${process.env.AUTH0_DOMAIN}/me/`, auth0Audience)
            const meAccessToken = await exchangeIdJagForAuth0Token(
              meIdJag,
              process.env.AUTH0_TOKEN_ENDPOINT!,
              process.env.AUTH0_REQUESTING_APP_CLIENT_ID!,
              process.env.AUTH0_REQUESTING_APP_CLIENT_SECRET!,
              "create:me:connected_accounts",
              `${process.env.AUTH0_DOMAIN}/me/`,
            )

            steps.push("✅ ME Access Token obtained - Ready to create Connected Account")
            steps.push("👉 Please authorize the Connected Account in the popup window")
            steps.push("🔁 After authorization, your request will automatically retry")

            return {
              success: false,
              requiresConnection: true,
              message: steps.join("\n"),
              error: errorData.error,
              tokens: {
                ...tokenData,
                me_id_jag_token: meIdJag,
                me_auth0_access_token: meAccessToken,
              },
            }
          }

          throw new Error(`Gateway request failed: ${response.status} - ${JSON.stringify(errorData)}`)
        }

        if (!contentType.includes("application/json")) {
          const responseText = await response.text()
          console.log(`[v0] Gateway returned non-JSON response:`, responseText.substring(0, 500))

          steps.push("❌ Step 4 Error: Gateway returned non-JSON response")
          steps.push(`   Content-Type: ${contentType}`)
          steps.push(`   This indicates a gateway configuration or routing issue`)

          return {
            success: false,
            message: steps.join("\n"),
            error: `Gateway returned ${contentType} instead of JSON. Response preview: ${responseText.substring(0, 200)}`,
          }
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

        const resultMessage = `${steps.join("\n")}\n\n📊 Salesforce Query Results:\n\nFound ${records.length} ${objectName} records:\n\n${formattedRecords}`

        return {
          success: true,
          message: resultMessage,
          recordCount: records.length,
          tokens: tokenData,
        }
      } catch (error) {
        console.error(`[v0] Query error:`, error)
        const errorMessage = `${steps.join("\n")}\n\n❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`
        return {
          success: false,
          message: errorMessage,
        }
      }
    },
  })

  const connectSalesforceAccount = tool({
    description:
      "Initiate the connected account flow for Salesforce when federated_connection_refresh_token_not_found error occurs",
    inputSchema: z.object({
      meAccessToken: z.string().describe("The ME Auth0 access token from previous tool result"),
    }),
    execute: async ({ meAccessToken }) => {
      console.log(`[v0] ===== CONNECTED ACCOUNT FLOW STARTED =====`)

      try {
        const baseUrl = process.env.NEXT_PUBLIC_URL || "http://localhost:3000"
        const response = await fetch(`${baseUrl}/api/gateway-test/connect-account`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ meAccessToken }),
        })

        if (!response.ok) {
          throw new Error(`Failed to create connect account ticket: ${response.status}`)
        }

        const data = await response.json()
        console.log(`[v0] Connect account ticket created`)

        return {
          success: true,
          connectUri: data.connectUri,
          authorizationUrl: data.authorizationUrl,
          ticket: data.ticket,
          authSession: data.authSession,
          sessionId: data.sessionId,
          message: "Connected account flow initiated. User needs to authorize in popup window.",
          instructions: "Open the authorizationUrl in a popup to let the user connect their Salesforce account.",
        }
      } catch (error) {
        console.error(`[v0] Connect account error:`, error)
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        }
      }
    },
  })

  const getFinancialDataTool = tool({
    description: "Get financial data such as revenue, expenses, or profit information",
    inputSchema: z.object({
      dataType: z.enum(["revenue", "expenses", "profit", "all"]).describe("Type of financial data to retrieve"),
    }),
    execute: async ({ dataType }) => {
      console.log(`[v0] ===== FINANCIAL DATA REQUEST STARTED =====`)
      console.log(`[v0] Step 1: Agent requesting financial ${dataType}`)

      try {
        const idToken = getIdTokenFromCookies(req)
        if (!idToken) {
          throw new Error("Not authenticated. Please log in with Okta Gateway first.")
        }
        console.log(`[v0] Step 2 ✓: ID token found, length: ${idToken.length}`)

        const { idJag, accessToken } = await exchangeForAuth0Token(idToken)
        console.log(`[v0] Step 3 ✓: Financial Auth0 token obtained`)
        console.log(`[v0] - ID-JAG length: ${idJag.length}`)
        console.log(`[v0] - Access Token length: ${accessToken.length}`)

        const tokenData = {
          finance_id_jag_token: idJag,
          finance_auth0_access_token: accessToken,
        }

        const apiUrl = `${process.env.NEXT_PUBLIC_URL || "http://localhost:3000"}/api/resource/financial`
        console.log(`[v0] Step 4: Making financial API request`)
        console.log(`[v0] - API URL: ${apiUrl}`)

        const response = await fetch(apiUrl, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })

        console.log(`[v0] Step 4 ✓: Financial API response received - Status: ${response.status}`)

        if (!response.ok) {
          throw new Error(`Financial API request failed: ${response.status}`)
        }

        const data = await response.json()
        console.log(`[v0] Step 5 ✓: Financial data parsed successfully`)
        console.log(`[v0] ===== FINANCIAL DATA REQUEST COMPLETED =====`)

        return {
          success: true,
          dataType,
          data,
          message: `Successfully retrieved ${dataType} financial data`,
          tokens: tokenData,
        }
      } catch (error) {
        console.error(`[v0] ===== FINANCIAL DATA REQUEST FAILED =====`)
        console.error(`[v0] Error in getFinancialData tool:`, error)
        if (error instanceof Error) {
          console.error(`[v0] Error message: ${error.message}`)
          console.error(`[v0] Error stack: ${error.stack}`)
        }
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          message: `Failed to retrieve financial ${dataType}`,
        }
      }
    },
  })

  return {
    querySalesforceData,
    connectSalesforceAccount,
    getFinancialData: getFinancialDataTool,
  }
}

export async function POST(req: Request) {
  console.log(`[v0] ===== AGENT CHAT REQUEST RECEIVED =====`)

  try {
    const body = await req.json()
    console.log(`[v0] Request body:`, body)

    const messages: UIMessage[] = body?.messages || []

    if (!messages || messages.length === 0) {
      throw new Error("No messages provided in request")
    }

    console.log(`[v0] Message count: ${messages.length}`)
    console.log(`[v0] Latest message:`, messages[messages.length - 1])

    const coreMessages = messages.map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content || "",
    }))

    const tools = createTools(req)

    console.log(`[v0] Tools created and ready`)
    console.log(`[v0] Calling Claude Sonnet 4 model...`)

    const result = await streamText({
      model: "anthropic/claude-sonnet-4",
      system: `You are an AI agent that helps users access enterprise data through Okta cross-app access and the Okta Relay Gateway.

When a user asks for Salesforce data:
1. Explain that you'll retrieve the data using the secure cross-app authentication flow
2. Call the querySalesforceData tool (it will return detailed steps automatically)
3. Present the results clearly to the user

The tool will automatically show each step:
- Step 1: Web ID Token retrieval from authenticated session
- Step 2: Requesting cross-app ID-JAG for Gateway with resource Salesforce
- Step 3: Trading ID-JAG for Okta Relay Access Token
- Step 4: Querying Salesforce via Gateway

If there's a "federated_connection_refresh_token_not_found" error:
- Explain that we don't have a token in the token vault
- The system needs to initiate a Connected Account flow
- After the user authorizes, the request will automatically retry
- Keep your explanation brief and direct them to follow the popup window

Keep your responses focused on the data and steps shown. Always display all steps to the user so they can see the complete flow.`,
      messages: coreMessages,
      tools,
      maxTokens: 4000,
      maxSteps: 15,
      experimental_continueSteps: true,
      onStepFinish: async ({ text, toolCalls, toolResults, finishReason, usage }) => {
        console.log(`[v0] ===== STEP FINISHED =====`)
        console.log(`[v0] Finish reason: ${finishReason}`)
        console.log(`[v0] Text generated: "${text}"`)
        console.log(`[v0] Tool calls count: ${toolCalls?.length || 0}`)
        console.log(`[v0] Tool results count: ${toolResults?.length || 0}`)

        if (toolCalls && toolCalls.length > 0) {
          toolCalls.forEach((call, index) => {
            console.log(`[v0] Tool call ${index + 1}: ${call.toolName}`)
          })
        }

        if (toolResults && toolResults.length > 0) {
          toolResults.forEach((result, index) => {
            console.log(`[v0] Tool ${index + 1} result type:`, typeof result.result)
            if (typeof result.result === "string") {
              console.log(`[v0] Result preview: ${result.result.substring(0, 200)}...`)
            } else {
              console.log(`[v0] Result:`, result.result)
            }
          })
        }
      },
    })

    console.log(`[v0] Streaming response to client`)

    return result.toUIMessageStreamResponse()
  } catch (error) {
    console.error(`[v0] ===== AGENT CHAT ERROR =====`)
    console.error(`[v0] Error:`, error)
    console.error(`[v0] Error stack:`, error instanceof Error ? error.stack : "No stack trace")

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error occurred",
        details: error instanceof Error ? error.stack : undefined,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    )
  }
}

async function exchangeForAuth0Token(idToken: string) {
  // Placeholder function to simulate token exchange
  return {
    idJag: "simulated_id_jag_token",
    accessToken: "simulated_access_token",
  }
}
