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
  } | null>(null)

  const [inputValue, setInputValue] = useState("")

  const [messages, setMessages] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const [userInfo, setUserInfo] = useState<{ name?: string; email?: string } | null>(null)
  const [pendingRetry, setPendingRetry] = useState<string | null>(null)

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
    if (isLoading) return

    const userMessage = {
      id: Date.now().toString(),
      role: "user",
      content,
    }

    setMessages((prev) => [...prev, userMessage])
    setIsLoading(true)
    setInputValue("")

    try {
      console.log("[v0] Sending message:", content)

      const response = await fetch("/api/agent/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [...messages, userMessage],
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      const assistantMessageId = (Date.now() + 1).toString()
      let accumulatedContent = ""

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split("\n")

          for (const line of lines) {
            if (!line.trim()) continue

            // AI SDK UI message stream format
            if (line.startsWith("0:")) {
              try {
                const data = JSON.parse(line.slice(2))

                // Handle text chunks
                if (typeof data === "string") {
                  accumulatedContent += data

                  // Update message in state
                  setMessages((prev) => {
                    const existing = prev.find((m) => m.id === assistantMessageId)
                    if (existing) {
                      return prev.map((m) => (m.id === assistantMessageId ? { ...m, content: accumulatedContent } : m))
                    } else {
                      return [
                        ...prev,
                        {
                          id: assistantMessageId,
                          role: "assistant",
                          content: accumulatedContent,
                        },
                      ]
                    }
                  })
                }
              } catch (e) {
                console.error("[v0] Error parsing stream chunk:", e)
              }
            }
            // Handle tool calls and results
            else if (line.startsWith("9:")) {
              try {
                const data = JSON.parse(line.slice(2))
                console.log("[v0] Tool data received:", data)

                // Update tokens if available in tool result
                if (data.result && typeof data.result === "object") {
                  const result = data.result

                  if (result.tokens) {
                    Object.entries(result.tokens).forEach(([key, value]) => {
                      if (typeof value === "string") {
                        console.log(`[v0] Storing token: ${key}`)
                        tokenStore.setToken(key as any, value)
                      }
                    })
                  }

                  // Handle connected account requirement
                  if (result.requiresConnection) {
                    console.log("[v0] Connection required, saving retry request")
                    setPendingRetry(content)
                  }
                }
              } catch (e) {
                console.error("[v0] Error parsing tool data:", e)
              }
            }
          }
        }
      }

      console.log("[v0] Stream completed successfully")
    } catch (error) {
      console.error("[v0] Error sending message:", error)
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Sorry, there was an error processing your request.",
      }
      setMessages((prev) => [...prev, errorMessage])
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

  const handleConnectAccount = () => {
    if (!pendingConnection) return

    const connectUrl = `${pendingConnection.connectUri}?ticket=${pendingConnection.ticket}`

    const width = 600
    const height = 700
    const left = window.screenX + (window.outerWidth - width) / 2
    const top = window.screenY + (window.outerHeight - height) / 2

    window.open(
      connectUrl,
      "Connect Salesforce Account",
      `width=${width},height=${height},left=${left},top=${top},popup=yes`,
    )

    sessionStorage.setItem("pendingAuthSession", pendingConnection.authSession)
  }

  const handleDeleteConnection = () => {
    if (confirm("Are you sure you want to delete the Salesforce connected account?")) {
      setConnectedAccount(null)
      sessionStorage.removeItem("connectedSalesforceAccount")
      Object.keys(sessionStorage).forEach((key) => {
        if (key.startsWith("ca_session_")) {
          sessionStorage.removeItem(key)
        }
      })
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
            {connectedAccount && (
              <div className="flex items-center gap-2 rounded-lg border border-green-500/20 bg-green-500/10 px-3 py-1.5">
                <span className="text-sm font-medium text-green-700 dark:text-green-400">
                  {connectedAccount} Connected
                </span>
                <Button
                  onClick={handleDeleteConnection}
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-red-600 hover:bg-red-100 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950"
                >
                  Delete
                </Button>
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

                          {message.toolInvocations?.map((toolInvocation, index) => (
                            <div key={index} className="mt-2 space-y-2">
                              {toolInvocation.state === "result" && (
                                <div className="rounded border bg-muted/50 p-3">
                                  <div className="mb-1 text-xs font-semibold text-muted-foreground">
                                    Tool: {toolInvocation.toolName}
                                  </div>
                                  <div className="text-sm">
                                    {typeof toolInvocation.result === "string" ? (
                                      <pre className="whitespace-pre-wrap font-mono text-xs">
                                        {toolInvocation.result}
                                      </pre>
                                    ) : (
                                      <pre className="whitespace-pre-wrap font-mono text-xs">
                                        {JSON.stringify(toolInvocation.result, null, 2)}
                                      </pre>
                                    )}
                                  </div>
                                </div>
                              )}
                              {toolInvocation.state === "call" && (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                  <span>Calling {toolInvocation.toolName}...</span>
                                </div>
                              )}
                            </div>
                          ))}
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

            {pendingConnection && !connectedAccount && (
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
