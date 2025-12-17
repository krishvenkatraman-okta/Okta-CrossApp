"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
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
      const sessionId = searchParams.get("session_id")

      console.log("[v0] Callback received")
      console.log("[v0]   connect_code:", connectCode)
      console.log("[v0]   session_id:", sessionId)
      console.log("[v0]   error:", errorParam)
      console.log("[v0]   All sessionStorage keys:", Object.keys(sessionStorage))

      if (errorParam) {
        setStatus("error")
        setError(`Authentication failed: ${errorParam}`)
        return
      }

      if (connectCode) {
        console.log("[v0] Received connect_code, completing connection")

        let authSession: string | null = null
        let meToken: string | null = null
        let codeVerifier: string | null = null

        if (sessionId) {
          const sessionKey = `ca_session_${sessionId}`
          const sessionData = sessionStorage.getItem(sessionKey)
          console.log("[v0] Retrieved session data with key:", sessionKey)

          if (sessionData) {
            try {
              const parsed = JSON.parse(sessionData)
              authSession = parsed.authSession
              meToken = parsed.meToken
              codeVerifier = parsed.codeVerifier
              console.log("[v0]   auth_session:", authSession ? "found" : "not found")
              console.log("[v0]   me_token:", meToken ? "found" : "not found")
              console.log("[v0]   code_verifier:", codeVerifier ? "found" : "not found")
            } catch (e) {
              console.error("[v0] Failed to parse session data:", e)
            }
          } else {
            console.log("[v0] No session data found with key:", sessionKey)
          }
        } else {
          console.log("[v0] No session_id parameter, searching for any ca_session_* keys")
          const allKeys = Object.keys(sessionStorage)
          const sessionKeys = allKeys.filter((key) => key.startsWith("ca_session_"))
          console.log("[v0] Found session keys:", sessionKeys)

          if (sessionKeys.length > 0) {
            const sessionKey = sessionKeys[sessionKeys.length - 1]
            console.log("[v0] Using session key:", sessionKey)
            const sessionData = sessionStorage.getItem(sessionKey)

            if (sessionData) {
              try {
                const parsed = JSON.parse(sessionData)
                authSession = parsed.authSession
                meToken = parsed.meToken
                codeVerifier = parsed.codeVerifier
                console.log("[v0]   auth_session:", authSession ? "found" : "not found")
                console.log("[v0]   me_token:", meToken ? "found" : "not found")
                console.log("[v0]   code_verifier:", codeVerifier ? "found" : "not found")
              } catch (e) {
                console.error("[v0] Failed to parse session data:", e)
              }
            }
          }
        }

        if (!authSession || !meToken || !codeVerifier) {
          console.log("[v0] Trying old session storage format")
          if (sessionId) {
            authSession = authSession || sessionStorage.getItem(`connect_session_${sessionId}_auth_session`)
            meToken = meToken || sessionStorage.getItem(`connect_session_${sessionId}_me_token`)
            codeVerifier = codeVerifier || sessionStorage.getItem(`connect_session_${sessionId}_code_verifier`)
          }
        }

        if (!authSession || !meToken || !codeVerifier) {
          console.log("[v0] Trying legacy session storage keys")
          authSession = authSession || sessionStorage.getItem("pendingAuthSession")
          meToken = meToken || sessionStorage.getItem("pendingMEToken")
          codeVerifier = codeVerifier || sessionStorage.getItem("pendingCodeVerifier")
        }

        if (window.opener) {
          console.log("[v0] Popup mode detected")

          if (!authSession || !meToken || !codeVerifier) {
            console.error("[v0] Missing required data in popup mode")
            console.log("[v0] Available sessionStorage keys:", Object.keys(sessionStorage))
            setStatus("error")
            setError("Missing auth session, ME token, or code verifier. Please try again.")
            return
          }

          try {
            console.log("[v0] Completing connected account from popup")
            const { completeConnectedAccount } = await import("@/lib/gateway-test-client")
            await completeConnectedAccount(authSession, connectCode, meToken, codeVerifier)

            console.log("[v0] Connection completed, notifying parent window")
            window.opener.postMessage(
              {
                type: "salesforce-connected",
                connectCode,
                success: true,
              },
              window.location.origin,
            )

            const allKeys = Object.keys(sessionStorage)
            const sessionKeys = allKeys.filter((key) => key.startsWith("ca_session_"))
            sessionKeys.forEach((key) => sessionStorage.removeItem(key))

            setStatus("success")
            setError("Account connected successfully! Closing window...")

            setTimeout(() => {
              window.close()
            }, 1000)
          } catch (err: any) {
            console.error("[v0] Failed to complete connection:", err)
            setStatus("error")
            setError(err.message || "Failed to complete connection")

            window.opener.postMessage(
              {
                type: "connected_account_complete",
                success: false,
                error: err.message,
              },
              window.location.origin,
            )
          }

          return
        }

        if (!authSession || !meToken) {
          console.error("[v0] Missing auth session or ME token")
          console.log("[v0] Available sessionStorage keys:", Object.keys(sessionStorage))
          setStatus("error")
          setError("Missing auth session, ME token, or code verifier. Please try again.")
          return
        }

        if (!codeVerifier) {
          console.error("[v0] Missing code verifier")
          setStatus("error")
          setError("Missing code verifier for PKCE flow")
          return
        }

        try {
          console.log("[v0] Completing connected account directly")
          const { completeConnectedAccount } = await import("@/lib/gateway-test-client")
          await completeConnectedAccount(authSession, connectCode, meToken, codeVerifier)

          const allKeys = Object.keys(sessionStorage)
          const sessionKeys = allKeys.filter((key) => key.startsWith("ca_session_"))
          sessionKeys.forEach((key) => sessionStorage.removeItem(key))

          setStatus("success")
          setError("Account connected successfully! Redirecting...")

          setTimeout(() => {
            router.push("/")
          }, 2000)
        } catch (err: any) {
          console.error("[v0] Failed to complete connection:", err)
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
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      }
    >
      <ConnectCallbackContent />
    </Suspense>
  )
}
