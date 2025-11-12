"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { tokenStore } from "@/lib/token-store"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Copy, Check, Eye, EyeOff } from "@/components/icons"
import { Button } from "@/components/ui/button"

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

  useEffect(() => {
    const unsubscribe = tokenStore.subscribe((newTokens) => {
      setTokens(newTokens)
    })

    setTokens(tokenStore.getAllTokens())

    return unsubscribe
  }, [])

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
        return "ID-JAG Token"
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
        return "Cross-app access token (ID token for JAG)"
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

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Token Inspector</CardTitle>
        <CardDescription>View all tokens in the authentication flow</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={tokensArray[0]?.type} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            {tokensArray.map((tokenInfo) => (
              <TabsTrigger key={tokenInfo.type} value={tokenInfo.type}>
                {getTokenLabel(tokenInfo.type)}
              </TabsTrigger>
            ))}
          </TabsList>

          {tokensArray.map((tokenInfo) => (
            <TabsContent key={tokenInfo.type} value={tokenInfo.type} className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{getTokenLabel(tokenInfo.type)}</h3>
                  <p className="text-sm text-muted-foreground">{getTokenDescription(tokenInfo.type)}</p>
                </div>
                <Badge variant="secondary">{new Date(tokenInfo.timestamp).toLocaleTimeString()}</Badge>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">JWT Token</label>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => toggleTokenVisibility(tokenInfo.type)}>
                      {hiddenTokens.has(tokenInfo.type) ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => copyToken(tokenInfo.type, tokenInfo.token)}>
                      {copiedToken === tokenInfo.type ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
                <ScrollArea className="h-24 rounded-md border bg-muted/50 p-3">
                  <code className="break-all text-xs font-mono">{formatToken(tokenInfo.token, tokenInfo.type)}</code>
                </ScrollArea>
              </div>

              {tokenInfo.decoded && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Decoded Payload</label>
                  <ScrollArea className="h-64 rounded-md border bg-muted/50 p-3">
                    <pre className="text-xs">{JSON.stringify(tokenInfo.decoded, null, 2)}</pre>
                  </ScrollArea>

                  <div className="grid grid-cols-2 gap-2 pt-2">
                    {tokenInfo.decoded.iss && (
                      <div>
                        <div className="text-xs text-muted-foreground">Issuer</div>
                        <div className="truncate text-sm font-mono">{tokenInfo.decoded.iss}</div>
                      </div>
                    )}
                    {tokenInfo.decoded.sub && (
                      <div>
                        <div className="text-xs text-muted-foreground">Subject</div>
                        <div className="truncate text-sm font-mono">{tokenInfo.decoded.sub}</div>
                      </div>
                    )}
                    {tokenInfo.decoded.aud && (
                      <div>
                        <div className="text-xs text-muted-foreground">Audience</div>
                        <div className="truncate text-sm font-mono">{tokenInfo.decoded.aud}</div>
                      </div>
                    )}
                    {tokenInfo.decoded.client_id && (
                      <div>
                        <div className="text-xs text-muted-foreground">Client ID</div>
                        <div className="truncate text-sm font-mono">{tokenInfo.decoded.client_id}</div>
                      </div>
                    )}
                    {tokenInfo.decoded.scope && (
                      <div>
                        <div className="text-xs text-muted-foreground">Scope</div>
                        <div className="text-sm font-mono">{tokenInfo.decoded.scope}</div>
                      </div>
                    )}
                    {tokenInfo.decoded.exp && (
                      <div>
                        <div className="text-xs text-muted-foreground">Expires</div>
                        <div className="text-sm">{new Date(tokenInfo.decoded.exp * 1000).toLocaleString()}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  )
}
