"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Bot,
  Send,
  User,
  Loader2,
  Github,
  Users,
  TrendingUp,
  GitPullRequest,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from "@/components/icons"
import { tokenStore } from "@/lib/token-store"

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
  const [isExpanded, setIsExpanded] = useState(false)

  if (!steps || steps.length === 0) return null

  // Show first 3 steps, rest collapsed
  const visibleSteps = isExpanded ? steps : steps.slice(0, 3)
  const hasMore = steps.length > 3

  return (
    <div className="mb-3 rounded-lg border border-border/50 bg-muted/30 overflow-hidden">
      <div className="px-3 py-2 text-xs font-medium text-muted-foreground border-b border-border/50 flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
        Authentication Flow
      </div>
      <div className="p-3 space-y-1.5 text-xs font-mono">
        {visibleSteps.map((step, idx) => {
          const isError = step.startsWith("Error")
          const isSuccess =
            step.includes("success") ||
            step.includes("verified") ||
            step.includes("created") ||
            step.includes("Retrieved")
          const isStep = step.startsWith("Step")

          return (
            <div
              key={idx}
              className={`flex items-start gap-2 ${
                isError
                  ? "text-destructive"
                  : isSuccess
                    ? "text-green-600 dark:text-green-400"
                    : isStep
                      ? "text-foreground font-medium mt-2 first:mt-0"
                      : "text-muted-foreground pl-4"
              }`}
            >
              {isStep && (
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] text-primary font-semibold">
                  {step.match(/Step (\d)/)?.[1] || idx + 1}
                </span>
              )}
              {isSuccess && !isStep && <CheckCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />}
              {isError && <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />}
              <span className={isStep ? "" : ""}>
                {isStep ? step.replace(/Step \d: /, "") : step.replace(/^\s+/, "")}
              </span>
            </div>
          )
        })}
      </div>
      {hasMore && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/50 border-t border-border/50 flex items-center justify-center gap-1 transition-colors"
        >
          {isExpanded ? (
            <>
              <ChevronUp className="h-3 w-3" />
              Show less
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3" />
              Show {steps.length - 3} more steps
            </>
          )}
        </button>
      )}
    </div>
  )
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
      steps.push("Step 1: Token Exchange (ID-JAG)")
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

      steps.push("Step 2: Fetch HR Data")

      const hrResponse = await fetch("/api/resource/hr", {
        method: "GET",
        headers: { Authorization: `Bearer ${tokenData.accessToken}` },
      })

      if (!hrResponse.ok) {
        throw new Error("Failed to fetch HR data")
      }

      const hrData = await hrResponse.json()
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
      steps.push("Step 1: Token Exchange (ID-JAG)")
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

      steps.push("Step 2: Fetch KPI Data")

      const kpiResponse = await fetch("/api/resource/kpi", {
        method: "GET",
        headers: { Authorization: `Bearer ${tokenData.accessToken}` },
      })

      if (!kpiResponse.ok) {
        throw new Error("Failed to fetch KPI data")
      }

      const kpiData = await kpiResponse.json()
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
      steps.push("Step 1: Token Exchange (Vaulted Secret)")
      steps.push("grant_type: urn:ietf:params:oauth:grant-type:token-exchange")
      steps.push("requested_token_type: urn:okta:params:oauth:token-type:vaulted-secret")

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
        steps.push("Vaulted Secret Token stored")
      }

      steps.push("Vaulted secret received (expires: " + vaultData.expiresIn + "s)")
      steps.push("GitHub PAT retrieved (redacted)")

      steps.push("Step 2: GitHub API Call")

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

      if (repoData.steps) {
        repoData.steps.forEach((s: string) => steps.push(s))
      }

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
      steps.push("Step 1: Token Exchange (Vaulted Secret)")
      steps.push("requested_token_type: urn:okta:params:oauth:token-type:vaulted-secret")

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
        steps.push("Vaulted Secret Token stored")
      }

      steps.push("Vaulted secret received (expires: " + vaultData.expiresIn + "s)")
      steps.push("GitHub PAT retrieved (redacted)")

      steps.push("Step 2: Create GitHub PR")

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

      if (prData.steps) {
        prData.steps.forEach((s: string) => steps.push(s))
      }

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userInput = input.toLowerCase().trim()
    setInput("")

    if (userInput.includes("employee") || userInput.includes("hr")) {
      await handleEmployeeData()
    } else if (userInput.includes("kpi") || userInput.includes("metric") || userInput.includes("performance")) {
      await handleKPIData()
    } else if (
      userInput.includes("pr") ||
      userInput.includes("pull request") ||
      userInput.includes("create pr") ||
      userInput.includes("update readme")
    ) {
      await handleGitHubCreatePR()
    } else if (userInput.includes("github") || userInput.includes("repo") || userInput.includes("commit")) {
      await handleGitHubRepoInfo()
    } else {
      addMessage("user", input)
      addMessage(
        "assistant",
        "I can help you with:\n\n" +
          "1. Get Employee Data - HR information via token exchange\n" +
          "2. Get KPI Data - Performance metrics\n" +
          "3. Get GitHub Repo Info - Access private repo via vaulted secret\n" +
          "4. Create GitHub PR - Create PR via vaulted secret\n\n" +
          "Try: 'employee data', 'KPI metrics', 'GitHub repo', or 'create PR'",
      )
    }
  }

  const examplePrompts = [
    { label: "Employee Data", icon: Users, action: handleEmployeeData },
    { label: "KPI Metrics", icon: TrendingUp, action: handleKPIData },
    { label: "GitHub Repo Info", icon: Github, action: handleGitHubRepoInfo },
    { label: "Create GitHub PR", icon: GitPullRequest, action: handleGitHubCreatePR },
  ]

  return (
    <Card className="flex flex-col min-h-[600px] max-h-[80vh] shadow-lg">
      <CardHeader className="border-b bg-muted/30 py-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-lg">Enterprise Assistant</CardTitle>
            <CardDescription className="text-xs">Okta cross-app authentication</CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col p-0 min-h-0">
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4">
                <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Bot className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-center text-muted-foreground mb-6">
                  Welcome! Access enterprise data securely using Okta cross-app authentication.
                </p>
                <div className="grid grid-cols-2 gap-2 w-full max-w-sm">
                  {examplePrompts.map((prompt) => (
                    <Button
                      key={prompt.label}
                      variant="outline"
                      onClick={prompt.action}
                      disabled={isLoading}
                      className="h-auto py-3 px-4 flex flex-col items-center gap-2 hover:bg-muted bg-transparent"
                    >
                      <prompt.icon className="h-5 w-5" />
                      <span className="text-xs font-medium">{prompt.label}</span>
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((message) => (
                  <div key={message.id} className={`flex gap-3 ${message.role === "user" ? "flex-row-reverse" : ""}`}>
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : message.status === "error"
                            ? "bg-destructive/10 text-destructive"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {message.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                    </div>

                    <div
                      className={`flex-1 rounded-2xl px-4 py-3 ${
                        message.role === "user"
                          ? "bg-primary text-primary-foreground rounded-tr-sm"
                          : message.status === "error"
                            ? "bg-destructive/5 border border-destructive/20 rounded-tl-sm"
                            : "bg-muted rounded-tl-sm"
                      }`}
                    >
                      {message.role === "assistant" && message.steps && <StepsDisplay steps={message.steps} />}
                      <FormattedContent content={message.content} status={message.status} />
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <Bot className="h-4 w-4" />
                    </div>
                    <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm text-muted-foreground">Processing request...</span>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="border-t bg-background p-4 shrink-0">
          {messages.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {examplePrompts.map((prompt) => (
                <Button
                  key={prompt.label}
                  variant="secondary"
                  size="sm"
                  onClick={prompt.action}
                  disabled={isLoading}
                  className="h-7 text-xs gap-1.5"
                >
                  <prompt.icon className="h-3 w-3" />
                  {prompt.label}
                </Button>
              ))}
            </div>
          )}
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask for employee data, KPIs, or GitHub info..."
              className="flex-1 rounded-full border bg-muted/50 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              disabled={isLoading}
            />
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || isLoading}
              className="h-10 w-10 rounded-full shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  )
}
