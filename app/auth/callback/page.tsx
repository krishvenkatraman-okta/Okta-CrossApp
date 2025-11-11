"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { handleCallback, storeTokens } from "@/lib/auth-client"
import { Loader2 } from "lucide-react"

export default function CallbackPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const processCallback = async () => {
      try {
        const code = searchParams.get("code")
        const state = searchParams.get("state")
        const errorParam = searchParams.get("error")

        if (errorParam) {
          setError(`Authentication error: ${errorParam}`)
          return
        }

        if (!code || !state) {
          setError("Missing authorization code or state")
          return
        }

        // Get the redirect URI (same as used in login)
        const redirectUri = `${window.location.origin}/auth/callback`

        // Exchange code for tokens
        const tokens = await handleCallback(code, state, redirectUri)

        // Store tokens
        storeTokens(tokens)

        // Redirect to home page
        router.push("/")
      } catch (err) {
        console.error("Callback error:", err)
        setError(err instanceof Error ? err.message : "Authentication failed")
      }
    }

    processCallback()
  }, [searchParams, router])

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="max-w-md rounded-lg border border-destructive bg-card p-6 text-center">
          <h1 className="mb-4 text-2xl font-bold text-destructive">Authentication Error</h1>
          <p className="text-muted-foreground">{error}</p>
          <button
            onClick={() => router.push("/")}
            className="mt-6 rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
          >
            Return to Home
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-lg text-muted-foreground">Completing authentication...</p>
      </div>
    </div>
  )
}
