"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Bot, Send, User, Loader2, Github, Users, TrendingUp, GitPullRequest } from "@/components/icons"

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
      steps.push("Step 1: Exchanging ID Token for Access Token...")
      steps.push("  grant_type: urn:ietf:params:oauth:grant-type:token-exchange")

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
      steps.push("  Access Token received (scope: " + (tokenData.scope || "hr:read") + ")")

      steps.push("Step 2: Fetching Employee Data from HR Resource Server...")

      const hrResponse = await fetch("/api/resource/hr", {
        method: "GET",
        headers: { Authorization: `Bearer ${tokenData.accessToken}` },
      })

      if (!hrResponse.ok) {
        throw new Error("Failed to fetch HR data")
      }

      const hrData = await hrResponse.json()
      steps.push("  Retrieved " + hrData.data.length + " employee records")

      let responseContent = "Employee Data Retrieved Successfully!\n\n"
      responseContent += "Found " + hrData.data.length + " employees:\n\n"

      hrData.data.forEach(
        (emp: { name: string; department: string; position: string; email: string; salary: number }, idx: number) => {
          responseContent += `${idx + 1}. ${emp.name}\n`
          responseContent += `   Department: ${emp.department}\n`
          responseContent += `   Position: ${emp.position}\n`
          responseContent += `   Email: ${emp.email}\n`
          responseContent += `   Salary: $${emp.salary.toLocaleString()}\n\n`
        },
      )

      addMessage("assistant", responseContent, steps, { employees: hrData.data }, "success")
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"
      steps.push("Error: " + errorMessage)
      addMessage("assistant", "Failed to retrieve employee data. " + errorMessage, steps, undefined, "error")
    } finally {
      setIsLoading(false)
    }
  }

  const handleKPIData = async () => {
    setIsLoading(true)
    addMessage("user", "Get KPI Data")

    const steps: string[] = []

    try {
      steps.push("Step 1: Exchanging ID Token for Access Token...")

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
      steps.push("  Access Token received")

      steps.push("Step 2: Fetching KPI Data from KPI Resource Server...")

      const kpiResponse = await fetch("/api/resource/kpi", {
        method: "GET",
        headers: { Authorization: `Bearer ${tokenData.accessToken}` },
      })

      if (!kpiResponse.ok) {
        throw new Error("Failed to fetch KPI data")
      }

      const kpiData = await kpiResponse.json()
      steps.push("  Retrieved " + kpiData.data.length + " KPI metrics")

      let responseContent = "KPI Data Retrieved Successfully!\n\n"
      responseContent += "Key Performance Indicators:\n\n"

      kpiData.data.forEach(
        (kpi: { metric: string; value: number; unit: string; trend: string; change: number }, idx: number) => {
          const trendSymbol = kpi.trend === "up" ? "+" : kpi.trend === "down" ? "-" : ""
          responseContent += `${idx + 1}. ${kpi.metric}\n`
          responseContent += `   Value: ${kpi.value.toLocaleString()} ${kpi.unit}\n`
          responseContent += `   Trend: ${kpi.trend} (${trendSymbol}${kpi.change}%)\n\n`
        },
      )

      addMessage("assistant", responseContent, steps, { kpis: kpiData.data }, "success")
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"
      steps.push("Error: " + errorMessage)
      addMessage("assistant", "Failed to retrieve KPI data. " + errorMessage, steps, undefined, "error")
    } finally {
      setIsLoading(false)
    }
  }

  const handleGitHubRepoInfo = async () => {
    setIsLoading(true)
    addMessage("user", "Get GitHub Repository Info")

    const steps: string[] = []

    try {
      // Step 1: Token Exchange for vaulted secret
      steps.push("Step 1: Token Exchange (retrieve vaulted secret)")
      steps.push("  Endpoint: POST {{ORG_URL}}/oauth2/v1/token")
      steps.push("  grant_type: urn:ietf:params:oauth:grant-type:token-exchange")
      steps.push("  requested_token_type: urn:okta:params:oauth:token-type:vaulted-secret")
      steps.push("  resource: {{GITHUB_PAT_PATH}}")

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
      steps.push("  Token-exchange success (vaulted-secret issued)")
      steps.push("  expires_in: " + vaultData.expiresIn + " seconds")
      steps.push("  GitHub PAT retrieved from vault (redacted)")

      // Step 2: GitHub Action - Get Repo Info
      steps.push("Step 2: GitHub Action (Retrieve Repo Info)")
      steps.push("  Using GitHub REST API with PAT")

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

      // Add GitHub steps to our steps
      if (repoData.steps) {
        repoData.steps.forEach((s: string) => steps.push("  " + s))
      }

      let responseContent = "GitHub Repository Info Retrieved!\n\n"
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
          responseContent += `  ${idx + 1}. ${commit.message.substring(0, 50)}${commit.message.length > 50 ? "..." : ""}\n`
          responseContent += `     by ${commit.author} on ${new Date(commit.date).toLocaleDateString()}\n`
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
    addMessage("user", "Create GitHub PR (Update README)")

    const steps: string[] = []

    try {
      // Step 1: Token Exchange for vaulted secret
      steps.push("Step 1: Token Exchange (retrieve vaulted secret)")
      steps.push("  grant_type: urn:ietf:params:oauth:grant-type:token-exchange")
      steps.push("  requested_token_type: urn:okta:params:oauth:token-type:vaulted-secret")

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
      steps.push("  Token-exchange success (vaulted-secret issued, expires_in=" + vaultData.expiresIn + ")")
      steps.push("  GitHub PAT retrieved from vault (redacted)")

      // Step 2: GitHub Action - Create PR
      steps.push("Step 2: GitHub Action (Create PR Updating README)")

      const prResponse = await fetch("/api/github/create-pr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pat: vaultData.githubPat }),
      })

      if (!prResponse.ok) {
        const errorData = await prResponse.json()
        if (errorData.step === "validate_repo" && prResponse.status === 404) {
          throw new Error(
            "PAT not authorized for private repo - check fine-grained PAT repo selection / org authorization",
          )
        }
        throw new Error(`GitHub PR creation failed at step '${errorData.step}': ${errorData.error}`)
      }

      const prData = await prResponse.json()

      // Add GitHub steps
      if (prData.steps) {
        prData.steps.forEach((s: string) => steps.push("  " + s))
      }

      let responseContent = "GitHub PR Created Successfully!\n\n"
      responseContent += "Token-exchange success (vaulted-secret issued)\n"
      responseContent += "GitHub PAT retrieved from vault (redacted)\n"
      responseContent += `Repo access verified: ${prData.repo}\n`
      responseContent += `Branch created: ${prData.branch}\n`
      responseContent += "README updated + committed\n"
      responseContent += `PR created: ${prData.prUrl}\n\n`
      responseContent += `Authenticated as: ${prData.user}\n`
      responseContent += `PR Number: #${prData.prNumber}`

      addMessage("assistant", responseContent, steps, { pr: prData }, "success")
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"
      steps.push("Error: " + errorMessage)

      let failureContent = "Failed to create GitHub PR.\n\n"
      failureContent += errorMessage + "\n\n"

      // Add failure handling hints per spec
      if (errorMessage.includes("re-authenticate")) {
        failureContent += "Hint: Your session may have expired. Please refresh the page and sign in again."
      } else if (errorMessage.includes("vaulted_secret")) {
        failureContent += "Hint: Config error - check GITHUB_PAT_PATH and GITHUB_SECRET_KEY_NAME env vars."
      } else if (errorMessage.includes("404") || errorMessage.includes("not authorized")) {
        failureContent +=
          "Hint: PAT not authorized for private repo - fix fine-grained PAT repo selection / org authorization."
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
        "I can help you with the following:\n\n" +
          "1. Get Employee Data - Retrieve HR information using cross-app token exchange\n" +
          "2. Get KPI Data - Fetch key performance indicators\n" +
          "3. Get GitHub Repo Info - Access private GitHub repo using vaulted secret\n" +
          "4. Create GitHub PR - Create a PR updating README using vaulted secret\n\n" +
          "Try asking for 'employee data', 'KPI metrics', 'GitHub repo info', or 'create PR'.",
      )
    }
  }

  const examplePrompts = [
    { label: "Get Employee Data", icon: Users, action: handleEmployeeData },
    { label: "Get KPI Metrics", icon: TrendingUp, action: handleKPIData },
    { label: "Get GitHub Repo Info", icon: Github, action: handleGitHubRepoInfo },
    { label: "Create GitHub PR", icon: GitPullRequest, action: handleGitHubCreatePR },
  ]

  return (
    <Card className="flex h-[650px] flex-col">
      <CardHeader className="border-b">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <Bot className="h-6 w-6 text-primary" />
          </div>
          <div>
            <CardTitle>Enterprise Data Assistant</CardTitle>
            <CardDescription>Access HR, KPI, and GitHub data using Okta cross-app authentication</CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col p-0">
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center space-y-4 py-8">
              <div className="text-center text-muted-foreground">
                <p className="mb-4">Welcome! I can help you access enterprise data securely.</p>
                <p className="text-sm">Click a button below or type a request:</p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {examplePrompts.map((prompt) => (
                  <Button
                    key={prompt.label}
                    variant="outline"
                    size="sm"
                    onClick={prompt.action}
                    disabled={isLoading}
                    className="gap-2 bg-transparent"
                  >
                    <prompt.icon className="h-4 w-4" />
                    {prompt.label}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {message.role === "assistant" && (
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                        message.status === "error" ? "bg-destructive/10" : "bg-primary/10"
                      }`}
                    >
                      <Bot className={`h-4 w-4 ${message.status === "error" ? "text-destructive" : "text-primary"}`} />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-lg p-3 ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : message.status === "error"
                          ? "bg-destructive/10 border border-destructive/20"
                          : "bg-muted"
                    }`}
                  >
                    {message.steps && message.steps.length > 0 && (
                      <div className="mb-3 rounded border bg-background/50 p-2 text-xs font-mono">
                        {message.steps.map((step, idx) => (
                          <div
                            key={idx}
                            className={`${
                              step.startsWith("Error")
                                ? "text-destructive"
                                : step.includes("success") || step.includes("verified") || step.includes("created")
                                  ? "text-green-600 dark:text-green-400"
                                  : "text-muted-foreground"
                            }`}
                          >
                            {step}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="whitespace-pre-wrap text-sm">{message.content}</div>
                  </div>
                  {message.role === "user" && (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary">
                      <User className="h-4 w-4 text-primary-foreground" />
                    </div>
                  )}
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex items-center gap-2 rounded-lg bg-muted p-3">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm text-muted-foreground">Processing request...</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        <div className="border-t p-4">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask for employee data, KPIs, GitHub info, or create PR..."
              disabled={isLoading}
              className="flex-1 rounded-lg border bg-background px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
          <div className="mt-2 flex flex-wrap gap-1">
            {examplePrompts.map((prompt) => (
              <Button
                key={prompt.label}
                variant="ghost"
                size="sm"
                onClick={prompt.action}
                disabled={isLoading}
                className="h-7 gap-1 text-xs"
              >
                <prompt.icon className="h-3 w-3" />
                {prompt.label}
              </Button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
