"use client"

import { useEffect, useState } from "react"
import { isAuthenticated, clearTokens } from "@/lib/auth-client"
import { isWebAuthenticated, clearWebTokens } from "@/lib/web-auth-client"
import { LoginButton } from "@/components/login-button"
import { EnterpriseDashboard } from "@/components/enterprise-dashboard"
import { TokenPanel } from "@/components/token-panel"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Shield, LogOut, CheckCircle2, BookOpen, Database, BarChart3, Bot } from "@/components/icons"
import Link from "next/link"

export default function Home() {
  const [authenticated, setAuthenticated] = useState(false)
  const [webAuthenticated, setWebAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showTokenPanel, setShowTokenPanel] = useState(true)

  useEffect(() => {
    const pkceAuth = isAuthenticated()
    const webAuth = isWebAuthenticated()
    setAuthenticated(pkceAuth)
    setWebAuthenticated(webAuth)
    setLoading(false)
  }, [])

  const handleLogout = () => {
    clearTokens()
    clearWebTokens()
    setAuthenticated(false)
    setWebAuthenticated(false)
  }

  if (loading) {
    return null
  }

  const isLoggedIn = authenticated || webAuthenticated

  if (!isLoggedIn) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Shield className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Okta Cross-App Access Demo</h1>
            <p className="mt-2 text-muted-foreground">
              Enterprise data access with secure cross-application authentication
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Authentication Required</CardTitle>
              <CardDescription>Choose your authentication flow to access enterprise data</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <LoginButton />

                <div className="space-y-2 rounded-lg border bg-muted/50 p-4 text-sm">
                  <h3 className="font-semibold">How it works:</h3>
                  <ul className="ml-4 space-y-1 text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                      <span>PKCE Flow: Direct Okta ID-JAG for HR/KPI APIs</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                      <span>Web Client: Okta → Auth0 token exchange for Finance API</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                      <span>Resource APIs validate tokens with appropriate scopes</span>
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resource Servers</CardTitle>
              <CardDescription>Explore our standalone resource servers with CAA support</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href="/financial-server">
                <Button variant="outline" className="w-full justify-start gap-2 bg-transparent">
                  <Database className="h-4 w-4 text-blue-600" />
                  Financial Resource Server
                </Button>
              </Link>
              <Link href="/kpi-server">
                <Button variant="outline" className="w-full justify-start gap-2 bg-transparent">
                  <BarChart3 className="h-4 w-4 text-purple-600" />
                  KPI Resource Server
                </Button>
              </Link>
              <Link href="/api-docs">
                <Button variant="outline" className="w-full justify-start gap-2 bg-transparent">
                  <BookOpen className="h-4 w-4 text-indigo-600" />
                  API Documentation
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold">Okta Cross-App Access</h1>
              <p className="text-xs text-muted-foreground">
                {authenticated && "PKCE Auth Active"}
                {webAuthenticated && "Web Client Auth Active"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {webAuthenticated && (
              <Link href="/agent">
                <Button variant="default" size="sm" className="gap-2">
                  <Bot className="h-4 w-4" />
                  AI Agent
                </Button>
              </Link>
            )}
            <Link href="/api-docs">
              <Button variant="ghost" size="sm">
                <BookOpen className="h-4 w-4 mr-2" />
                API Docs
              </Button>
            </Link>
            <Link href="/financial-server">
              <Button variant="ghost" size="sm">
                <Database className="h-4 w-4 mr-2" />
                Financial Server
              </Button>
            </Link>
            <Link href="/kpi-server">
              <Button variant="ghost" size="sm">
                <BarChart3 className="h-4 w-4 mr-2" />
                KPI Server
              </Button>
            </Link>
            <Button
              onClick={() => setShowTokenPanel(!showTokenPanel)}
              variant="outline"
              size="sm"
              className="bg-transparent"
            >
              {showTokenPanel ? "Hide" : "Show"} Tokens
            </Button>
            <Button onClick={handleLogout} variant="outline" className="gap-2 bg-transparent">
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto grid gap-6 p-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <EnterpriseDashboard />
        </div>
        {showTokenPanel && (
          <div className="lg:col-span-1">
            <TokenPanel />
          </div>
        )}
      </main>
    </div>
  )
}
