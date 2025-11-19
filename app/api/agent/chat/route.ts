import { convertToModelMessages, streamText, tool, UIMessage } from "ai"
import { z } from "zod"
import { exchangeForAuth0Token, exchangeForSalesforceAuth0Token, getIdTokenFromCookies } from "@/lib/server-token-exchange"

export const maxDuration = 30

function createTools(req: Request) {
  const discoverSalesforceSchema = tool({
    description: "Discover available Salesforce objects, fields, and APIs dynamically. Call this first to understand what data is available.",
    inputSchema: z.object({}),
    execute: async () => {
      console.log(`[v0] ===== SALESFORCE SCHEMA DISCOVERY STARTED =====`)
      
      try {
        const idToken = getIdTokenFromCookies(req)
        if (!idToken) {
          throw new Error("Not authenticated. Please log in with Okta Gateway first.")
        }
        console.log(`[v0] Step 1: Web ID Token retrieved`)

        const baseUrl = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'
        const jagResponse = await fetch(`${baseUrl}/api/gateway-test/salesforce-jag`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken })
        })

        if (!jagResponse.ok) {
          const error = await jagResponse.json()
          throw new Error(`ID-JAG exchange failed: ${error.message}`)
        }

        const jagData = await jagResponse.json()
        const idJagToken = jagData.idJagToken
        console.log(`[v0] Step 2 ✓: Salesforce ID-JAG received`)

        const auth0Response = await fetch(`${baseUrl}/api/gateway-test/auth0-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idJagToken, resourceType: 'salesforce' })
        })

        if (!auth0Response.ok) {
          const error = await auth0Response.json()
          throw new Error(`Auth0 token exchange failed: ${error.message}`)
        }

        const auth0Data = await auth0Response.json()
        const accessToken = auth0Data.accessToken
        console.log(`[v0] Step 3 ✓: Auth0 Access Token received`)

        const salesforceDomain = process.env.SALESFORCE_DOMAIN
        if (!salesforceDomain) {
          throw new Error("SALESFORCE_DOMAIN not configured")
        }

        const { discoverSalesforceSchema, generateSalesforceToolDescription } = await import('@/lib/salesforce-schema-discovery')
        
        const schema = await discoverSalesforceSchema(salesforceDomain, accessToken)
        const description = generateSalesforceToolDescription(schema)
        
        console.log(`[v0] ===== SALESFORCE SCHEMA DISCOVERY COMPLETED =====`)
        
        return {
          success: true,
          schema,
          description,
          message: "Successfully discovered Salesforce schema. Use querySalesforceData to query specific objects."
        }
      } catch (error) {
        console.error(`[v0] Error discovering schema:`, error)
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error"
        }
      }
    }
  })

  const querySalesforceData = tool({
    description: "Query Salesforce data using SOQL. You can query any object discovered via discoverSalesforceSchema. The tool handles gateway routing automatically.",
    inputSchema: z.object({
      objectName: z.string().describe("Salesforce object name (e.g., 'Opportunity', 'Account', 'Lead')"),
      fields: z.array(z.string()).describe("Fields to retrieve (e.g., ['Id', 'Name', 'Amount'])"),
      whereClause: z.string().optional().describe("Optional WHERE clause (e.g., 'StageName = Closed Won')"),
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
        console.log(`[v0] Step 1: Web ID Token retrieved`)

        const baseUrl = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'
        const jagResponse = await fetch(`${baseUrl}/api/gateway-test/salesforce-jag`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken })
        })

        if (!jagResponse.ok) {
          const error = await jagResponse.json()
          throw new Error(`ID-JAG exchange failed: ${error.message}`)
        }

        const jagData = await jagResponse.json()
        const idJagToken = jagData.idJagToken
        console.log(`[v0] Step 2 ✓: Salesforce ID-JAG received`)

        const auth0Response = await fetch(`${baseUrl}/api/gateway-test/auth0-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idJagToken, resourceType: 'salesforce' })
        })

        if (!auth0Response.ok) {
          const error = await auth0Response.json()
          throw new Error(`Auth0 token exchange failed: ${error.message}`)
        }

        const auth0Data = await auth0Response.json()
        const accessToken = auth0Data.accessToken
        console.log(`[v0] Step 3 ✓: Auth0 Access Token received`)
        
        const soql = `SELECT ${fields.join(', ')} FROM ${objectName}${whereClause ? ` WHERE ${whereClause}` : ''} LIMIT ${limit}`
        console.log(`[v0] SOQL: ${soql}`)
        
        const tokenData = {
          salesforce_id_jag_token: idJagToken,
          salesforce_auth0_access_token: accessToken
        }

        const gatewayMode = process.env.GATEWAY_MODE === "true"
        const gatewayUrl = process.env.GATEWAY_URL
        const salesforceDomain = process.env.SALESFORCE_DOMAIN

        if (gatewayMode && gatewayUrl && salesforceDomain) {
          console.log(`[v0] Step 4: Calling gateway via /api/gateway-test/salesforce-data`)
          const encodedQuery = encodeURIComponent(soql)
          const endpoint = `/services/data/v62.0/query?q=${encodedQuery}`
          const fullUrl = `${gatewayUrl}${endpoint}`
          const hostname = salesforceDomain.replace(/^https?:\/\//, '')
          
          console.log(`[v0] Making gateway request via API route`)
          
          const response = await fetch(`${baseUrl}/api/gateway-test/salesforce-data`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              accessToken,
              gatewayUrl: fullUrl,
              hostname
            })
          })

          console.log(`[v0] Gateway response status: ${response.status}`)

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            console.log(`[v0] Error response:`, errorData)

            if (errorData.error === "federated_connection_refresh_token_not_found") {
              console.log(`[v0] Connected account required`)
              return {
                success: false,
                requiresConnection: true,
                message: "Connected account required. Please connect your Salesforce account first.",
                error: errorData.error,
                tokens: tokenData
              }
            }

            throw new Error(`Gateway request failed: ${response.status}`)
          }

          const data = await response.json()
          console.log(`[v0] Query successful, records: ${data.records?.length || 0}`)
          
          return {
            success: true,
            data,
            query: soql,
            message: `Successfully retrieved ${data.records?.length || 0} ${objectName} records`,
            tokens: tokenData
          }
        } else {
          throw new Error('Gateway mode is not enabled. Please set GATEWAY_MODE=true and GATEWAY_URL')
        }
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
    discoverSalesforceSchema,
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
    
When a user asks for Salesforce data, use the discoverSalesforceSchema tool first to understand available objects and fields.
Then use the querySalesforceData tool with the appropriate object name and fields.
If a tool returns an error or requires a connected account, explain this to the user clearly and use the connectSalesforceAccount tool if necessary.

For financial data, use the getFinancialData tool.

Always explain what you're doing and present the results in a clear, user-friendly format.
Store the tokens from tool results for debugging.`,
    messages: prompt,
    tools,
    maxTokens: 4000
  })

  console.log(`[v0] Streaming response to client`)
  return result.toUIMessageStreamResponse()
}
