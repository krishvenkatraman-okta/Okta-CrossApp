"use client"

// Token storage and event system for displaying tokens in the UI
type TokenType = 
  | "id_token" 
  | "access_token" 
  | "id_jag_token" 
  | "auth0_access_token" 
  | "web_id_token" 
  | "web_access_token"
  | "finance_id_jag_token"
  | "finance_auth0_access_token"
  | "salesforce_id_jag_token"
  | "salesforce_auth0_access_token"
  | "me_id_jag_token"
  | "me_auth0_access_token"
  | "salesforce_final_access_token"

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

  setTokensFromServerResponse(data: {
    idJag?: string
    accessToken?: string
    meIdJag?: string
    meAccessToken?: string
    salesforceAccessToken?: string
    financeIdJag?: string
    financeAccessToken?: string
  }) {
    if (data.idJag) {
      this.setToken("salesforce_id_jag_token", data.idJag)
    }
    if (data.accessToken) {
      this.setToken("salesforce_auth0_access_token", data.accessToken)
    }
    if (data.meIdJag) {
      this.setToken("me_id_jag_token" as TokenType, data.meIdJag)
    }
    if (data.meAccessToken) {
      this.setToken("me_auth0_access_token" as TokenType, data.meAccessToken)
    }
    if (data.salesforceAccessToken) {
      this.setToken("salesforce_final_access_token" as TokenType, data.salesforceAccessToken)
    }
    if (data.financeIdJag) {
      this.setToken("finance_id_jag_token" as TokenType, data.financeIdJag)
    }
    if (data.financeAccessToken) {
      this.setToken("finance_auth0_access_token" as TokenType, data.financeAccessToken)
    }
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
