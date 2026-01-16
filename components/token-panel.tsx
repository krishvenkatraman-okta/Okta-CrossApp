"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { tokenStore } from "@/lib/token-store"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Copy, Check, Eye, EyeOff } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface TokenInfo {
  type: string
  token: string
  timestamp: number
  decoded?: any
}

export function TokenPanel() {
  const [tokens, setTokens] = useState<Map<string, TokenInfo>>(new Map())
  const [copiedToken, setCopiedToken] = useState<string | null>(null)
  const [hiddenTokens, setHiddenTokens] = useState<Set<string>>(new Set())
  const [selectedToken, setSelectedToken] = useState<string | null>(null)

  useEffect(() => {
    const unsubscribe = tokenStore.subscribe((newTokens) => {
      setTokens(newTokens)
      if (!selectedToken && newTokens.size > 0) {
        setSelectedToken(Array.from(newTokens.keys())[0])
      }
    })

    const allTokens = tokenStore.getAllTokens()
    setTokens(allTokens)
    if (!selectedToken && allTokens.size > 0) {
      setSelectedToken(Array.from(allTokens.keys())[0])
    }

    return unsubscribe
  }, [selectedToken])

  const copyToken = (type: string, token: string) => {
    navigator.clipboard.writeText(token)
    setCopiedToken(type)
    setTimeout(() => setCopiedToken(null), 2000)
  }

  const toggleTokenVisibility = (type: string) => {
    setHiddenTokens((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(type)) {
        newSet.delete(type)
      } else {
        newSet.add(type)
      }
      return newSet
    })
  }

  const formatToken = (token: string, type: string) => {
    if (hiddenTokens.has(type)) {
      return "•".repeat(50)
    }
    return token
  }

  const getTokenLabel = (type: string) => {
    switch (type) {
      case "id_token":
        return "ID Token"
      case "access_token":
        return "Access Token"
      case "id_jag_token":
        return "Cross-App ID-JAG Token"
      case "auth0_access_token":
        return "Okta Relay Access Token"
      case "salesforce_auth0_access_token":
        return "Okta Relay Access Token (Salesforce)"
      case "finance_auth0_access_token":
        return "Okta Relay Access Token (Finance)"
      case "me_auth0_access_token":
        return "Okta Relay Access Token (ME)"
      case "web_id_token":
        return "Web ID Token"
      case "web_access_token":
        return "Web Access Token"
      case "vaulted_secret_token":
        return "Vaulted Secret Token"
      default:
        return type
    }
  }

  const getTokenDescription = (type: string) => {
    switch (type) {
      case "id_token":
        return "OpenID Connect token from initial authentication"
      case "access_token":
        return "OAuth 2.0 access token for resource access"
      case "id_jag_token":
        return "Cross-app ID-JAG token from token exchange"
      case "auth0_access_token":
        return "Okta Relay access token for resource API"
      case "salesforce_auth0_access_token":
        return "Okta Relay access token for Salesforce Gateway"
      case "finance_auth0_access_token":
        return "Okta Relay access token for Financial Gateway"
      case "me_auth0_access_token":
        return "Okta Relay access token for ME Connected Accounts"
      case "web_id_token":
        return "Web Client ID token from Okta"
      case "web_access_token":
        return "Web Client access token"
      case "vaulted_secret_token":
        return "Vaulted secret containing GitHub PAT"
      default:
        return ""
    }
  }

  const tokensArray = Array.from(tokens.values())

  if (tokensArray.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle>Token Inspector</CardTitle>
          <CardDescription>No tokens available. Please authenticate first.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const currentToken = selectedToken ? tokens.get(selectedToken) : null

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Token Inspector</CardTitle>
        <CardDescription>View all tokens in the authentication flow</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Select Token</label>
          <Select value={selectedToken || undefined} onValueChange={setSelectedToken}>
            <SelectTrigger>
              <SelectValue placeholder="Select a token to view" />
            </SelectTrigger>
            <SelectContent>
              {tokensArray.map((tokenInfo) => (
                <SelectItem key={tokenInfo.type} value={tokenInfo.type}>
                  {getTokenLabel(tokenInfo.type)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {currentToken && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">{getTokenLabel(currentToken.type)}</h3>
                <p className="text-sm text-muted-foreground">{getTokenDescription(currentToken.type)}</p>
              </div>
              <Badge variant="secondary">{new Date(currentToken.timestamp).toLocaleTimeString()}</Badge>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">JWT Token</label>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => toggleTokenVisibility(currentToken.type)}>
                    {hiddenTokens.has(currentToken.type) ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => copyToken(currentToken.type, currentToken.token)}>
                    {copiedToken === currentToken.type ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              <ScrollArea className="h-24 rounded-md border bg-muted/50 p-3">
                <code className="break-all text-xs font-mono">
                  {formatToken(currentToken.token, currentToken.type)}
                </code>
              </ScrollArea>
            </div>

            {currentToken.decoded && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Decoded Payload</label>
                <ScrollArea className="h-64 rounded-md border bg-muted/50 p-3">
                  <pre className="text-xs">{JSON.stringify(currentToken.decoded, null, 2)}</pre>
                </ScrollArea>

                <div className="grid grid-cols-2 gap-2 pt-2">
                  {currentToken.decoded.iss && (
                    <div>
                      <div className="text-xs text-muted-foreground">Issuer</div>
                      <div className="truncate text-sm font-mono">{currentToken.decoded.iss}</div>
                    </div>
                  )}
                  {currentToken.decoded.sub && (
                    <div>
                      <div className="text-xs text-muted-foreground">Subject</div>
                      <div className="truncate text-sm font-mono">{currentToken.decoded.sub}</div>
                    </div>
                  )}
                  {currentToken.decoded.aud && (
                    <div>
                      <div className="text-xs text-muted-foreground">Audience</div>
                      <div className="truncate text-sm font-mono">{currentToken.decoded.aud}</div>
                    </div>
                  )}
                  {currentToken.decoded.client_id && (
                    <div>
                      <div className="text-xs text-muted-foreground">Client ID</div>
                      <div className="truncate text-sm font-mono">{currentToken.decoded.client_id}</div>
                    </div>
                  )}
                  {currentToken.decoded.scope && (
                    <div>
                      <div className="text-xs text-muted-foreground">Scope</div>
                      <div className="text-sm font-mono">{currentToken.decoded.scope}</div>
                    </div>
                  )}
                  {currentToken.decoded.exp && (
                    <div>
                      <div className="text-xs text-muted-foreground">Expires</div>
                      <div className="text-sm">{new Date(currentToken.decoded.exp * 1000).toLocaleString()}</div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
