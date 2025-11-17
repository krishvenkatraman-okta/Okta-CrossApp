"use client"

import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport, UIMessage } from "ai"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Shield, Send, Loader2, CheckCircle2, XCircle } from "@/components/icons"
import { isWebAuthenticated, clearWebTokens } from "@/lib/web-auth-client"
import { LoginButton } from "@/components/login-button"
import {
  GATEWAY_CONFIG,
  makeGatewayRequestWithFallback,
  completeConnectedAccount,
  type ConnectedAccountResponse,
} from "@/lib/gateway-client"
import { getSalesforceAuth0AccessToken, getAuth0AccessToken } from "@/lib/resource-client"
import { tokenStore } from "@/lib/token-store"

export default function AgentPage() {
  const [authenticated, setAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [input, setInput] = useState("")
  const [pendingConnection, setPendingConnection] = useState<{
    connectUri: string
    ticket: string
    authSession: string
  } | null>(null)

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: "/api/agent/chat" }),
  })

  useEffect(() => {
    setAuthenticated(isWebAuthenticated())
    setLoading(false)
  }, [])

  const handleLogout = () => {
    clearWebTokens()
    setAuthenticated(false)
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || status === "in_progress") return

    sendMessage({ text: input })
    setInput("")
  }

  const handleConnectAccount = () => {
    if (!pendingConnection) return

    // Open the connect URI in a new window
    const connectUrl = `${pendingConnection.connectUri}?ticket=${pendingConnection.ticket}`
    window.open(connectUrl, "_blank", "width=600,height=700")

    // Store for later completion
    sessionStorage.setItem("pendingAuthSession", pendingConnection.authSession)
  }

  if (loading) {
    return null
  }

  if (!authenticated) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Shield className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">AI Agent</h1>
            <p className="mt-2 text-muted-foreground">Authenticate to start using the AI agent</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Authentication Required</CardTitle>
              <CardDescription>Sign in to access the AI agent</CardDescription>
            </CardHeader>
            <CardContent>
              <LoginButton />
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold">AI Agent</h1>
              <p className="text-xs text-muted-foreground">
                {GATEWAY_CONFIG.enabled ? "Gateway Mode Active" : "Direct API Mode"}
              </p>
            </div>
          </div>
          <Button onClick={handleLogout} variant="outline" className="gap-2">
            Sign Out
          </Button>
        </div>
      </header>

      <main className="container mx-auto flex flex-1 flex-col p-4">
        <div className="mx-auto w-full max-w-4xl flex-1 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Chat with AI Agent</CardTitle>
              <CardDescription>
                Ask the agent to retrieve Salesforce data, financial information, or other enterprise resources
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex h-[500px] flex-col gap-4 overflow-y-auto rounded-lg border bg-muted/20 p-4">
                  {messages.length === 0 && (
                    <div className="flex flex-1 items-center justify-center text-muted-foreground">
                      <div className="text-center">
                        <p className="mb-2 text-sm font-medium">Welcome! Try asking:</p>
                        <ul className="space-y-1 text-xs">
                          <li>• "Get Salesforce opportunities"</li>
                          <li>• "Show me financial data"</li>
                          <li>• "What are the latest sales leads?"</li>
                        </ul>
                      </div>
                    </div>
                  )}

                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg px-4 py-2 ${
                          message.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary text-secondary-foreground"
                        }`}
                      >
                        {message.parts.map((part, index) => {
                          if (part.type === "text") {
                            return (
                              <p key={index} className="whitespace-pre-wrap">
                                {part.text}
                              </p>
                            )
                          }
                          return null
                        })}
                      </div>
                    </div>
                  ))}

                  {status === "in_progress" && (
                    <div className="flex justify-start">
                      <div className="flex items-center gap-2 rounded-lg bg-secondary px-4 py-2 text-secondary-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm">Thinking...</span>
                      </div>
                    </div>
                  )}
                </div>

                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask the agent to retrieve data..."
                    disabled={status === "in_progress"}
                    className="flex-1"
                  />
                  <Button type="submit" disabled={status === "in_progress" || !input.trim()}>
                    {status === "in_progress" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </form>
              </div>
            </CardContent>
          </Card>

          {pendingConnection && (
            <Card className="border-orange-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-orange-500" />
                  Connected Account Required
                </CardTitle>
                <CardDescription>
                  The gateway needs access to your Salesforce account. Click below to connect.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={handleConnectAccount} className="w-full">
                  Connect Salesforce Account
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  )
}
