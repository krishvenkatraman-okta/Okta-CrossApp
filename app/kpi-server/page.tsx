"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { KPI_DATA, type KPIData } from "@/lib/enterprise-data"
import { Shield, Database, Key, Plus, Trash2, TrendingUp, TrendingDown, Minus } from "@/components/icons"
import { AuthGuard } from "@/components/auth-guard"

export default function KPIServerPage() {
  const [data, setData] = useState<KPIData[]>(KPI_DATA)
  const [apiKey, setApiKey] = useState("")

  useEffect(() => {
    // Generate mock API key
    setApiKey("kpi_" + Math.random().toString(36).substring(2, 15))
  }, [])

  const handleDelete = (id: string) => {
    setData(data.filter((item) => item.id !== id))
  }

  const handleAdd = () => {
    const newItem: KPIData = {
      id: `kpi${String(data.length + 1).padStart(3, "0")}`,
      metric: "New Metric",
      value: Math.floor(Math.random() * 100),
      target: Math.floor(Math.random() * 100),
      trend: ["up", "down", "stable"][Math.floor(Math.random() * 3)] as "up" | "down" | "stable",
      period: "April 2025",
    }
    setData([...data, newItem])
  }

  const getTrendIcon = (trend: "up" | "down" | "stable") => {
    switch (trend) {
      case "up":
        return <TrendingUp className="w-4 h-4 text-green-500" />
      case "down":
        return <TrendingDown className="w-4 h-4 text-red-500" />
      case "stable":
        return <Minus className="w-4 h-4 text-gray-500" />
    }
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50">
        <div className="container mx-auto p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">KPI Resource Server</h1>
              <p className="text-gray-600">Performance metrics API with Cross-App Access (CAA) support</p>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="w-6 h-6 text-purple-600" />
              <Badge variant="outline" className="text-purple-600 border-purple-600">
                CAA Enabled
              </Badge>
            </div>
          </div>

          <Tabs defaultValue="data" className="space-y-6">
            <TabsList className="grid w-full max-w-md grid-cols-3">
              <TabsTrigger value="data">
                <Database className="w-4 h-4 mr-2" />
                Data
              </TabsTrigger>
              <TabsTrigger value="api">
                <Key className="w-4 h-4 mr-2" />
                API
              </TabsTrigger>
              <TabsTrigger value="security">
                <Shield className="w-4 h-4 mr-2" />
                Security
              </TabsTrigger>
            </TabsList>

            {/* Data Management Tab */}
            <TabsContent value="data" className="space-y-4">
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold">KPI Metrics</h2>
                  <Button onClick={handleAdd} size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Metric
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {data.map((item) => (
                    <Card key={item.id} className="p-4 relative">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={() => handleDelete(item.id)}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-semibold text-lg">{item.metric}</h3>
                          <p className="text-xs text-gray-500">{item.period}</p>
                        </div>
                        {getTrendIcon(item.trend)}
                      </div>
                      <div className="flex items-end gap-4">
                        <div>
                          <div className="text-3xl font-bold text-purple-600">{item.value}</div>
                          <div className="text-xs text-gray-500">Current</div>
                        </div>
                        <div>
                          <div className="text-xl font-semibold text-gray-400">{item.target}</div>
                          <div className="text-xs text-gray-500">Target</div>
                        </div>
                      </div>
                      <div className="mt-3">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${item.value >= item.target ? "bg-green-500" : "bg-purple-500"}`}
                            style={{ width: `${Math.min((item.value / item.target) * 100, 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </Card>
            </TabsContent>

            {/* API Documentation Tab */}
            <TabsContent value="api" className="space-y-4">
              <Card className="p-6">
                <h2 className="text-xl font-semibold mb-4">API Endpoints</h2>
                <div className="space-y-6">
                  <div className="border-l-4 border-purple-500 pl-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className="bg-purple-500">GET</Badge>
                      <code className="text-sm font-mono">/api/resource/kpi</code>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">Retrieve all KPI metrics</p>
                    <div className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm font-mono">
                      <div className="text-gray-400"># Request</div>
                      <div>GET /api/resource/kpi</div>
                      <div>Authorization: Bearer &lt;ID-JAG_TOKEN&gt;</div>
                      <br />
                      <div className="text-gray-400"># Response</div>
                      <div className="text-green-400">{`{`}</div>
                      <div className="ml-4">"success": true,</div>
                      <div className="ml-4">"data": [...]</div>
                      <div className="text-green-400">{`}`}</div>
                    </div>
                  </div>

                  <div className="border-l-4 border-pink-500 pl-4">
                    <h3 className="font-semibold mb-2">Required Scope</h3>
                    <Badge variant="outline" className="text-pink-600 border-pink-600">
                      mcp:read
                    </Badge>
                  </div>

                  <div className="border-l-4 border-amber-500 pl-4">
                    <h3 className="font-semibold mb-2">Token Validation</h3>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li>✓ JWT signature verification (RS256)</li>
                      <li>✓ Issuer validation</li>
                      <li>✓ Audience validation</li>
                      <li>✓ Expiration check</li>
                      <li>✓ Scope verification</li>
                    </ul>
                  </div>
                </div>
              </Card>
            </TabsContent>

            {/* Security Tab */}
            <TabsContent value="security" className="space-y-4">
              <Card className="p-6">
                <h2 className="text-xl font-semibold mb-4">Security Configuration</h2>
                <div className="space-y-6">
                  <div>
                    <h3 className="font-semibold mb-2">Cross-App Access (CAA) Status</h3>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-sm text-gray-600">Active - Accepting ID-JAG tokens</span>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-2">Okta Configuration</h3>
                    <div className="bg-gray-50 p-4 rounded-lg space-y-2 text-sm font-mono">
                      <div>
                        <span className="text-gray-500">Org Domain:</span>
                        <span className="ml-2">qa-aiagentsproduct2tc1.trexcloud.com</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Auth Server:</span>
                        <span className="ml-2">.../oauth2/aus8uyrhdz9VliiSG0g7</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Required Scope:</span>
                        <span className="ml-2 text-pink-600">mcp:read</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-2">Server API Key</h3>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-gray-900 text-gray-100 p-3 rounded-lg text-sm font-mono">
                        {apiKey}
                      </code>
                      <Button size="sm" variant="outline">
                        Copy
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">Use this key for server-to-server communication</p>
                  </div>
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AuthGuard>
  )
}
