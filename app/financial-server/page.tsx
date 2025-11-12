"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { FINANCIAL_DATA, type FinancialData } from "@/lib/enterprise-data"
import { Shield, Database, Key, Plus, Trash2 } from "@/components/icons"
import { AuthGuard } from "@/components/auth-guard"

export default function FinancialServerPage() {
  const [data, setData] = useState<FinancialData[]>(FINANCIAL_DATA)
  const [apiKey, setApiKey] = useState("")

  useEffect(() => {
    // Generate mock API key
    setApiKey("fs_" + Math.random().toString(36).substring(2, 15))
  }, [])

  const handleDelete = (id: string) => {
    setData(data.filter((item) => item.id !== id))
  }

  const handleAdd = () => {
    const newItem: FinancialData = {
      id: `fin${String(data.length + 1).padStart(3, "0")}`,
      quarter: "Q2 2025",
      revenue: Math.floor(Math.random() * 1000000) + 500000,
      expenses: Math.floor(Math.random() * 800000) + 300000,
      profit: 0,
      department: "New Department",
    }
    newItem.profit = newItem.revenue - newItem.expenses
    setData([...data, newItem])
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
        <div className="container mx-auto p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">Financial Resource Server</h1>
              <p className="text-gray-600">Secure financial data API with Cross-App Access (CAA) support</p>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="w-6 h-6 text-blue-600" />
              <Badge variant="outline" className="text-blue-600 border-blue-600">
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
                  <h2 className="text-xl font-semibold">Financial Records</h2>
                  <Button onClick={handleAdd} size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Record
                  </Button>
                </div>
                <div className="space-y-4">
                  {data.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-4">
                          <div>
                            <h3 className="font-semibold">{item.department}</h3>
                            <p className="text-sm text-gray-500">{item.quarter}</p>
                          </div>
                          <div className="flex gap-6 text-sm">
                            <div>
                              <span className="text-gray-500">Revenue:</span>
                              <span className="ml-2 font-semibold text-green-600">
                                ${item.revenue.toLocaleString()}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500">Expenses:</span>
                              <span className="ml-2 font-semibold text-red-600">${item.expenses.toLocaleString()}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Profit:</span>
                              <span
                                className={`ml-2 font-semibold ${item.profit >= 0 ? "text-green-600" : "text-red-600"}`}
                              >
                                ${item.profit.toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(item.id)}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                </div>
              </Card>
            </TabsContent>

            {/* API Documentation Tab */}
            <TabsContent value="api" className="space-y-4">
              <Card className="p-6">
                <h2 className="text-xl font-semibold mb-4">API Endpoints</h2>
                <div className="space-y-6">
                  <div className="border-l-4 border-blue-500 pl-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className="bg-blue-500">GET</Badge>
                      <code className="text-sm font-mono">/api/resource/financial</code>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">Retrieve all financial records</p>
                    <div className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm font-mono">
                      <div className="text-gray-400"># Request</div>
                      <div>GET /api/resource/financial</div>
                      <div>Authorization: Bearer &lt;ID-JAG_TOKEN&gt;</div>
                      <br />
                      <div className="text-gray-400"># Response</div>
                      <div className="text-green-400">{`{`}</div>
                      <div className="ml-4">"success": true,</div>
                      <div className="ml-4">"data": [...]</div>
                      <div className="text-green-400">{`}`}</div>
                    </div>
                  </div>

                  <div className="border-l-4 border-purple-500 pl-4">
                    <h3 className="font-semibold mb-2">Required Scope</h3>
                    <Badge variant="outline" className="text-purple-600 border-purple-600">
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
                        <span className="ml-2 text-purple-600">mcp:read</span>
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
