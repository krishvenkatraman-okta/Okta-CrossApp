"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { handleWebCallback, storeWebTokens } from "@/lib/web-auth-client"
import { Loader2 } from "@/components/icons"

export default function WebAuthCallback() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function processCallback() {
      try {
        const code = searchParams.get("code")
        const state = searchParams.get("state")

        if (!code || !state) {
          setError("Missing authorization code or state")
          return
        }

        const redirectUri = `${window.location.origin}/auth/web-callback`
        const tokens = await handleWebCallback(code, state, redirectUri)

        storeWebTokens(tokens)

        router.push("/")
      } catch (err) {
        console.error("Web auth callback error:", err)
        setError(err instanceof Error ? err.message : "Authentication failed")
      }
    }

    processCallback()
  }, [searchParams, router])

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="w-full max-w-md rounded-lg border-2 border-red-500 bg-card p-8 text-center">
          <h1 className="mb-4 text-2xl font-bold text-red-500">Authentication Error</h1>
          <p className="mb-6 text-muted-foreground">Token exchange failed:</p>
          <p className="mb-6 text-sm text-foreground">{error}</p>
          <button
            onClick={() => router.push("/")}
            className="rounded-md bg-foreground px-6 py-2 text-background hover:opacity-90"
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
        <p className="mt-4 text-lg text-muted-foreground">Processing web authentication...</p>
      </div>
    </div>
  )
}
