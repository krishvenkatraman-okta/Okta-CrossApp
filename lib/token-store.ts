"use client"

// Token storage and event system for displaying tokens in the UI
type TokenType = "id_token" | "access_token" | "id_jag_token" | "auth0_access_token" | "web_id_token" | "web_access_token"

interface TokenInfo {
  type: TokenType
  token: string
  timestamp: number
  decoded?: any
}

type TokenListener = (tokens: Map<TokenType, TokenInfo>) => void

class TokenStore {
  private tokens = new Map<TokenType, TokenInfo>()
  private listeners = new Set<TokenListener>()

  setToken(type: TokenType, token: string) {
    const decoded = this.decodeJWT(token)
    this.tokens.set(type, {
      type,
      token,
      timestamp: Date.now(),
      decoded,
    })
    this.notifyListeners()
  }

  getToken(type: TokenType): TokenInfo | undefined {
    return this.tokens.get(type)
  }

  getAllTokens(): Map<TokenType, TokenInfo> {
    return new Map(this.tokens)
  }

  clearTokens() {
    this.tokens.clear()
    this.notifyListeners()
  }

  subscribe(listener: TokenListener) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => listener(this.getAllTokens()))
  }

  private decodeJWT(token: string): any {
    try {
      const parts = token.split(".")
      if (parts.length !== 3) return null

      const payload = parts[1]
      const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")))
      return decoded
    } catch (error) {
      console.error("Failed to decode JWT:", error)
      return null
    }
  }
}

export const tokenStore = new TokenStore()
