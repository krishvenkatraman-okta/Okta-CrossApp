"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { fetchHRData, fetchFinancialData, fetchKPIData, fetchSalesforceData, getAuthMethod } from "@/lib/resource-client"
import type { Employee, FinancialData, KPIData, SalesforceData } from "@/lib/enterprise-data"
import { Loader2, Users, DollarSign, TrendingUp, AlertCircle, ArrowUp, ArrowDown, Minus, Cloud } from "@/components/icons"
import { testSalesforceGatewayFlow } from "@/lib/gateway-test-client"
import type { GatewayTestResult } from "@/lib/gateway-test-client"
import { tokenStore } from "@/lib/token-store"

type DataState<T> = {
  data: T | null
  loading: boolean
  error: string | null
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

  const [gatewayTestResult, setGatewayTestResult] = useState<GatewayTestResult | null>(null)
  const [isTestingGateway, setIsTestingGateway] = useState(false)
  const [showConnectAccount, setShowConnectAccount] = useState(false)
  const [connectAccountToken, setConnectAccountToken] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)

  useEffect(() => {
    setAuthMethod(getAuthMethod())
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
        tokenStore.setToken('web_id_token', result.tokens.idToken)
      }
      if (result.tokens.idJagToken) {
        tokenStore.setToken('salesforce_id_jag_token', result.tokens.idJagToken)
      }
      if (result.tokens.auth0AccessToken) {
        tokenStore.setToken('salesforce_auth0_access_token', result.tokens.auth0AccessToken)
      }
      if (result.tokens.meIdJagToken) {
        tokenStore.setToken('me_id_jag_token', result.tokens.meIdJagToken)
      }
      if (result.tokens.meAuth0AccessToken) {
        tokenStore.setToken('me_auth0_access_token', result.tokens.meAuth0AccessToken)
      }
      
      if (result.error === 'federated_connection_refresh_token_not_found' && result.tokens.meAuth0AccessToken) {
        setShowConnectAccount(true)
        setConnectAccountToken(result.tokens.meAuth0AccessToken)
        
        if (result.connectUri && result.authSession && result.sessionId) {
          const sessionKey = `ca_session_${result.sessionId}`
          sessionStorage.setItem(sessionKey, JSON.stringify({
            authSession: result.authSession,
            meToken: result.tokens.meAuth0AccessToken,
            codeVerifier: result.codeVerifier
          }))
          console.log('[v0] Stored session data for:', result.sessionId)
        }
      }
    } catch (error) {
      console.error('Gateway test failed:', error)
    } finally {
      setIsTestingGateway(false)
    }
  }

  const handleConnectAccount = async () => {
    if (!connectAccountToken) {
      console.error('[v0] No ME access token available')
      return
    }
    
    const connectUri = gatewayTestResult?.connectUri
    const authSession = gatewayTestResult?.authSession
    const sessionId = gatewayTestResult?.sessionId
    const codeVerifier = gatewayTestResult?.codeVerifier
    
    if (!connectUri) {
      console.error('[v0] No connect URI available from gateway test')
      setGatewayTestResult(prev => prev ? {
        ...prev,
        logs: [...prev.logs, '✗ Please run the gateway test first to get a connect URI']
      } : null)
      return
    }
    
    console.log('[v0] Using cached connect URI:', connectUri)
    console.log('[v0] Session ID:', sessionId)
    
    setIsConnecting(true)
    
    try {
      if (authSession && sessionId) {
        const sessionKey = `ca_session_${sessionId}`
        sessionStorage.setItem(sessionKey, JSON.stringify({
          authSession,
          meToken: connectAccountToken,
          codeVerifier
        }))
        console.log('[v0] Stored session data for callback with key:', sessionKey)
      }
      
      const width = 600
      const height = 700
      const left = window.screenX + (window.outerWidth - width) / 2
      const top = window.screenY + (window.outerHeight - height) / 2
      
      const popup = window.open(
        connectUri,
        'Connect Salesforce Account',
        `width=${width},height=${height},left=${left},top=${top},popup=yes`
      )
      
      if (!popup) {
        setIsConnecting(false)
        throw new Error('Popup blocked. Please allow popups for this site.')
      }
      
      const handleMessage = (event: MessageEvent) => {
        console.log('[v0] Received message:', event.data)
        if (event.data.type === 'connected_account_complete') {
          console.log('[v0] Connected account callback received')
          window.removeEventListener('message', handleMessage)
          popup?.close()
          
          setShowConnectAccount(false)
          setIsConnecting(false)
          setGatewayTestResult(prev => prev ? {
            ...prev,
            success: true,
            logs: [
              ...prev.logs, 
              '', 
              '✓ Salesforce account connected successfully!', 
              '  You can now retry the gateway request - the federated connection should work'
            ]
          } : null)
        }
      }
      
      window.addEventListener('message', handleMessage)
      
      const checkClosed = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkClosed)
          window.removeEventListener('message', handleMessage)
          setIsConnecting(false)
          console.log('[v0] Popup closed')
        }
      }, 500)
      
    } catch (error) {
      console.error('[v0] Failed to connect account:', error)
      setGatewayTestResult(prev => prev ? {
        ...prev,
        logs: [...prev.logs, `✗ Failed to open connect window: ${error instanceof Error ? error.message : String(error)}`]
      } : null)
      setIsConnecting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Enterprise Data</h2>
          <p className="text-muted-foreground">
            Access your HR, Financial, KPI, and Salesforce data using Okta cross-app authentication
          </p>
        </div>
      </div>

      <Tabs defaultValue={authMethod === "web" ? "financial" : "hr"} className="space-y-6">
        <TabsList className="grid w-full max-w-md" style={{ gridTemplateColumns: authMethod === "web" ? "1fr 1fr" : "1fr 1fr" }}>
          {authMethod === "pkce" && (
            <>
              <TabsTrigger value="hr">HR Data</TabsTrigger>
              <TabsTrigger value="kpi">KPIs</TabsTrigger>
            </>
          )}
          {authMethod === "web" && (
            <>
              <TabsTrigger value="financial">Financial</TabsTrigger>
              <TabsTrigger value="salesforce">Salesforce</TabsTrigger>
            </>
          )}
        </TabsList>

        {authMethod === "pkce" && (
          <TabsContent value="hr" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-primary/10 p-2">
                      <Users className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle>Employee Data</CardTitle>
                      <CardDescription>View employee information from HR system</CardDescription>
                    </div>
                  </div>
                  <Button onClick={loadHRData} disabled={hrState.loading} className="gap-2">
                    {hrState.loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      "Load HR Data"
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {hrState.error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{hrState.error}</AlertDescription>
                  </Alert>
                )}

                {hrState.data && (
                  <div className="space-y-4">
                    <div className="rounded-lg border">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="border-b bg-muted/50">
                            <tr>
                              <th className="px-4 py-3 text-left font-medium">Name</th>
                              <th className="px-4 py-3 text-left font-medium">Department</th>
                              <th className="px-4 py-3 text-left font-medium">Position</th>
                              <th className="px-4 py-3 text-left font-medium">Email</th>
                              <th className="px-4 py-3 text-right font-medium">Salary</th>
                            </tr>
                          </thead>
                          <tbody>
                            {hrState.data.map((employee) => (
                              <tr key={employee.id} className="border-b last:border-b-0">
                                <td className="px-4 py-3 font-medium">{employee.name}</td>
                                <td className="px-4 py-3">{employee.department}</td>
                                <td className="px-4 py-3">{employee.position}</td>
                                <td className="px-4 py-3 text-muted-foreground">{employee.email}</td>
                                <td className="px-4 py-3 text-right font-mono">${employee.salary.toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">Showing {hrState.data.length} employees</p>
                  </div>
                )}

                {!hrState.data && !hrState.error && !hrState.loading && (
                  <div className="py-12 text-center text-muted-foreground">
                    Click "Load HR Data" to fetch employee information
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {authMethod === "web" && (
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
        )}

        {authMethod === "pkce" && (
          <TabsContent value="kpi" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-primary/10 p-2">
                      <TrendingUp className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle>Key Performance Indicators</CardTitle>
                      <CardDescription>Track important business metrics</CardDescription>
                    </div>
                  </div>
                  <Button onClick={loadKPIData} disabled={kpiState.loading} className="gap-2">
                    {kpiState.loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      "Load KPI Data"
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {kpiState.error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{kpiState.error}</AlertDescription>
                  </Alert>
                )}

                {kpiState.data && (
                  <div className="grid gap-4 md:grid-cols-2">
                    {kpiState.data.map((kpi) => (
                      <Card key={kpi.id}>
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <CardDescription className="text-xs">{kpi.period}</CardDescription>
                              <CardTitle className="text-base">{kpi.metric}</CardTitle>
                            </div>
                            {kpi.trend === "up" && (
                              <div className="rounded-full bg-green-100 p-1.5 dark:bg-green-900/30">
                                <ArrowUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                              </div>
                            )}
                            {kpi.trend === "down" && (
                              <div className="rounded-full bg-red-100 p-1.5 dark:bg-red-900/30">
                                <ArrowDown className="h-4 w-4 text-red-600 dark:text-red-400" />
                              </div>
                            )}
                            {kpi.trend === "stable" && (
                              <div className="rounded-full bg-gray-100 p-1.5 dark:bg-gray-800">
                                <Minus className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                              </div>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-end justify-between">
                            <div>
                              <div className="text-3xl font-bold">{kpi.value}</div>
                              <div className="mt-1 text-xs text-muted-foreground">Target: {kpi.target}</div>
                            </div>
                            <div className="text-right">
                              {kpi.value >= kpi.target ? (
                                <div className="text-sm font-medium text-green-600">
                                  +{(((kpi.value - kpi.target) / kpi.target) * 100).toFixed(1)}%
                                </div>
                              ) : (
                                <div className="text-sm font-medium text-red-600">
                                  {(((kpi.value - kpi.target) / kpi.target) * 100).toFixed(1)}%
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {!kpiState.data && !kpiState.error && !kpiState.loading && (
                  <div className="py-12 text-center text-muted-foreground">
                    Click "Load KPI Data" to fetch performance metrics
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {authMethod === "web" && (
          <TabsContent value="salesforce" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-primary/10 p-2">
                      <Cloud className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle>Salesforce Data</CardTitle>
                      <CardDescription>View opportunities and pipeline data</CardDescription>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      onClick={testGatewayFlow} 
                      disabled={isTestingGateway}
                      variant="outline"
                      className="gap-2"
                    >
                      {isTestingGateway ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Testing...
                        </>
                      ) : (
                        "Test Gateway Flow"
                      )}
                    </Button>
                    <Button onClick={loadSalesforceData} disabled={salesforceState.loading} className="gap-2">
                      {salesforceState.loading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading...
                        </>
                      ) : (
                        "Load Salesforce Data"
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {gatewayTestResult && (
                  <Alert variant={gatewayTestResult.success ? "default" : "destructive"} className="mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="space-y-2">
                        <div className="font-semibold">
                          {gatewayTestResult.success ? 'Gateway test successful!' : 'Gateway test failed'}
                        </div>
                        <div className="text-xs space-y-1 font-mono">
                          {gatewayTestResult.logs.map((log, i) => (
                            <div key={i}>{log}</div>
                          ))}
                        </div>
                        {showConnectAccount && (
                          <div className="mt-4 pt-4 border-t">
                            <Button 
                              onClick={handleConnectAccount}
                              disabled={isConnecting || !connectAccountToken}
                              className="gap-2"
                            >
                              {isConnecting ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  Opening...
                                </>
                              ) : (
                                'Connect Salesforce Account'
                              )}
                            </Button>
                            <p className="text-xs mt-2 text-muted-foreground">
                              Click to authorize Salesforce access in a popup window
                            </p>
                          </div>
                        )}
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                {salesforceState.error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{salesforceState.error}</AlertDescription>
                  </Alert>
                )}

                {salesforceState.data && (
                  <div className="space-y-4">
                    <div className="rounded-lg border">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="border-b bg-muted/50">
                            <tr>
                              <th className="px-4 py-3 text-left font-medium">Opportunity</th>
                              <th className="px-4 py-3 text-left font-medium">Account</th>
                              <th className="px-4 py-3 text-left font-medium">Stage</th>
                              <th className="px-4 py-3 text-right font-medium">Amount</th>
                              <th className="px-4 py-3 text-right font-medium">Probability</th>
                              <th className="px-4 py-3 text-left font-medium">Close Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {salesforceState.data.map((opp) => (
                              <tr key={opp.id} className="border-b last:border-b-0">
                                <td className="px-4 py-3 font-medium">{opp.opportunityName}</td>
                                <td className="px-4 py-3">{opp.accountName}</td>
                                <td className="px-4 py-3">
                                  <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-primary/10 text-primary">
                                    {opp.stage}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-right font-mono text-green-600">
                                  ${opp.amount.toLocaleString()}
                                </td>
                                <td className="px-4 py-3 text-right font-mono">
                                  {opp.probability}%
                                </td>
                                <td className="px-4 py-3 text-muted-foreground">{opp.closeDate}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Showing {salesforceState.data.length} opportunities
                    </p>
                  </div>
                )}

                {!salesforceState.data && !salesforceState.error && !salesforceState.loading && (
                  <div className="py-12 text-center text-muted-foreground">
                    Click "Load Salesforce Data" to fetch opportunity information
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
