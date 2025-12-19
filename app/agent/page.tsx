"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Shield, Send, Loader2, XCircle } from "@/components/icons"
import { isWebAuthenticated, clearWebTokens } from "@/lib/web-auth-client"
import { LoginButton } from "@/components/login-button"
import { tokenStore } from "@/lib/token-store"
import { TokenPanel } from "@/components/token-panel"

export default function AgentPage() {
  const [authenticated, setAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showTokens, setShowTokens] = useState(true)
  const [connectedAccount, setConnectedAccount] = useState<string | null>(null)
  const [pendingConnection, setPendingConnection] = useState<{
    connectUri: string
    ticket: string
    authSession: string
    popup?: Window | null
    sessionId?: string
  } | null>(null)
  const [showConnectAccount, setShowConnectAccount] = useState(false)

  const [inputValue, setInputValue] = useState("")

  const [messages, setMessages] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)

  const [userInfo, setUserInfo] = useState<{ name?: string; email?: string } | null>(null)
  const [pendingRetry, setPendingRetry] = useState<string | null>(null)

  const [needsConnection, setNeedsConnection] = useState(false)
  const [connectedAccounts, setConnectedAccounts] = useState<Array<{ id: string; connection: string }>>([])
  const [loadingAccounts, setLoadingAccounts] = useState(false)
  const [meAccessToken, setMeAccessToken] = useState<string | null>(null)

  useEffect(() => {
    setAuthenticated(isWebAuthenticated())
    setLoading(false)
    const savedConnectedAccount = sessionStorage.getItem("connectedSalesforceAccount")
    if (savedConnectedAccount) {
      setConnectedAccount(savedConnectedAccount)
    }

    // Decode Web ID Token to get user information
    const webIdToken = document.cookie
      .split("; ")
      .find((row) => row.startsWith("okta_web_id_token="))
      ?.split("=")[1]

    if (webIdToken) {
      try {
        const payload = JSON.parse(atob(webIdToken.split(".")[1]))
        setUserInfo({
          name: payload.name || payload.email?.split("@")[0],
          email: payload.email,
        })
      } catch (error) {
        console.error("[v0] Error decoding token:", error)
      }
    }

    loadConnectedAccounts()
  }, [])

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "salesforce-connected") {
        console.log("[v0] Salesforce account connected successfully")
        setConnectedAccount("Salesforce")
        sessionStorage.setItem("connectedSalesforceAccount", "Salesforce")
        setPendingConnection(null)

        if (pendingRetry) {
          console.log("[v0] Auto-retrying original request:", pendingRetry)
          setTimeout(() => {
            sendMessage(pendingRetry)
            setPendingRetry(null)
          }, 1000)
        }
      }
    }

    window.addEventListener("message", handleMessage)
    return () => window.removeEventListener("message", handleMessage)
  }, [pendingRetry])

  useEffect(() => {
    messages.forEach((message) => {
      if (message.role === "assistant") {
        message.toolInvocations?.forEach((toolInvocation) => {
          if (toolInvocation.state === "result" && toolInvocation.result) {
            const result = toolInvocation.result as any
            console.log("[v0] Tool result received:", toolInvocation.toolName, result)

            if (result.tokens) {
              Object.entries(result.tokens).forEach(([key, value]) => {
                if (typeof value === "string") {
                  console.log(`[v0] Storing token: ${key}`)
                  tokenStore.setToken(key as any, value)
                }
              })
            }

            if (result.requiresConnection && result.connectUri) {
              console.log("[v0] Agent detected connection required")
              setPendingConnection({
                connectUri: result.connectUri,
                ticket: result.ticket,
                authSession: result.authSession,
              })
            }

            if (result.authorizationUrl && result.sessionId) {
              console.log("[v0] Agent initiated connected account flow")

              sessionStorage.setItem(
                `ca_session_${result.sessionId}`,
                JSON.stringify({
                  auth_session: result.authSession,
                  me_token: result.meAccessToken,
                  code_verifier: result.codeVerifier,
                }),
              )

              const width = 600
              const height = 700
              const left = window.screenX + (window.outerWidth - width) / 2
              const top = window.screenY + (window.outerHeight - height) / 2

              window.open(
                result.authorizationUrl,
                "Connect Salesforce Account",
                `width=${width},height=${height},left=${left},top=${top},popup=yes`,
              )
            }
          }
        })
      }
    })
  }, [messages])

  useEffect(() => {
    console.log("[v0] Current input value:", inputValue)
  }, [inputValue])

  const handleLogout = () => {
    clearWebTokens()
    setAuthenticated(false)
  }

  const sendMessage = async (content: string) => {
    if (!content.trim()) return

    const userMessage = {
      id: Date.now().toString(),
      role: "user",
      content,
    }

    const messagesWithUser = [...messages, userMessage]
    setMessages(messagesWithUser)
    setIsLoading(true)
    setInputValue("")
    setNeedsConnection(false)

    try {
      console.log("[v0] Sending message to agent API")

      const response = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: messagesWithUser }),
      })

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }

      const contentType = response.headers.get("content-type") || ""
      console.log("[v0] Response content-type:", contentType)

      if (contentType.includes("application/json")) {
        const data = await response.json()
        console.log("[v0] Received JSON response with tokens:", Object.keys(data.tokens || {}))

        // Store all tokens in the token store
        if (data.tokens) {
          if (data.tokens.web_id_token) {
            tokenStore.setToken("web_id_token", data.tokens.web_id_token)
          }
          if (data.tokens.web_access_token) {
            tokenStore.setToken("web_access_token", data.tokens.web_access_token)
          }
          if (data.tokens.id_jag_token) {
            tokenStore.setToken("id_jag_token", data.tokens.id_jag_token)
          }
          if (data.tokens.auth0_access_token) {
            tokenStore.setToken("auth0_access_token", data.tokens.auth0_access_token)
          }
        }

        if (data.requiresConnection) {
          console.log("[v0] Connection required - showing connect button")
          setNeedsConnection(true)
          setPendingRetry(content) // Save the original query to retry after connection
        }

        // Add assistant message with the result
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: data.result,
          },
        ])
        return
      }

      // Handle plain text response
      if (contentType.includes("text/plain")) {
        const text = await response.text()
        console.log("[v0] Received plain text response, length:", text.length)

        setMessages((prev) => prev.map((msg) => (msg.id === userMessage.id ? { ...msg, content: text } : msg)))
        return
      }
    } catch (error) {
      console.error("[v0] Error sending message:", error)
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content:
            "I received your request but encountered an issue retrieving the data. Please check the console logs for details.",
        },
      ])
      setIsLoading(false)
    } finally {
      setIsLoading(false)
    }
  }

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const trimmedInput = inputValue.trim()
    if (!trimmedInput || isLoading) {
      return
    }

    await sendMessage(trimmedInput)
    setInputValue("")
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value)
  }

  const loadConnectedAccounts = async () => {
    setLoadingAccounts(true)
    try {
      const response = await fetch("/api/gateway-test/list-connected-accounts")
      if (response.ok) {
        const data = await response.json()
        setConnectedAccounts(data.connections || [])

        // Update connectedAccount state if Salesforce is connected
        const salesforceConnection = data.connections?.find((c: any) =>
          c.connection?.toLowerCase().includes("salesforce"),
        )
        if (salesforceConnection) {
          setConnectedAccount("Salesforce")
        }
      }
    } catch (error) {
      console.error("[v0] Error loading connected accounts:", error)
    } finally {
      setLoadingAccounts(false)
    }
  }

  const getMeAccessToken = async () => {
    try {
      console.log("[v0] Getting ME access token for connected account flow")

      // Step 1: Get Web ID Token from session storage
      const webIdToken = sessionStorage.getItem("web_okta_id_token")
      if (!webIdToken) {
        throw new Error("No Web ID Token available. Please authenticate first.")
      }

      console.log("[v0] Using Web ID Token from session storage")

      // Step 2: Exchange Web ID Token for ME ID-JAG
      console.log("[v0] Exchanging Web ID Token for ME ID-JAG")
      const jagResponse = await fetch("/api/gateway-test/me-jag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: webIdToken }),
      })

      if (!jagResponse.ok) {
        const error = await jagResponse.json()
        console.error("[v0] Failed to get ME ID-JAG:", error)
        throw new Error(error.message || "Failed to get ID-JAG for /me/")
      }

      const { idJagToken } = await jagResponse.json()
      console.log("[v0] Received ME ID-JAG")
      tokenStore.setToken("me_id_jag_token", idJagToken)

      // Step 3: Exchange ME ID-JAG for Auth0 /me/ access token
      console.log("[v0] Exchanging ME ID-JAG for Auth0 /me/ access token")
      const auth0Response = await fetch("/api/gateway-test/me-auth0-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idJagToken }),
      })

      if (!auth0Response.ok) {
        const error = await auth0Response.json()
        console.error("[v0] Failed to get ME Auth0 access token:", error)
        throw new Error(error.message || "Failed to get Auth0 /me/ access token")
      }

      const { accessToken } = await auth0Response.json()
      console.log("[v0] Received Auth0 /me/ access token")

      setMeAccessToken(accessToken)
      tokenStore.setToken("me_auth0_access_token", accessToken)

      return accessToken
    } catch (error) {
      console.error("[v0] Failed to get ME access token:", error)
      throw error
    }
  }

  const handleConnectAccount = async () => {
    console.log("[v0] Initiating Salesforce connection flow")
    setIsConnecting(true)

    try {
      const token = await getMeAccessToken()

      if (!token) {
        throw new Error("Failed to obtain ME access token")
      }

      const response = await fetch("/api/gateway-test/connect-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meAccessToken: token,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error("[v0] Failed to initiate connection:", errorData)
        throw new Error(errorData.message || "Failed to initiate connection")
      }

      const data = await response.json()
      console.log("[v0] Connection data received:", data)

      const sessionId = Date.now().toString()
      const sessionData = {
        authSession: data.auth_session,
        meToken: token,
        codeVerifier: data.code_verifier,
      }

      sessionStorage.setItem(`ca_session_${sessionId}`, JSON.stringify(sessionData))
      console.log("[v0] Session data stored with ID:", sessionId)

      const ticket = data.connect_params?.ticket || data.ticket
      const connectUrl = ticket ? `${data.connect_uri}?ticket=${ticket}` : data.connect_uri

      console.log("[v0] Opening connect URL:", connectUrl)

      const width = 600
      const height = 700
      const left = window.screenX + (window.outerWidth - width) / 2
      const top = window.screenY + (window.outerHeight - height) / 2

      const popup = window.open(
        connectUrl,
        "Connect Salesforce",
        `width=${width},height=${height},left=${left},top=${top}`,
      )

      if (popup) {
        setPendingConnection({ connectUri: "", ticket: "", authSession: "", popup, sessionId })
      }
    } catch (error) {
      console.error("[v0] Error connecting account:", error)
      setIsConnecting(false)
      alert(`Failed to initiate connection: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  const handleDeleteConnection = async (connectionId: string) => {
    if (!confirm("Are you sure you want to delete this connected account?")) {
      return
    }

    try {
      const response = await fetch("/api/gateway-test/delete-connected-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId }),
      })

      if (!response.ok) {
        throw new Error("Failed to delete connection")
      }

      // Refresh the list
      await loadConnectedAccounts()

      // Clear local state
      setConnectedAccount(null)
      sessionStorage.removeItem("connectedSalesforceAccount")
    } catch (error) {
      console.error("[v0] Error deleting connection:", error)
      alert("Failed to delete connection. Please try again.")
    }
  }

  const examplePrompts = ["Get Salesforce opportunities", "Show me financial data", "What are the latest sales leads?"]

  const handlePromptClick = async (prompt: string) => {
    if (isLoading) return

    await sendMessage(prompt)
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
              <p className="text-xs text-muted-foreground">Direct API Mode</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {userInfo && (
              <div className="flex items-center gap-2 rounded-lg border bg-muted px-3 py-1.5">
                <span className="text-sm font-medium">Welcome, {userInfo.name || userInfo.email}</span>
              </div>
            )}
            <Button onClick={() => setShowTokens(!showTokens)} variant="outline" size="sm">
              {showTokens ? "Hide Tokens" : "Show Tokens"}
            </Button>
            <Button onClick={handleLogout} variant="outline" className="gap-2 bg-transparent">
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto flex flex-1 flex-col p-4">
        <div className="mx-auto flex w-full max-w-7xl flex-1 gap-4">
          <div className="flex-1 space-y-4">
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
                      <div className="flex flex-1 flex-col items-center justify-center text-muted-foreground">
                        <div className="text-center">
                          <p className="mb-4 text-sm font-medium">Welcome! Try asking:</p>
                          <div className="flex flex-col gap-2">
                            {examplePrompts.map((prompt, index) => (
                              <Button
                                key={index}
                                onClick={() => handlePromptClick(prompt)}
                                variant="outline"
                                className="w-full justify-start"
                                disabled={isLoading}
                              >
                                {prompt}
                              </Button>
                            ))}
                          </div>
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
                          {message.content && (
                            <div className="prose prose-sm dark:prose-invert max-w-none">
                              <pre className="whitespace-pre-wrap font-sans">{message.content}</pre>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}

                    {isLoading && (
                      <div className="flex justify-start">
                        <div className="flex items-center gap-2 rounded-lg bg-secondary px-4 py-2 text-secondary-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-sm">Thinking...</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <form onSubmit={handleFormSubmit} className="flex gap-2">
                    <input
                      type="text"
                      value={inputValue}
                      onChange={handleInputChange}
                      placeholder="Ask the agent to retrieve data..."
                      disabled={isLoading}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 flex-1"
                      autoComplete="off"
                    />
                    <Button type="submit" disabled={isLoading || !inputValue.trim()}>
                      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </form>
                </div>
              </CardContent>
            </Card>

            {needsConnection && (
              <Card className="border-orange-500">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <XCircle className="h-5 w-5 text-orange-500" />
                    Salesforce Account Connection Required
                  </CardTitle>
                  <CardDescription>
                    The Gateway needs to connect to your Salesforce account to retrieve data. Click below to authorize
                    access.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button onClick={handleConnectAccount} className="w-full">
                    Connect Salesforce Account
                  </Button>
                </CardContent>
              </Card>
            )}

            {connectedAccounts.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Connected Accounts</CardTitle>
                  <CardDescription>Manage your connected enterprise accounts</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {connectedAccounts.map((account) => (
                      <div
                        key={account.id}
                        className="flex items-center justify-between rounded-lg border bg-muted/50 p-3"
                      >
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-green-500" />
                          <span className="font-medium">{account.connection}</span>
                        </div>
                        <Button
                          onClick={() => handleDeleteConnection(account.id)}
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:bg-red-100 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950"
                        >
                          Delete
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {showTokens && (
            <div className="w-96">
              <TokenPanel />
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
