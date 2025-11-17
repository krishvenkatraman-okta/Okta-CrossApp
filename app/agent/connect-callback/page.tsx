"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, CheckCircle2, XCircle } from "@/components/icons"

function ConnectCallbackContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading")
  const [error, setError] = useState<string>("")

  useEffect(() => {
    const handleCallback = async () => {
      const connectCode = searchParams.get("connect_code")
      const errorParam = searchParams.get("error")

      if (errorParam) {
        setStatus("error")
        setError(`Authentication failed: ${errorParam}`)
        return
      }

      if (connectCode) {
        console.log('[v0] Received connect_code, completing connection')
        
        // If opened as popup, notify parent and close
        if (window.opener) {
          console.log('[v0] Popup mode - notifying parent window')
          window.opener.postMessage({
            type: 'connected_account_complete',
            connectCode
          }, window.location.origin)
          
          setStatus("success")
          setError("Account connected successfully! You can close this window.")
          
          // Auto-close popup after 2 seconds
          setTimeout(() => {
            window.close()
          }, 2000)
          return
        }

        // If not a popup, complete the connection directly
        const authSession = sessionStorage.getItem("pendingAuthSession")
        const meToken = sessionStorage.getItem("pendingMEToken")
        const codeVerifier = sessionStorage.getItem("pendingCodeVerifier")

        if (!authSession || !meToken) {
          setStatus("error")
          setError("Missing auth session or ME token")
          return
        }

        if (!codeVerifier) {
          setStatus("error")
          setError("Missing code verifier for PKCE flow")
          return
        }

        try {
          const { completeConnectedAccount } = await import("@/lib/gateway-test-client")
          await completeConnectedAccount(authSession, connectCode, meToken, codeVerifier)

          sessionStorage.removeItem("pendingAuthSession")
          sessionStorage.removeItem("pendingMEToken")
          sessionStorage.removeItem("pendingCodeVerifier")
          setStatus("success")

          // Redirect back to main page after 2 seconds
          setTimeout(() => {
            router.push("/")
          }, 2000)
        } catch (err: any) {
          console.error('[v0] Failed to complete connection:', err)
          setStatus("error")
          setError(err.message || "Failed to complete connection")
        }
      } else {
        setStatus("error")
        setError("Missing connect_code parameter")
      }
    }

    handleCallback()
  }, [searchParams, router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {status === "loading" && <Loader2 className="h-5 w-5 animate-spin" />}
            {status === "success" && <CheckCircle2 className="h-5 w-5 text-green-500" />}
            {status === "error" && <XCircle className="h-5 w-5 text-red-500" />}
            {status === "loading" && "Connecting Account..."}
            {status === "success" && "Account Connected!"}
            {status === "error" && "Connection Failed"}
          </CardTitle>
          <CardDescription>
            {status === "loading" && "Please wait while we complete the connection"}
            {status === "success" && "Redirecting you back to the main page..."}
            {status === "error" && error}
          </CardDescription>
        </CardHeader>
        {status === "error" && (
          <CardContent>
            <Button onClick={() => router.push("/")} className="w-full">
              Return to Main Page
            </Button>
          </CardContent>
        )}
      </Card>
    </div>
  )
}

export default function ConnectCallbackPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    }>
      <ConnectCallbackContent />
    </Suspense>
  )
}
