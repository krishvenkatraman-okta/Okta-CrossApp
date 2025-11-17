"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Cloud, CheckCircle2, XCircle, Loader2 } from "./icons"
import { createConnectedAccount } from "@/lib/gateway-client"

interface ConnectedAccount {
  name: string
  status: "connected" | "disconnected" | "pending"
  lastSync?: string
}

export function ConnectedAccounts() {
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([
    { name: "Salesforce", status: "disconnected" },
  ])
  const [connecting, setConnecting] = useState<string | null>(null)

  const handleConnect = async (accountName: string) => {
    setConnecting(accountName)

    try {
      const connectData = await createConnectedAccount(
        accountName,
        `${window.location.origin}/agent/connect-callback`,
        ["openid", "profile"]
      )

      // Open connection window
      const connectUrl = `${connectData.connect_uri}?ticket=${connectData.connect_params.ticket}`
      window.open(connectUrl, "_blank", "width=600,height=700")

      // Store for completion
      sessionStorage.setItem("pendingAuthSession", connectData.auth_session)

      // Update status to pending
      setAccounts((prev) =>
        prev.map((acc) => (acc.name === accountName ? { ...acc, status: "pending" as const } : acc))
      )
    } catch (error: any) {
      console.error("Connection error:", error)
      alert(error.message || "Failed to initiate connection")
    } finally {
      setConnecting(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connected Accounts</CardTitle>
        <CardDescription>Manage your connected enterprise accounts for gateway access</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {accounts.map((account) => (
            <div key={account.name} className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-3">
                <Cloud className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">{account.name}</p>
                  {account.lastSync && <p className="text-xs text-muted-foreground">Last sync: {account.lastSync}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {account.status === "connected" && (
                  <Badge variant="default" className="gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Connected
                  </Badge>
                )}
                {account.status === "disconnected" && (
                  <Button
                    size="sm"
                    onClick={() => handleConnect(account.name)}
                    disabled={connecting === account.name}
                  >
                    {connecting === account.name ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      "Connect"
                    )}
                  </Button>
                )}
                {account.status === "pending" && (
                  <Badge variant="secondary" className="gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Pending
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
