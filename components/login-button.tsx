"use client"

import { Button } from "@/components/ui/button"
import { initiateLogin } from "@/lib/auth-client"
import { LogIn } from "@/components/icons"

export function LoginButton() {
  const handleLogin = async () => {
    const redirectUri = `${window.location.origin}/auth/callback`
    await initiateLogin(redirectUri)
  }

  return (
    <Button onClick={handleLogin} size="lg" className="gap-2">
      <LogIn className="h-5 w-5" />
      Sign In with Okta
    </Button>
  )
}
