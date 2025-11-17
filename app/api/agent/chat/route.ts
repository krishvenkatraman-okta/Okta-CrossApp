import { convertToModelMessages, streamText, tool, UIMessage } from "ai"
import { z } from "zod"
import { exchangeForAuth0Token, exchangeForSalesforceAuth0Token, getIdTokenFromCookies } from "@/lib/server-token-exchange"

export const maxDuration = 30

function createTools(req: Request) {
  const getSalesforceDataTool = tool({
    description: "Get Salesforce data such as opportunities, leads, or accounts through the gateway",
    inputSchema: z.object({
      dataType: z.enum(["opportunities", "leads", "accounts"]).describe("Type of Salesforce data to retrieve"),
    }),
    execute: async ({ dataType }) => {
      console.log(`[v0] Agent requesting Salesforce ${dataType}`)

      try {
        const idToken = getIdTokenFromCookies(req)
        if (!idToken) {
          throw new Error("Not authenticated. Please log in with Okta Gateway first.")
        }

        const { idJag, accessToken } = await exchangeForSalesforceAuth0Token(idToken)
        console.log("[v0] Salesforce Auth0 token obtained")

        const gatewayMode = process.env.GATEWAY_MODE === "true"
        const gatewayUrl = process.env.GATEWAY_URL

        if (gatewayMode && gatewayUrl) {
          console.log("[v0] Making gateway request for Salesforce", dataType)

          const endpointMap: Record<string, string> = {
            opportunities: "/services/data/v57.0/query?q=SELECT+Id,Name,Amount,StageName+FROM+Opportunity+LIMIT+10",
            leads: "/services/data/v57.0/query?q=SELECT+Id,Name,Company,Status+FROM+Lead+LIMIT+10",
            accounts: "/services/data/v57.0/query?q=SELECT+Id,Name,Industry+FROM+Account+LIMIT+10",
          }

          const endpoint = endpointMap[dataType] || endpointMap.opportunities

          const response = await fetch(`${gatewayUrl}${endpoint}`, {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "X-GATEWAY-Host": process.env.SALESFORCE_RESOURCE?.replace("urn:", "").replace(":", ".") || "oktainc45-dev-ed.develop.my.salesforce.com",
            },
          })

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            console.error("[v0] Gateway request failed:", response.status, errorData)

            // Check for connected account error
            if (errorData.error === "federated_connection_refresh_token_not_found") {
              return {
                success: false,
                requiresConnection: true,
                message: "Connected account required. Please connect your Salesforce account.",
                error: errorData.error,
                tokens: { idJag, accessToken }, // Include tokens for display
              }
            }

            throw new Error(`Gateway request failed: ${response.status}`)
          }

          const data = await response.json()
          console.log("[v0] Gateway response received:", data)

          return {
            success: true,
            dataType,
            data,
            message: `Successfully retrieved ${dataType} from Salesforce`,
            tokens: { idJag, accessToken }, // Include tokens for display
          }
        } else {
          console.log("[v0] Gateway mode disabled, returning mock data")
          return {
            success: true,
            dataType,
            message: `Gateway mode is not enabled. Enable GATEWAY_MODE=true to use the gateway.`,
            mockData: true,
            tokens: { idJag, accessToken }, // Include tokens for display
          }
        }
      } catch (error) {
        console.error("[v0] Error in getSalesforceData tool:", error)
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          message: `Failed to retrieve Salesforce ${dataType}`,
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
      console.log(`[v0] Agent requesting financial ${dataType}`)

      try {
        const idToken = getIdTokenFromCookies(req)
        if (!idToken) {
          throw new Error("Not authenticated. Please log in with Okta Gateway first.")
        }

        const { idJag, accessToken } = await exchangeForAuth0Token(idToken)
        console.log("[v0] Financial Auth0 token obtained")

        const response = await fetch(`${process.env.NEXT_PUBLIC_URL || "http://localhost:3000"}/api/resource/financial`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })

        if (!response.ok) {
          throw new Error(`Financial API request failed: ${response.status}`)
        }

        const data = await response.json()
        console.log("[v0] Financial data received")

        return {
          success: true,
          dataType,
          data,
          message: `Successfully retrieved ${dataType} financial data`,
          tokens: { idJag, accessToken }, // Include tokens for display
        }
      } catch (error) {
        console.error("[v0] Error in getFinancialData tool:", error)
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          message: `Failed to retrieve financial ${dataType}`,
        }
      }
    },
  })

  return {
    getSalesforceData: getSalesforceDataTool,
    getFinancialData: getFinancialDataTool,
  }
}

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json()

  const prompt = convertToModelMessages(messages)

  const tools = createTools(req)

  const result = streamText({
    model: "anthropic/claude-haiku-4.5",
    system: `You are an AI agent that helps users access enterprise data through Okta cross-app access and Auth0 gateway.
    
When a user asks for Salesforce data, use the getSalesforceData tool.
When a user asks for financial data, use the getFinancialData tool.

Always explain what you're doing and present the results in a clear, user-friendly format.
If a tool returns an error or requires a connected account, explain this to the user clearly.

When presenting tool results, include the token information so users can inspect the authentication flow.`,
    messages: prompt,
    tools,
    maxTokens: 2000,
  })

  return result.toUIMessageStreamResponse()
}
