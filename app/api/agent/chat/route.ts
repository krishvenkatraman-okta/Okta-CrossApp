import { convertToModelMessages, streamText, tool, UIMessage } from "ai"
import { z } from "zod"
import { getIdTokenFromCookies, requestIdJag, exchangeIdJagForAuth0Token } from "@/lib/server-token-exchange"

export const maxDuration = 30

function createTools(req: Request) {
  const querySalesforceData = tool({
    description: "Query Salesforce data using SOQL via the Auth0 gateway. You can query objects like Opportunity, Account, Lead, etc. The tool handles the complete token exchange and gateway routing automatically.",
    inputSchema: z.object({
      objectName: z.string().describe("Salesforce object name (e.g., 'Opportunity', 'Account', 'Lead')"),
      fields: z.array(z.string()).describe("Fields to retrieve (e.g., ['Id', 'Name', 'Amount', 'StageName'])"),
      whereClause: z.string().optional().describe("Optional WHERE clause (e.g., 'StageName = \\'Closed Won\\'')"),
      limit: z.number().default(10).describe("Maximum number of records to return")
    }),
    execute: async ({ objectName, fields, whereClause, limit }) => {
      console.log(`[v0] ===== SALESFORCE QUERY STARTED =====`)
      console.log(`[v0] Query: ${objectName}, Fields: ${fields.join(', ')}`)
      
      try {
        const idToken = getIdTokenFromCookies(req)
        if (!idToken) {
          throw new Error("Not authenticated")
        }
        console.log(`[v0] Step 1 ✓: Web ID Token retrieved`)

        const salesforceDomain = process.env.SALESFORCE_DOMAIN
        const auth0Audience = process.env.AUTH0_AUDIENCE
        
        if (!salesforceDomain || !auth0Audience) {
          throw new Error("SALESFORCE_DOMAIN or AUTH0_AUDIENCE not configured")
        }

        const idJagToken = await requestIdJag(idToken, salesforceDomain, auth0Audience)
        console.log(`[v0] Step 2 ✓: Salesforce ID-JAG received`)

        const scope = process.env.SALESFORCE_SCOPE || "salesforce:read"
        const accessToken = await exchangeIdJagForAuth0Token(
          idJagToken,
          process.env.AUTH0_TOKEN_ENDPOINT!,
          process.env.AUTH0_REQUESTING_APP_CLIENT_ID!,
          process.env.AUTH0_REQUESTING_APP_CLIENT_SECRET!,
          scope,
          salesforceDomain
        )
        console.log(`[v0] Step 3 ✓: Auth0 Access Token received`)
        
        const soql = `SELECT ${fields.join(', ')} FROM ${objectName}${whereClause ? ` WHERE ${whereClause}` : ''} LIMIT ${limit}`
        console.log(`[v0] SOQL: ${soql}`)
        
        const tokenData = {
          salesforce_id_jag_token: idJagToken,
          salesforce_auth0_access_token: accessToken
        }

        const gatewayUrl = process.env.GATEWAY_URL
        if (!gatewayUrl) {
          throw new Error('GATEWAY_URL not configured')
        }

        console.log(`[v0] Step 4: Calling gateway`)
        const encodedQuery = encodeURIComponent(soql)
        const endpoint = `/services/data/v62.0/query?q=${encodedQuery}`
        const fullUrl = `${gatewayUrl}${endpoint}`
        const hostname = salesforceDomain.replace(/^https?:\/\//, '')
        
        console.log(`[v0] Gateway URL: ${fullUrl}`)
        console.log(`[v0] X-GATEWAY-Host: ${hostname}`)
        
        const response = await fetch(fullUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-GATEWAY-Host': hostname
          }
        })

        console.log(`[v0] Gateway response status: ${response.status}`)

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          console.log(`[v0] Error response:`, errorData)

          if (errorData.error === "federated_connection_refresh_token_not_found") {
            console.log(`[v0] Connected account required - initiating ME flow`)
            
            const meIdJag = await requestIdJag(idToken, `${process.env.AUTH0_DOMAIN}/me/`, auth0Audience)
            const meAccessToken = await exchangeIdJagForAuth0Token(
              meIdJag,
              process.env.AUTH0_TOKEN_ENDPOINT!,
              process.env.AUTH0_REQUESTING_APP_CLIENT_ID!,
              process.env.AUTH0_REQUESTING_APP_CLIENT_SECRET!,
              'create:me:connected_accounts',
              `${process.env.AUTH0_DOMAIN}/me/`
            )
            
            return {
              success: false,
              requiresConnection: true,
              message: "Connected account required. Please use the UI to connect your Salesforce account, then try again.",
              error: errorData.error,
              tokens: {
                ...tokenData,
                me_id_jag_token: meIdJag,
                me_auth0_access_token: meAccessToken
              }
            }
          }

          throw new Error(`Gateway request failed: ${response.status} - ${JSON.stringify(errorData)}`)
        }

        const data = await response.json()
        console.log(`[v0] Query successful, records: ${data.records?.length || 0}`)
        console.log(`[v0] ===== SALESFORCE QUERY COMPLETED =====`)
        
        const records = data.records || []
        
        // Format records in a simple, readable way
        const formattedOutput = records.map((record: any, index: number) => {
          const { attributes, ...rest } = record
          return `Record ${index + 1}: ${JSON.stringify(rest, null, 2)}`
        }).join('\n\n')
        
        const resultMessage = `Found ${records.length} ${objectName} records:\n\n${formattedOutput}`
        
        console.log(`[v0] Returning formatted result to LLM`)
        
        // Return a simple string that the LLM can easily present
        return resultMessage
        
      } catch (error) {
        console.error(`[v0] Query error:`, error)
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error"
        }
      }
    }
  })

  const connectSalesforceAccount = tool({
    description: "Initiate the connected account flow for Salesforce when federated_connection_refresh_token_not_found error occurs",
    inputSchema: z.object({
      meAccessToken: z.string().describe("The ME Auth0 access token from previous tool result")
    }),
    execute: async ({ meAccessToken }) => {
      console.log(`[v0] ===== CONNECTED ACCOUNT FLOW STARTED =====`)
      
      try {
        const baseUrl = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'
        const response = await fetch(`${baseUrl}/api/gateway-test/connect-account`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ meAccessToken })
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
          instructions: "Open the authorizationUrl in a popup to let the user connect their Salesforce account."
        }
      } catch (error) {
        console.error(`[v0] Connect account error:`, error)
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error"
        }
      }
    }
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
    getFinancialData: getFinancialDataTool
  }
}

