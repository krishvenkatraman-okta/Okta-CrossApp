"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  fetchHRData,
  fetchFinancialData,
  fetchKPIData,
  fetchSalesforceData,
  getAuthMethod,
} from "@/lib/resource-client"
import type { Employee, FinancialData, KPIData, SalesforceData } from "@/lib/enterprise-data"
import { Loader2, DollarSign, AlertCircle, Cloud } from "@/components/icons"
import { testSalesforceGatewayFlow, deleteConnectedAccount } from "@/lib/gateway-test-client"
import { tokenStore } from "@/lib/token-store"
import { PKCEChatbot } from "@/components/pkce-chatbot"

type DataState<T> = {
  data: T | null
  loading: boolean
  error: string | null
}

type GatewayTestResult = {
  success: boolean
  error?: string
  tokens: {
    idToken?: string
    idJagToken?: string
    auth0AccessToken?: string
    meIdJagToken?: string
    meAuth0AccessToken?: string
  }
  logs: string[]
  connectUri?: string
  authSession?: string
  sessionId?: string
  codeVerifier?: string
}

export function EnterpriseDashboard() {
  const [hrState, setHrState] = useState<DataState<Employee[]>>({
    data: null,
    loading: false,
    error: null,
  })

  const [financialState, setFinancialState] = useState<DataState<FinancialData[]>>({
    data: null,
    loading: false,
    error: null,
  })

  const [kpiState, setKpiState] = useState<DataState<KPIData[]>>({
    data: null,
    loading: false,
    error: null,
  })

  const [salesforceState, setSalesforceState] = useState<DataState<SalesforceData[]>>({
    data: null,
    loading: false,
    error: null,
  })

  const [authMethod, setAuthMethod] = useState<"pkce" | "web" | null>(null)
  const [pkceIdToken, setPkceIdToken] = useState<string | null>(null)

  const [gatewayTestResult, setGatewayTestResult] = useState<GatewayTestResult | null>(null)
  const [isTestingGateway, setIsTestingGateway] = useState(false)
  const [showConnectAccount, setShowConnectAccount] = useState(false)
  const [connectAccountToken, setConnectAccountToken] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    const method = getAuthMethod()
    setAuthMethod(method)

    if (method === "pkce") {
      const idToken = sessionStorage.getItem("okta_id_token")
      setPkceIdToken(idToken)
    }
  }, [])

  const loadHRData = async () => {
    setHrState({ data: null, loading: true, error: null })
    try {
      const response = await fetchHRData()
      setHrState({ data: response.data, loading: false, error: null })
    } catch (error) {
      setHrState({
        data: null,
        loading: false,
        error: error instanceof Error ? error.message : "Failed to load HR data",
      })
    }
  }

  const loadFinancialData = async () => {
    setFinancialState({ data: null, loading: true, error: null })
    try {
      const response = await fetchFinancialData()
      setFinancialState({ data: response.data, loading: false, error: null })
    } catch (error) {
      setFinancialState({
        data: null,
        loading: false,
        error: error instanceof Error ? error.message : "Failed to load financial data",
      })
    }
  }

  const loadKPIData = async () => {
    setKpiState({ data: null, loading: true, error: null })
    try {
      const response = await fetchKPIData()
      setKpiState({ data: response.data, loading: false, error: null })
    } catch (error) {
      setKpiState({
        data: null,
        loading: false,
        error: error instanceof Error ? error.message : "Failed to load KPI data",
      })
    }
  }

  const loadSalesforceData = async () => {
    setSalesforceState({ data: null, loading: true, error: null })
    try {
      const response = await fetchSalesforceData()
      setSalesforceState({ data: response.data, loading: false, error: null })
    } catch (error) {
      setSalesforceState({
        data: null,
        loading: false,
        error: error instanceof Error ? error.message : "Failed to load Salesforce data",
      })
    }
  }

  const testGatewayFlow = async () => {
    setIsTestingGateway(true)
    setGatewayTestResult(null)
    setShowConnectAccount(false)
    setConnectAccountToken(null)

    try {
      const result = await testSalesforceGatewayFlow()
      setGatewayTestResult(result)

      if (result.tokens.idToken) {
        tokenStore.setToken("web_id_token", result.tokens.idToken)
      }
      if (result.tokens.idJagToken) {
        tokenStore.setToken("salesforce_id_jag_token", result.tokens.idJagToken)
      }
      if (result.tokens.auth0AccessToken) {
        tokenStore.setToken("salesforce_auth0_access_token", result.tokens.auth0AccessToken)
      }
      if (result.tokens.meIdJagToken) {
        tokenStore.setToken("me_id_jag_token", result.tokens.meIdJagToken)
      }
      if (result.tokens.meAuth0AccessToken) {
        tokenStore.setToken("me_auth0_access_token", result.tokens.meAuth0AccessToken)
      }

      if (result.error === "federated_connection_refresh_token_not_found" && result.tokens.meAuth0AccessToken) {
        setShowConnectAccount(true)
        setConnectAccountToken(result.tokens.meAuth0AccessToken)

        if (result.connectUri && result.authSession && result.sessionId) {
          const sessionKey = `ca_session_${result.sessionId}`
          sessionStorage.setItem(
            sessionKey,
            JSON.stringify({
              authSession: result.authSession,
              meToken: result.tokens.meAuth0AccessToken,
              codeVerifier: result.codeVerifier,
            }),
          )
          console.log("[v0] Stored session data for:", result.sessionId)
        }
      }
    } catch (error) {
      console.error("Gateway test failed:", error)
    } finally {
      setIsTestingGateway(false)
    }
  }

  const handleConnectAccount = async () => {
    if (!connectAccountToken) {
      console.error("[v0] No ME access token available")
      return
    }

    const connectUri = gatewayTestResult?.connectUri
    const authSession = gatewayTestResult?.authSession
    const sessionId = gatewayTestResult?.sessionId
    const codeVerifier = gatewayTestResult?.codeVerifier

    if (!connectUri) {
      console.error("[v0] No connect URI available from gateway test")
      setGatewayTestResult((prev) =>
        prev
          ? {
              ...prev,
              logs: [...prev.logs, "✗ Please run the gateway test first to get a connect URI"],
            }
          : null,
      )
      return
    }

    console.log("[v0] Using cached connect URI:", connectUri)
    console.log("[v0] Session ID:", sessionId)

    setIsConnecting(true)

    try {
      if (authSession && sessionId) {
        const sessionKey = `ca_session_${sessionId}`
        sessionStorage.setItem(
          sessionKey,
          JSON.stringify({
            authSession,
            meToken: connectAccountToken,
            codeVerifier,
          }),
        )
        console.log("[v0] Stored session data for callback with key:", sessionKey)
      }

      const width = 600
      const height = 700
      const left = window.screenX + (window.outerWidth - width) / 2
      const top = window.screenY + (window.outerHeight - height) / 2

      const popup = window.open(
        connectUri,
        "Connect Salesforce Account",
        `width=${width},height=${height},left=${left},top=${top},popup=yes`,
      )

      if (!popup) {
        setIsConnecting(false)
        throw new Error("Popup blocked. Please allow popups for this site.")
      }

      const handleMessage = (event: MessageEvent) => {
        console.log("[v0] Received message:", event.data)
        if (event.data.type === "connected_account_complete") {
          console.log("[v0] Connected account callback received")
          window.removeEventListener("message", handleMessage)
          popup?.close()

          setShowConnectAccount(false)
          setIsConnecting(false)
          setGatewayTestResult((prev) =>
            prev
              ? {
                  ...prev,
                  success: true,
                  logs: [
                    ...prev.logs,
                    "",
                    "✓ Salesforce account connected successfully!",
                    "  You can now retry the gateway request - the federated connection should work",
                  ],
                }
              : null,
          )
        }
      }

      window.addEventListener("message", handleMessage)

      const checkClosed = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkClosed)
          window.removeEventListener("message", handleMessage)
          setIsConnecting(false)
          console.log("[v0] Popup closed")
        }
      }, 500)
    } catch (error) {
      console.error("[v0] Failed to connect account:", error)
      setGatewayTestResult((prev) =>
        prev
          ? {
              ...prev,
              logs: [
                ...prev.logs,
                `✗ Failed to open connect window: ${error instanceof Error ? error.message : String(error)}`,
              ],
            }
          : null,
      )
      setIsConnecting(false)
    }
  }

  const handleDeleteConnectedAccount = async () => {
    if (
      !confirm(
        "Are you sure you want to delete the Salesforce connected account? This will remove the linked account and you will need to reconnect.",
      )
    ) {
      return
    }

    setIsDeleting(true)

    try {
      const result = await deleteConnectedAccount("Salesforce")

      setGatewayTestResult((prev) =>
        prev
          ? {
              ...prev,
              logs: [
                ...prev.logs,
                "",
                "✓ Connected account deleted successfully!",
                "  You will need to reconnect if you want to access Salesforce data again",
              ],
            }
          : null,
      )

      setShowConnectAccount(false)
      setConnectAccountToken(null)
    } catch (error) {
      console.error("Failed to delete connected account:", error)
      setGatewayTestResult((prev) =>
        prev
          ? {
              ...prev,
              logs: [
                ...prev.logs,
                "",
                `✗ Failed to delete connected account: ${error instanceof Error ? error.message : String(error)}`,
              ],
            }
          : null,
      )
    } finally {
      setIsDeleting(false)
    }
  }

  if (authMethod === "pkce") {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Enterprise Data</h2>
          <p className="text-muted-foreground">
            Access your HR, KPI, and GitHub data using Okta cross-app authentication
          </p>
        </div>

        {pkceIdToken ? (
          <PKCEChatbot idToken={pkceIdToken} />
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">ID Token not found. Please sign in again.</p>
            </CardContent>
          </Card>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Enterprise Data</h2>
        <p className="text-muted-foreground">
          Access your Financial and Salesforce data using Okta cross-app authentication
        </p>
      </div>

      <Tabs defaultValue="financial" className="space-y-6">
        <TabsList className="grid w-full max-w-md" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <TabsTrigger value="financial">Financial</TabsTrigger>
          <TabsTrigger value="salesforce">Salesforce</TabsTrigger>
        </TabsList>

        <TabsContent value="financial" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <DollarSign className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Financial Data</CardTitle>
                    <CardDescription>View revenue, expenses, and profit data</CardDescription>
                  </div>
                </div>
                <Button onClick={loadFinancialData} disabled={financialState.loading} className="gap-2">
                  {financialState.loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    "Load Financial Data"
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {financialState.error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{financialState.error}</AlertDescription>
                </Alert>
              )}

              {financialState.data && (
                <div className="space-y-4">
                  <div className="rounded-lg border">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="border-b bg-muted/50">
                          <tr>
                            <th className="px-4 py-3 text-left font-medium">Quarter</th>
                            <th className="px-4 py-3 text-left font-medium">Department</th>
                            <th className="px-4 py-3 text-right font-medium">Revenue</th>
                            <th className="px-4 py-3 text-right font-medium">Expenses</th>
                            <th className="px-4 py-3 text-right font-medium">Profit</th>
                          </tr>
                        </thead>
                        <tbody>
                          {financialState.data.map((item) => (
                            <tr key={item.id} className="border-b last:border-b-0">
                              <td className="px-4 py-3 font-medium">{item.quarter}</td>
                              <td className="px-4 py-3">{item.department}</td>
                              <td className="px-4 py-3 text-right font-mono text-green-600">
                                ${item.revenue.toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-right font-mono text-red-600">
                                ${item.expenses.toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-right font-mono font-semibold">
                                ${item.profit.toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Showing {financialState.data.length} financial records
                  </p>
                </div>
              )}

              {!financialState.data && !financialState.error && !financialState.loading && (
                <div className="py-12 text-center text-muted-foreground">
                  Click "Load Financial Data" to fetch financial information
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="salesforce" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-blue-500/10 p-2">
                    <Cloud className="h-6 w-6 text-blue-500" />
                  </div>
                  <div>
                    <CardTitle>Salesforce Gateway</CardTitle>
                    <CardDescription>Test the complete cross-app token flow with Auth0</CardDescription>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={testGatewayFlow} disabled={isTestingGateway} className="gap-2">
                    {isTestingGateway ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Testing...
                      </>
                    ) : (
                      "Test Gateway Flow"
                    )}
                  </Button>
                  {gatewayTestResult && (
                    <Button
                      onClick={handleDeleteConnectedAccount}
                      disabled={isDeleting}
                      variant="destructive"
                      size="sm"
                    >
                      {isDeleting ? "Deleting..." : "Delete Connection"}
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {showConnectAccount && (
                <Alert className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="flex items-center justify-between">
                    <span>Salesforce account not connected. Click to authorize.</span>
                    <Button onClick={handleConnectAccount} disabled={isConnecting} size="sm" className="ml-4">
                      {isConnecting ? "Connecting..." : "Connect Salesforce"}
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              {gatewayTestResult && (
                <div className="rounded-lg border bg-muted/50 p-4">
                  <pre className="text-xs font-mono whitespace-pre-wrap">{gatewayTestResult.logs.join("\n")}</pre>
                </div>
              )}

              {!gatewayTestResult && !isTestingGateway && (
                <div className="py-12 text-center text-muted-foreground">
                  Click "Test Gateway Flow" to test the complete authentication flow
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
