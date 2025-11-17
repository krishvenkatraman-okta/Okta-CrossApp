import { convertToModelMessages, streamText, tool, UIMessage } from "ai"
import { z } from "zod"

export const maxDuration = 30

const getSalesforceDataTool = tool({
  description: "Get Salesforce data such as opportunities, leads, or accounts",
  inputSchema: z.object({
    dataType: z.enum(["opportunities", "leads", "accounts"]).describe("Type of Salesforce data to retrieve"),
  }),
  execute: async ({ dataType }) => {
    console.log(`[v0] Agent requesting Salesforce ${dataType}`)

    // This will be handled by the client-side agent
    return {
      message: `Initiating Salesforce ${dataType} request`,
      dataType,
    }
  },
})

const getFinancialDataTool = tool({
  description: "Get financial data such as revenue, expenses, or profit information",
  inputSchema: z.object({
    dataType: z.enum(["revenue", "expenses", "profit"]).describe("Type of financial data to retrieve"),
  }),
  execute: async ({ dataType }) => {
    console.log(`[v0] Agent requesting financial ${dataType}`)

    return {
      message: `Initiating financial ${dataType} request`,
      dataType,
    }
  },
})

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json()

  const prompt = convertToModelMessages(messages)

  const result = streamText({
    model: "anthropic/claude-haiku-4.5",
    prompt,
    tools: {
      getSalesforceData: getSalesforceDataTool,
      getFinancialData: getFinancialDataTool,
    },
    maxOutputTokens: 2000,
  })

  return result.toUIMessageStreamResponse()
}