export async function POST(req: Request) {
  console.log(`[v0] ===== AGENT CHAT REQUEST RECEIVED =====`)
  
  const { messages }: { messages: UIMessage[] } = await req.json()
  console.log(`[v0] Message count: ${messages.length}`)

  const prompt = convertToModelMessages(messages)
  const tools = createTools(req)

  console.log(`[v0] Tools created and ready`)

  console.log(`[v0] Calling Claude Haiku 4.5 model...`)
  const result = streamText({
    model: "anthropic/claude-haiku-4.5",
    system: `You are an AI agent that helps users access enterprise data through Okta cross-app access and Auth0 gateway.
    
When a user asks for Salesforce data (like opportunities, accounts, leads), use the querySalesforceData tool.
Common Salesforce objects and fields:
- Opportunity: Id, Name, Amount, StageName, CloseDate, AccountId
- Account: Id, Name, Industry, Type, BillingCity
- Lead: Id, Name, Company, Email, Status

When you receive data from the querySalesforceData tool, ALWAYS present the results to the user in a clear, formatted way.
Display the key fields from each record and summarize what was found.

If a tool returns requiresConnection: true, explain that the user needs to connect their Salesforce account first using the UI.

For financial data, use the getFinancialData tool.

Always explain what you're doing and present the results in a clear, user-friendly format.`,
    messages: prompt,
    tools,
    maxTokens: 4000,
    maxSteps: 5 // Allow multiple tool calls and responses
  })

  console.log(`[v0] Streaming response to client`)
  return result.toUIMessageStreamResponse()
}

async function exchangeForAuth0Token(idToken: string) {
  // Placeholder function to simulate token exchange
  return {
    idJag: "simulated_id_jag_token",
    accessToken: "simulated_access_token"
  }
}
