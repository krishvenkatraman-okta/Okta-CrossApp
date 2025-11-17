"use client"

import { Button } from "@/components/ui/button"
import { initiateLogin } from "@/lib/auth-client"
import { initiateWebLogin } from "@/lib/web-auth-client"
import { LogIn } from "@/components/icons"

export function LoginButton() {
  const handleLogin = async () => {
    const redirectUri = `${window.location.origin}/auth/callback`
    await initiateLogin(redirectUri)
  }

  const handleWebLogin = async () => {
    const redirectUri = `${window.location.origin}/auth/web-callback`
    await initiateWebLogin(redirectUri)
  }

  return (
    <div className="space-y-3">
      <Button onClick={handleLogin} size="lg" className="w-full gap-2">
        <LogIn className="h-5 w-5" />
        Sign In with Okta (PKCE)
      </Button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">Or</span>
        </div>
      </div>

      <Button onClick={handleWebLogin} size="lg" variant="outline" className="w-full gap-2 bg-transparent">
        <LogIn className="h-5 w-5" />
        Sign In for Okta Gateway
      </Button>
    </div>
  )
}
