"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, CheckCircle2, XCircle } from "@/components/icons"
import { completeConnectedAccount } from "@/lib/gateway-client"

function ConnectCallbackContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading")
  const [error, setError] = useState<string>("")

  useEffect(() => {
    const completeConnection = async () => {
      const connectCode = searchParams.get("connect_code")
      const authSession = sessionStorage.getItem("pendingAuthSession")

      if (!connectCode || !authSession) {
        setStatus("error")
        setError("Missing connection parameters")
        return
      }

      try {
        await completeConnectedAccount(
          authSession,
          connectCode,
          `${window.location.origin}/agent/connect-callback`
        )

        sessionStorage.removeItem("pendingAuthSession")
        setStatus("success")

        // Redirect back to agent after 2 seconds
        setTimeout(() => {
          router.push("/agent")
        }, 2000)
      } catch (err: any) {
        setStatus("error")
        setError(err.message || "Failed to complete connection")
      }
    }

    completeConnection()
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
            {status === "success" && "Redirecting you back to the agent..."}
            {status === "error" && error}
          </CardDescription>
        </CardHeader>
        {status === "error" && (
          <CardContent>
            <Button onClick={() => router.push("/agent")} className="w-full">
              Return to Agent
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
