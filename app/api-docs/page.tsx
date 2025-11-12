"use client"

import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { BookOpen, Code, Shield, CheckCircle2, Copy } from "@/components/icons"

export default function APIDocsPage() {
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100">
      <div className="container mx-auto p-8 max-w-6xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <BookOpen className="w-10 h-10 text-indigo-600" />
          <div>
            <h1 className="text-4xl font-bold text-gray-900">Cross-App Access API Documentation</h1>
            <p className="text-gray-600 mt-1">Complete guide for integrating with Okta CAA resource servers</p>
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full max-w-2xl grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="auth">Authentication</TabsTrigger>
            <TabsTrigger value="endpoints">Endpoints</TabsTrigger>
            <TabsTrigger value="examples">Examples</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <Card className="p-6">
              <h2 className="text-2xl font-bold mb-4">Overview</h2>
              <p className="text-gray-700 mb-4 leading-relaxed">
                This API provides secure access to enterprise resources (HR, Financial, and KPI data) using Okta
                Cross-App Access (CAA) with ID-JAG tokens. External agents and applications can authenticate with Okta
                and request access tokens with specific scopes to retrieve protected data.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                <div className="border border-blue-200 rounded-lg p-4 bg-blue-50">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="w-5 h-5 text-blue-600" />
                    <h3 className="font-semibold text-blue-900">Secure</h3>
                  </div>
                  <p className="text-sm text-blue-700">JWT token validation with RS256 signature verification</p>
                </div>
                <div className="border border-purple-200 rounded-lg p-4 bg-purple-50">
                  <div className="flex items-center gap-2 mb-2">
                    <Code className="w-5 h-5 text-purple-600" />
                    <h3 className="font-semibold text-purple-900">RESTful</h3>
                  </div>
                  <p className="text-sm text-purple-700">Standard HTTP methods with JSON responses</p>
                </div>
                <div className="border border-green-200 rounded-lg p-4 bg-green-50">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <h3 className="font-semibold text-green-900">Reliable</h3>
                  </div>
                  <p className="text-sm text-green-700">Comprehensive error handling and validation</p>
                </div>
              </div>

              <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <h3 className="font-semibold text-amber-900 mb-2">Base URL</h3>
                <code className="text-sm font-mono text-amber-800">https://your-domain.vercel.app/api/resource</code>
              </div>
            </Card>
          </TabsContent>

          {/* Authentication Tab */}
          <TabsContent value="auth" className="space-y-6">
            <Card className="p-6">
              <h2 className="text-2xl font-bold mb-4">Authentication Flow</h2>

              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-3">Step 1: User Authentication</h3>
                  <div className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm font-mono mb-2">
                    <div className="text-gray-400"># Authorization Request</div>
                    <div className="text-green-400">GET</div>
                    <div>
                      https://qa-aiagentsproduct2tc1.trexcloud.com/oauth2/v1/authorize ?client_id=YOUR_CLIENT_ID
                    </div>
                    <div>&response_type=code</div>
                    <div>&scope=openid</div>
                    <div>&redirect_uri=YOUR_REDIRECT_URI</div>
                    <div>&state=STATE</div>
                    <div>&code_challenge=CHALLENGE</div>
                    <div>&code_challenge_method=S256</div>
                  </div>
                  <p className="text-sm text-gray-600">User logs in and authorizes, receives authorization code</p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-3">Step 2: Token Exchange</h3>
                  <div className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm font-mono mb-2">
                    <div className="text-gray-400"># Exchange ID token for ID-JAG access token</div>
                    <div className="text-green-400">POST</div>
                    <div>https://qa-aiagentsproduct2tc1.trexcloud.com/oauth2/v1/token</div>
                    <br />
                    <div className="text-gray-400"># Request Body (application/x-www-form-urlencoded)</div>
                    <div>grant_type=urn:ietf:params:oauth:grant-type:token-exchange</div>
                    <div>requested_token_type=urn:ietf:params:oauth:token-type:id-jag</div>
                    <div>subject_token=ID_TOKEN</div>
                    <div>subject_token_type=urn:ietf:params:oauth:token-type:id_token</div>
                    <div>client_assertion_type=urn:ietf:params:oauth:client-assertion-type:jwt-bearer</div>
                    <div>client_assertion=JWT_ASSERTION</div>
                    <div>audience=AUTH_SERVER_ISSUER</div>
                    <div>scope=mcp:read</div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-3">Step 3: API Request</h3>
                  <div className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm font-mono">
                    <div className="text-gray-400"># Use ID-JAG token to access resources</div>
                    <div className="text-green-400">GET</div>
                    <div>/api/resource/financial</div>
                    <div>Authorization: Bearer ID_JAG_ACCESS_TOKEN</div>
                  </div>
                </div>

                <div className="border-l-4 border-purple-500 pl-4">
                  <h3 className="font-semibold mb-2">Required Scope</h3>
                  <Badge variant="outline" className="text-purple-600 border-purple-600 mb-2">
                    mcp:read
                  </Badge>
                  <p className="text-sm text-gray-600">
                    All resource endpoints require the <code className="text-purple-600">mcp:read</code> scope in the
                    access token.
                  </p>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* Endpoints Tab */}
          <TabsContent value="endpoints" className="space-y-6">
            {/* HR Endpoint */}
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Badge className="bg-green-600">GET</Badge>
                <code className="text-lg font-mono">/api/resource/hr</code>
              </div>
              <p className="text-gray-700 mb-4">Retrieve employee and human resources data</p>

              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Request Headers</h3>
                  <div className="bg-gray-50 p-3 rounded border font-mono text-sm">
                    Authorization: Bearer &lt;ID-JAG_TOKEN&gt;
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Response</h3>
                  <div className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm font-mono overflow-x-auto">
                    <pre>{`{
  "success": true,
  "data": [
    {
      "id": "emp001",
      "name": "Alice Johnson",
      "department": "Engineering",
      "position": "Senior Software Engineer",
      "email": "alice.johnson@company.com",
      "salary": 145000,
      "hireDate": "2020-03-15"
    }
  ],
  "metadata": {
    "requestedBy": "00u8uqjojqqmM8zwy0g7",
    "clientId": "wlp8uz04u5JEBjmHf0g7",
    "timestamp": "2025-11-11T04:23:24.901Z"
  }
}`}</pre>
                  </div>
                </div>
              </div>
            </Card>

            {/* Financial Endpoint */}
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Badge className="bg-blue-600">GET</Badge>
                <code className="text-lg font-mono">/api/resource/financial</code>
              </div>
              <p className="text-gray-700 mb-4">Retrieve financial records and metrics</p>

              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Request Headers</h3>
                  <div className="bg-gray-50 p-3 rounded border font-mono text-sm">
                    Authorization: Bearer &lt;ID-JAG_TOKEN&gt;
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Response</h3>
                  <div className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm font-mono overflow-x-auto">
                    <pre>{`{
  "success": true,
  "data": [
    {
      "id": "fin001",
      "quarter": "Q1 2025",
      "revenue": 2500000,
      "expenses": 1800000,
      "profit": 700000,
      "department": "Company-wide"
    }
  ],
  "metadata": {
    "requestedBy": "00u8uqjojqqmM8zwy0g7",
    "clientId": "wlp8uz04u5JEBjmHf0g7",
    "timestamp": "2025-11-11T04:23:24.901Z"
  }
}`}</pre>
                  </div>
                </div>
              </div>
            </Card>

            {/* KPI Endpoint */}
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Badge className="bg-purple-600">GET</Badge>
                <code className="text-lg font-mono">/api/resource/kpi</code>
              </div>
              <p className="text-gray-700 mb-4">Retrieve key performance indicators and metrics</p>

              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Request Headers</h3>
                  <div className="bg-gray-50 p-3 rounded border font-mono text-sm">
                    Authorization: Bearer &lt;ID-JAG_TOKEN&gt;
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Response</h3>
                  <div className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm font-mono overflow-x-auto">
                    <pre>{`{
  "success": true,
  "data": [
    {
      "id": "kpi001",
      "metric": "Customer Satisfaction",
      "value": 87,
      "target": 85,
      "trend": "up",
      "period": "March 2025"
    }
  ],
  "metadata": {
    "requestedBy": "00u8uqjojqqmM8zwy0g7",
    "clientId": "wlp8uz04u5JEBjmHf0g7",
    "timestamp": "2025-11-11T04:23:24.901Z"
  }
}`}</pre>
                  </div>
                </div>
              </div>
            </Card>

            {/* Error Responses */}
            <Card className="p-6 border-red-200 bg-red-50">
              <h3 className="text-lg font-semibold mb-4 text-red-900">Error Responses</h3>
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2 text-red-800">401 Unauthorized</h4>
                  <div className="bg-gray-900 text-gray-100 p-3 rounded-lg text-sm font-mono">
                    <pre>{`{
  "error": "Unauthorized",
  "message": "Invalid signature"
}`}</pre>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-2 text-red-800">403 Forbidden</h4>
                  <div className="bg-gray-900 text-gray-100 p-3 rounded-lg text-sm font-mono">
                    <pre>{`{
  "error": "Insufficient permissions. Required scope: mcp:read"
}`}</pre>
                  </div>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* Examples Tab */}
          <TabsContent value="examples" className="space-y-6">
            <Card className="p-6">
              <h2 className="text-2xl font-bold mb-4">Code Examples</h2>

              <div className="space-y-6">
                {/* JavaScript Example */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-semibold">JavaScript / Node.js</h3>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        copyToClipboard(`async function fetchFinancialData(accessToken) {
  const response = await fetch('/api/resource/financial', {
    headers: {
      'Authorization': \`Bearer \${accessToken}\`
    }
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch financial data');
  }
  
  return await response.json();
}`)
                      }
                    >
                      <Copy className="w-4 h-4 mr-1" />
                      Copy
                    </Button>
                  </div>
                  <div className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm font-mono overflow-x-auto">
                    <pre>{`async function fetchFinancialData(accessToken) {
  const response = await fetch('/api/resource/financial', {
    headers: {
      'Authorization': \`Bearer \${accessToken}\`
    }
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch financial data');
  }
  
  return await response.json();
}

// Usage
const data = await fetchFinancialData(idJagToken);
console.log(data);`}</pre>
                  </div>
                </div>

                {/* cURL Example */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-semibold">cURL</h3>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        copyToClipboard(`curl -X GET https://your-domain.vercel.app/api/resource/kpi \\
  -H "Authorization: Bearer YOUR_ID_JAG_TOKEN"`)
                      }
                    >
                      <Copy className="w-4 h-4 mr-1" />
                      Copy
                    </Button>
                  </div>
                  <div className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm font-mono overflow-x-auto">
                    <pre>{`curl -X GET https://your-domain.vercel.app/api/resource/kpi \\
  -H "Authorization: Bearer YOUR_ID_JAG_TOKEN"`}</pre>
                  </div>
                </div>

                {/* Python Example */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-semibold">Python</h3>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        copyToClipboard(`import requests

def fetch_hr_data(access_token):
    headers = {
        'Authorization': f'Bearer {access_token}'
    }
    
    response = requests.get(
        'https://your-domain.vercel.app/api/resource/hr',
        headers=headers
    )
    
    response.raise_for_status()
    return response.json()

# Usage
data = fetch_hr_data(id_jag_token)
print(data)`)
                      }
                    >
                      <Copy className="w-4 h-4 mr-1" />
                      Copy
                    </Button>
                  </div>
                  <div className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm font-mono overflow-x-auto">
                    <pre>{`import requests

def fetch_hr_data(access_token):
    headers = {
        'Authorization': f'Bearer {access_token}'
    }
    
    response = requests.get(
        'https://your-domain.vercel.app/api/resource/hr',
        headers=headers
    )
    
    response.raise_for_status()
    return response.json()

# Usage
data = fetch_hr_data(id_jag_token)
print(data)`}</pre>
                  </div>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
