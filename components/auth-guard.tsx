"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { tokenStore } from "@/lib/token-store"
import { Loader } from "@/components/icons"

interface AuthGuardProps {
  children: React.ReactNode
}

export function AuthGuard({ children }: AuthGuardProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const router = useRouter()

  useEffect(() => {
    // Check if user has an ID token
    const checkAuth = () => {
      const idToken = tokenStore.getToken("id_token")

      if (!idToken) {
        setIsAuthenticated(false)
        router.push("/?redirect=" + encodeURIComponent(window.location.pathname))
      } else {
        // Check if token is expired
        if (idToken.decoded?.exp) {
          const isExpired = idToken.decoded.exp * 1000 < Date.now()
          if (isExpired) {
            setIsAuthenticated(false)
            tokenStore.clearTokens()
            router.push("/?redirect=" + encodeURIComponent(window.location.pathname))
          } else {
            setIsAuthenticated(true)
          }
        } else {
          setIsAuthenticated(true)
        }
      }
    }

    checkAuth()

    // Subscribe to token changes
    const unsubscribe = tokenStore.subscribe((tokens) => {
      const idToken = tokens.get("id_token")
      setIsAuthenticated(!!idToken)
    })

    return unsubscribe
  }, [router])

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader className="w-8 h-8 mx-auto mb-4 animate-spin" />
          <p className="text-gray-600">Verifying authentication...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  return <>{children}</>
}
