"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Bot, Send, User, Loader2, Github, Users, TrendingUp, GitPullRequest } from "@/components/icons"
import { tokenStore } from "@/lib/token-store"
import { FlowDiagram, parseStepsToFlow } from "@/components/flow-diagram"

function TicketIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
      <path d="M13 5v2" />
      <path d="M13 17v2" />
      <path d="M13 11v2" />
    </svg>
  )
}

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  steps?: string[]
  data?: Record<string, unknown>
  status?: "success" | "error"
}

interface PKCEChatbotProps {
  idToken: string
}

function StepsDisplay({ steps }: { steps: string[] }) {
  if (!steps || steps.length === 0) return null

  const flowSteps = parseStepsToFlow(steps)

  if (flowSteps.length === 0) return null

  return <FlowDiagram steps={flowSteps} title="Authentication Flow" />
}

function FormattedContent({ content, status }: { content: string; status?: "success" | "error" }) {
  // Parse sections from content
  const lines = content.split("\n")
  const sections: { title: string; items: string[] }[] = []
  let currentSection: { title: string; items: string[] } | null = null

  lines.forEach((line) => {
    if (line.endsWith(":") && !line.startsWith(" ")) {
      if (currentSection) sections.push(currentSection)
      currentSection = { title: line.slice(0, -1), items: [] }
    } else if (currentSection && line.trim()) {
      currentSection.items.push(line)
    } else if (!currentSection && line.trim()) {
      if (!sections.length) sections.push({ title: "", items: [] })
      sections[0].items.push(line)
    }
  })
  if (currentSection) sections.push(currentSection)

  // If simple message, just render as text
  if (sections.length <= 1 && (!sections[0]?.items.length || sections[0].items.length <= 2)) {
    return <div className="text-sm whitespace-pre-wrap">{content}</div>
  }

  return (
    <div className="space-y-3">
      {sections.map((section, idx) => (
        <div key={idx}>
          {section.title && (
            <h4
              className={`text-sm font-semibold mb-1.5 ${status === "success" ? "text-green-700 dark:text-green-400" : ""}`}
            >
              {section.title}
            </h4>
          )}
          <div className="space-y-1 text-sm">
            {section.items.map((item, itemIdx) => {
              // Format key-value pairs
              const kvMatch = item.match(/^(\s*)([^:]+):\s*(.+)$/)
              if (kvMatch) {
                const [, indent, key, value] = kvMatch
                return (
                  <div key={itemIdx} className={`flex gap-2 ${indent ? "pl-4" : ""}`}>
                    <span className="text-muted-foreground shrink-0">{key}:</span>
                    <span className="font-medium">{value}</span>
                  </div>
                )
              }
              // Format list items
              if (item.match(/^\d+\./)) {
                return (
                  <div key={itemIdx} className="font-medium text-foreground">
                    {item}
                  </div>
                )
              }
              return (
                <div key={itemIdx} className="text-muted-foreground">
                  {item}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

export function PKCEChatbot({ idToken }: PKCEChatbotProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const decodeAndStoreToken = (token: string, type: string) => {
    try {
      const parts = token.split(".")
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1]))
        tokenStore.setToken(type, token, payload)
      } else {
        tokenStore.setToken(type, token)
      }
    } catch {
      tokenStore.setToken(type, token)
    }
  }

  const addMessage = (
    role: "user" | "assistant",
    content: string,
    steps?: string[],
    data?: Record<string, unknown>,
    status?: "success" | "error",
  ) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      role,
      content,
      timestamp: new Date(),
      steps,
      data,
      status,
    }
    setMessages((prev) => [...prev, newMessage])
    return newMessage
  }

  const handleEmployeeData = async () => {
    setIsLoading(true)
    addMessage("user", "Get Employee Data")

    const steps: string[] = []

    try {
      steps.push("Step 1: Token Exchange (Cross-App ID-JAG)")
      steps.push("grant_type: urn:ietf:params:oauth:grant-type:token-exchange")
      steps.push("requested_token_type: urn:ietf:params:oauth:token-type:id-jag")

      const tokenResponse = await fetch("/api/token-exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      })

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json()
        throw new Error(`Token exchange failed: ${errorData.details || errorData.error}`)
      }

      const tokenData = await tokenResponse.json()

      if (tokenData.idJagToken) {
        decodeAndStoreToken(tokenData.idJagToken, "id_jag_token")
        steps.push("ID-JAG Token received and stored")
      }

      steps.push("Access Token received (scope: " + (tokenData.scope || "hr:read") + ")")

      steps.push("Step 2: Fetch HR Data from Resource Server")
      steps.push("Using access token to authenticate")

      const hrResponse = await fetch("/api/resource/hr", {
        method: "GET",
        headers: { Authorization: `Bearer ${tokenData.accessToken}` },
      })

      if (!hrResponse.ok) {
        throw new Error("Failed to fetch HR data")
      }

      const hrData = await hrResponse.json()
      steps.push("HR data retrieved successfully")
      steps.push("Retrieved " + hrData.data.length + " employee records")

      let responseContent = "Employee Data Retrieved!\n\n"
      responseContent += "Employees:\n"

      hrData.data.forEach(
        (emp: { name: string; department: string; position: string; email: string; salary: number }, idx: number) => {
          responseContent += `${idx + 1}. ${emp.name}\n`
          responseContent += `   Department: ${emp.department}\n`
          responseContent += `   Position: ${emp.position}\n`
          responseContent += `   Email: ${emp.email}\n`
          responseContent += `   Salary: $${emp.salary.toLocaleString()}\n`
        },
      )

      addMessage("assistant", responseContent, steps, { employees: hrData.data }, "success")
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"
      steps.push("Error: " + errorMessage)
      addMessage("assistant", "Failed to retrieve employee data.\n\n" + errorMessage, steps, undefined, "error")
    } finally {
      setIsLoading(false)
    }
  }

  const handleKPIData = async () => {
    setIsLoading(true)
    addMessage("user", "Get KPI Data")

    const steps: string[] = []

    try {
      steps.push("Step 1: Token Exchange (Cross-App ID-JAG)")
      steps.push("grant_type: urn:ietf:params:oauth:grant-type:token-exchange")
      steps.push("requested_token_type: urn:ietf:params:oauth:token-type:id-jag")

      const tokenResponse = await fetch("/api/token-exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      })

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json()
        throw new Error(`Token exchange failed: ${errorData.details || errorData.error}`)
      }

      const tokenData = await tokenResponse.json()

      if (tokenData.idJagToken) {
        decodeAndStoreToken(tokenData.idJagToken, "id_jag_token")
        steps.push("ID-JAG Token received and stored")
      }

      steps.push("Access Token received")

      steps.push("Step 2: Fetch KPI Data from Resource Server")
      steps.push("Using access token to authenticate")

      const kpiResponse = await fetch("/api/resource/kpi", {
        method: "GET",
        headers: { Authorization: `Bearer ${tokenData.accessToken}` },
      })

      if (!kpiResponse.ok) {
        throw new Error("Failed to fetch KPI data")
      }

      const kpiData = await kpiResponse.json()
      steps.push("KPI data retrieved successfully")
      steps.push("Retrieved " + kpiData.data.length + " KPI metrics")

      let responseContent = "KPI Data Retrieved!\n\n"
      responseContent += "Key Performance Indicators:\n"

      kpiData.data.forEach(
        (kpi: { metric: string; value: number; unit: string; trend: string; change: number }, idx: number) => {
          const trendSymbol = kpi.trend === "up" ? "+" : kpi.trend === "down" ? "-" : ""
          responseContent += `${idx + 1}. ${kpi.metric}\n`
          responseContent += `   Value: ${kpi.value.toLocaleString()} ${kpi.unit}\n`
          responseContent += `   Trend: ${kpi.trend} (${trendSymbol}${kpi.change}%)\n`
        },
      )

      addMessage("assistant", responseContent, steps, { kpis: kpiData.data }, "success")
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"
      steps.push("Error: " + errorMessage)
      addMessage("assistant", "Failed to retrieve KPI data.\n\n" + errorMessage, steps, undefined, "error")
    } finally {
      setIsLoading(false)
    }
  }

  const handleGitHubRepoInfo = async () => {
    setIsLoading(true)
    addMessage("user", "Get GitHub Repository Info")

    const steps: string[] = []

    try {
      steps.push("Step 1: Token Exchange (PAM Vaulted Secret)")
      steps.push("grant_type: urn:ietf:params:oauth:grant-type:token-exchange")
      steps.push("requested_token_type: urn:okta:params:oauth:token-type:vaulted-secret")
      steps.push("resource: GITHUB_PAT_PATH")

      const vaultResponse = await fetch("/api/token-exchange/vaulted-secret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      })

      if (!vaultResponse.ok) {
        const errorData = await vaultResponse.json()
        if (errorData.details?.includes("subject_token")) {
          throw new Error("ID token expired - please re-authenticate")
        }
        throw new Error(`Vaulted secret exchange failed: ${errorData.details || errorData.error}`)
      }

      const vaultData = await vaultResponse.json()

      if (vaultData.issuedTokenType) {
        tokenStore.setToken("vaulted_secret_token", "***REDACTED***", {
          issued_token_type: vaultData.issuedTokenType,
          expires_in: vaultData.expiresIn,
          secret_key: vaultData.secretKeyName || "githubPAT",
        })
      }

      steps.push("Vaulted secret received (expires: " + vaultData.expiresIn + "s)")
      steps.push("GitHub PAT retrieved from vault")

      steps.push("Step 2: GitHub API Call")
      steps.push("Validating GitHub token")

      const githubResponse = await fetch("/api/github/repo-info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pat: vaultData.githubPat }),
      })

      if (!githubResponse.ok) {
        const errorData = await githubResponse.json()
        if (errorData.step === "validate_repo" && githubResponse.status === 404) {
          throw new Error("PAT not authorized for private repo - check fine-grained PAT repo selection")
        }
        throw new Error(`GitHub API call failed: ${errorData.error}`)
      }

      const repoData = await githubResponse.json()

      steps.push("Token validated for user: " + repoData.user)
      steps.push("Repository access verified: " + repoData.fullName)
      steps.push("Retrieved " + (repoData.recentCommits?.length || 0) + " recent commits")

      let responseContent = "GitHub Repository Info:\n\n"
      responseContent += `Repository: ${repoData.fullName}\n`
      responseContent += `Description: ${repoData.description || "No description"}\n`
      responseContent += `Private: ${repoData.private ? "Yes" : "No"}\n`
      responseContent += `Default Branch: ${repoData.defaultBranch}\n`
      responseContent += `Stars: ${repoData.stars}\n`
      responseContent += `Forks: ${repoData.forks}\n`
      responseContent += `Open Issues: ${repoData.openIssues}\n`
      responseContent += `Authenticated as: ${repoData.user}\n`

      if (repoData.recentCommits && repoData.recentCommits.length > 0) {
        responseContent += "\nRecent Commits:\n"
        repoData.recentCommits.forEach((commit: { message: string; author: string; date: string }, idx: number) => {
          responseContent += `${idx + 1}. ${commit.message.substring(0, 50)}${commit.message.length > 50 ? "..." : ""}\n`
          responseContent += `   by ${commit.author} on ${new Date(commit.date).toLocaleDateString()}\n`
        })
      }

      addMessage("assistant", responseContent, steps, { repo: repoData }, "success")
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"
      steps.push("Error: " + errorMessage)
      addMessage(
        "assistant",
        "Failed to retrieve GitHub repository info.\n\n" + errorMessage,
        steps,
        undefined,
        "error",
      )
    } finally {
      setIsLoading(false)
    }
  }

  const handleGitHubCreatePR = async () => {
    setIsLoading(true)
    addMessage("user", "Create GitHub PR")

    const steps: string[] = []

    try {
      steps.push("Step 1: Token Exchange (PAM Vaulted Secret)")
      steps.push("grant_type: urn:ietf:params:oauth:grant-type:token-exchange")
      steps.push("requested_token_type: urn:okta:params:oauth:token-type:vaulted-secret")
      steps.push("resource: GITHUB_PAT_PATH")

      const vaultResponse = await fetch("/api/token-exchange/vaulted-secret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      })

      if (!vaultResponse.ok) {
        const errorData = await vaultResponse.json()
        if (errorData.details?.includes("subject_token")) {
          throw new Error("ID token expired - please re-authenticate")
        }
        throw new Error(`Vaulted secret exchange failed: ${errorData.details || errorData.error}`)
      }

      const vaultData = await vaultResponse.json()

      if (vaultData.issuedTokenType) {
        tokenStore.setToken("vaulted_secret_token", "***REDACTED***", {
          issued_token_type: vaultData.issuedTokenType,
          expires_in: vaultData.expiresIn,
          secret_key: vaultData.secretKeyName || "githubPAT",
        })
      }

      steps.push("Vaulted secret received (expires: " + vaultData.expiresIn + "s)")
      steps.push("GitHub PAT retrieved from vault")

      steps.push("Step 2: Create GitHub PR")
      steps.push("Validating GitHub token")

      const prResponse = await fetch("/api/github/create-pr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pat: vaultData.githubPat }),
      })

      if (!prResponse.ok) {
        const errorData = await prResponse.json()
        if (errorData.step === "validate_repo" && prResponse.status === 404) {
          throw new Error("PAT not authorized for private repo - check fine-grained PAT repo selection")
        }
        throw new Error(`GitHub PR creation failed at step '${errorData.step}': ${errorData.error}`)
      }

      const prData = await prResponse.json()

      steps.push("Token validated for user: " + prData.user)
      steps.push("Repository access verified: " + prData.repo)
      steps.push("Branch created: " + prData.branch)
      steps.push("README.md updated with demo timestamp")
      steps.push("Pull request created successfully")

      let responseContent = "GitHub PR Created!\n\n"
      responseContent += `Repository: ${prData.repo}\n`
      responseContent += `Branch: ${prData.branch}\n`
      responseContent += `PR URL: ${prData.prUrl}\n`
      responseContent += `PR Number: #${prData.prNumber}\n`
      responseContent += `Authenticated as: ${prData.user}\n`

      addMessage("assistant", responseContent, steps, { pr: prData }, "success")
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"
      steps.push("Error: " + errorMessage)

      let failureContent = "Failed to create GitHub PR.\n\n"
      failureContent += errorMessage

      if (errorMessage.includes("re-authenticate")) {
        failureContent += "\n\nHint: Your session may have expired. Please refresh and sign in again."
      } else if (errorMessage.includes("vaulted_secret")) {
        failureContent += "\n\nHint: Check GITHUB_PAT_PATH and GITHUB_SECRET_KEY_NAME env vars."
      } else if (errorMessage.includes("404") || errorMessage.includes("not authorized")) {
        failureContent += "\n\nHint: PAT not authorized for private repo."
      }

      addMessage("assistant", failureContent, steps, undefined, "error")
    } finally {
      setIsLoading(false)
    }
  }

  const handleServiceNowTicket = async () => {
    setIsLoading(true)
    addMessage("user", "Create ServiceNow Ticket")

    const steps: string[] = []

    try {
      steps.push("Step 1: Token Exchange (PAM Service Account)")
      steps.push("grant_type: urn:ietf:params:oauth:grant-type:token-exchange")
      steps.push("requested_token_type: urn:okta:params:oauth:token-type:service-account")
      steps.push("resource: SERVICENOW_SECRET_PATH")

      const serviceAccountResponse = await fetch("/api/token-exchange/service-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      })

      if (!serviceAccountResponse.ok) {
        const errorData = await serviceAccountResponse.json()
        if (errorData.details?.includes("subject_token")) {
          throw new Error("ID token expired - please re-authenticate")
        }
        throw new Error(`Service account exchange failed: ${errorData.details || errorData.error}`)
      }

      const serviceAccountData = await serviceAccountResponse.json()

      tokenStore.setToken("service_account_token", "***REDACTED***", {
        issued_token_type: serviceAccountData.issuedTokenType,
        expires_in: serviceAccountData.expiresIn,
        username: serviceAccountData.username,
      })

      steps.push("Service account credentials received (expires: " + serviceAccountData.expiresIn + "s)")
      steps.push("Username: " + serviceAccountData.username)
      steps.push("Password retrieved from vault")

      steps.push("Step 2: Create ServiceNow Ticket")
      steps.push("Using Basic Auth with PAM credentials")

      const ticketResponse = await fetch("/api/servicenow/create-ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: serviceAccountData.username,
          password: serviceAccountData.password,
          shortDescription: "Demo ticket from Okta Cross-App Access",
          description: "This ticket was created via Okta PAM service account integration",
        }),
      })

      if (!ticketResponse.ok) {
        const errorData = await ticketResponse.json()
        throw new Error(`ServiceNow ticket creation failed: ${errorData.error}`)
      }

      const ticketData = await ticketResponse.json()

      steps.push("Authenticated with ServiceNow")
      steps.push("Ticket created successfully")

      let responseContent = "ServiceNow Ticket Created!\n\n"
      responseContent += `Ticket Number: ${ticketData.ticketNumber}\n`
      responseContent += `Sys ID: ${ticketData.sysId}\n`
      responseContent += `State: ${ticketData.state}\n`
      responseContent += `Priority: ${ticketData.priority}\n`
      responseContent += `Short Description: ${ticketData.shortDescription}\n`

      if (ticketData.ticketUrl) {
        responseContent += `URL: ${ticketData.ticketUrl}\n`
      }

      addMessage("assistant", responseContent, steps, { ticket: ticketData }, "success")
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"
      steps.push("Error: " + errorMessage)

      let failureContent = "Failed to create ServiceNow ticket.\n\n"
      failureContent += errorMessage

      if (errorMessage.includes("re-authenticate")) {
        failureContent += "\n\nHint: Your session may have expired. Please refresh and sign in again."
      } else if (errorMessage.includes("service_account") || errorMessage.includes("SERVICENOW_SECRET_PATH")) {
        failureContent += "\n\nHint: Check SERVICENOW_SECRET_PATH env var configuration."
      }

      addMessage("assistant", failureContent, steps, undefined, "error")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const query = input.toLowerCase().trim()
    setInput("")

    if (query.includes("employee") || query.includes("hr")) {
      await handleEmployeeData()
    } else if (query.includes("kpi") || query.includes("metric")) {
      await handleKPIData()
    } else if (query.includes("github") && query.includes("pr")) {
      await handleGitHubCreatePR()
    } else if (query.includes("github") || query.includes("repo")) {
      await handleGitHubRepoInfo()
    } else if (query.includes("servicenow") || query.includes("ticket")) {
      await handleServiceNowTicket()
    } else {
      addMessage("user", input)
      addMessage(
        "assistant",
        "I can help you with:\n\n" +
          "- Employee Data - Get HR employee information\n" +
          "- KPI Metrics - View key performance indicators\n" +
          "- GitHub Repo Info - View repository details\n" +
          "- Create GitHub PR - Create a pull request\n" +
          "- ServiceNow Ticket - Create a support ticket\n\n" +
          "Try asking for one of these!",
      )
    }
  }

  const quickActions = [
    { label: "Employee Data", icon: Users, action: handleEmployeeData },
    { label: "KPI Metrics", icon: TrendingUp, action: handleKPIData },
    { label: "GitHub Repo Info", icon: Github, action: handleGitHubRepoInfo },
    { label: "Create GitHub PR", icon: GitPullRequest, action: handleGitHubCreatePR },
    { label: "ServiceNow Ticket", icon: TicketIcon, action: handleServiceNowTicket },
  ]

  return (
    <Card className="flex flex-col min-h-[600px] max-h-[80vh]">
      <CardHeader className="shrink-0 border-b">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <Bot className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">Enterprise Assistant</CardTitle>
            <CardDescription>Okta cross-app authentication</CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col min-h-0 p-0">
        {/* Messages area with scroll */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-8">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                <Bot className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Welcome to Enterprise Assistant</h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-md">
                Access enterprise data using Okta cross-app authentication. Select an action below or type a request.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 w-full max-w-lg">
                {quickActions.map((action) => (
                  <Button
                    key={action.label}
                    variant="outline"
                    size="sm"
                    onClick={action.action}
                    disabled={isLoading}
                    className="flex items-center gap-2 h-auto py-3 bg-transparent"
                  >
                    <action.icon className="h-4 w-4" />
                    <span className="text-xs">{action.label}</span>
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {message.role === "assistant" && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                )}

                <div
                  className={`rounded-2xl px-4 py-3 max-w-[85%] ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : message.status === "error"
                        ? "bg-destructive/10 border border-destructive/20"
                        : "bg-muted"
                  }`}
                >
                  {/* Flow Diagram for steps */}
                  {message.steps && message.steps.length > 0 && <StepsDisplay steps={message.steps} />}

                  {/* Message content */}
                  <FormattedContent content={message.content} status={message.status} />

                  {/* Timestamp */}
                  <div
                    className={`text-[10px] mt-2 ${
                      message.role === "user" ? "text-primary-foreground/70" : "text-muted-foreground"
                    }`}
                  >
                    {message.timestamp.toLocaleTimeString()}
                  </div>
                </div>

                {message.role === "user" && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                    <User className="h-4 w-4" />
                  </div>
                )}
              </div>
            ))
          )}

          {isLoading && (
            <div className="flex gap-3 justify-start">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <div className="bg-muted rounded-2xl px-4 py-3">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Processing request...</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Quick actions bar when messages exist */}
        {messages.length > 0 && (
          <div className="shrink-0 border-t p-2 bg-muted/30">
            <div className="flex flex-wrap gap-1.5 justify-center">
              {quickActions.map((action) => (
                <Button
                  key={action.label}
                  variant="ghost"
                  size="sm"
                  onClick={action.action}
                  disabled={isLoading}
                  className="h-7 text-xs gap-1.5"
                >
                  <action.icon className="h-3.5 w-3.5" />
                  {action.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Input area */}
        <div className="shrink-0 border-t p-4">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask for employee data, KPIs, or GitHub info..."
              disabled={isLoading}
              className="flex-1 rounded-full border border-input bg-background px-4 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
            <Button type="submit" size="icon" disabled={isLoading || !input.trim()} className="rounded-full shrink-0">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  )
}
