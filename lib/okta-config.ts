// Okta Configuration
export const OKTA_CONFIG = {
  // Agent App Configuration
  clientId: "0oa8uywkjcduK9wG30g7",
  orgDomain: "https://qa-aiagentsproduct2tc1.trexcloud.com",
  authServerIssuer: "https://qa-aiagentsproduct2tc1.trexcloud.com/oauth2/aus8uyrhdz9VliiSG0g7",
  clientSecret: "kynuDVOz8uJiN50KC8mVG5Fs4MLi3CF0ePPPLAYueihTXKcuAzDLjPTYllPOEkU7",
  agentPrincipalId: "wlp8uz04u5JEBjmHf0g7",
  redirectUri: "/auth/callback",
  scope: "openid profile email",

  // Token Exchange Configuration
  tokenExchangeScope: "mcp:read",

  // Private Key JWT for client authentication
  privateKeyJWT: {
    alg: "RS256",
    d: "IeZ9W_5pZU_GC2XsuH27HUYKfbfrW0M4FNFR7S-zTZit32wq_u0wtBCKKgo9env8v67dSGWvntOy98opkBW2Q0lW4qp_gayniOxlteDTchlm8uEdi3epeEi1cxzmx55gwwoVR25fzYQYVcHBi5eaBJk7hrgmq58IqXbdmoZh46sQDYmMAM1cmyCRh1u8Tybo1G6s7hgq5_r2Mr_hPbYTiL6cR0aJNG5pJoncE5j9dX2bVhBTA2aDPBFV0brn7KCTRc5v157oww5SNnJN-VRcvQJiiEL5Ib-LxDOzv6kpYZ7Kr9r7E1Ntkoy02kZUDCOK-4PsaqLs9J0IFh2Jb1A54Q",
    dp: "E68Kb9Z-6KFk0HrGzUTiVKHR257aRDrTWjl4CiRy6WzZhN2Y5UJvH1TXqS5SppXgLyBJb2glPebLoMmligW2IQauwCPzE2ThhAiKuh0evfROCpzTHiD3lEh0S3ZJF_Tcw-UVyecZLDx-l9ZTUxF8qeOptaFTlAoJ0X4mgDvqwVM",
    dq: "BhZc1dEERhF44azPIP32lU3TjRbAvSeSdAyy6XHUK2Qoy4h_y2zKE8mMjoyv7apR2EQVCm3UOLG-Zzw8u_WlmXc2faNWN8YZAaynK0bnpTlb2ZUKJicLci4PDqXN7sJFw3GQFHlH0nbKJNWkZJKYktpDiiPsL61l6gE8-wXHQsE",
    e: "AQAB",
    kty: "RSA",
    n: "xDjqNCfetkjPz50-LNh1L9t1CNDZTq8ZMxLLV4DDSbgQ6hpwvB4-XRzjpihZAjzTZQX6wquKk3f5eg_s4K4mHsNUkn90owVIvNX-cjbnbsYEpDG0vrf_XZ6_wAWmaK_pyLFb3Tfc6DNpUxrD_XLK7Yty9WwvhU_xinxmooq4hSe7NkrEAP1KDD4zkdSq0Esf3baHgGP7u8Q6UxlqeBcwOhOX4ik6dMT2ZdWzwHKjEqZG6wCa5nJ4iEeahTJcL7bZNAbXIlFEY4EhDd4F5vS6yDUtjG6V7oiKxZzOJm3OKfPyywxV44i3cQgc21Y_oTjUAJovZB-tQ8kHW1JUq3b6Tw",
    p: "_ZchTwF_OfBFVzEHs7FFxomCw8wpBLwxK17f7H-s9V6bYyUTuE3r28PC6EvhctD8Rq3ZPB3THPA5jNJFiBb0nQ2GqLjz8H93kPzEZgzTUNLCGM2cm2fntLdpOVlAx5WMy5rVBbs13SinS3uBDSztGNOLHHxC5kPUfwRgviV9uO8",
    q: "xhY8BM-1prx_gqFHKA0qXJabce3trzKKP3KFe-ZGUeaaBL2QIiPIJRGVv5YNApLgjRVEMjElsO7aPt-1yuqW5ObTnpyU3DHtKKHKmtRkLeMnxyrt2QB1GNnFHFP3bZhYLayOHSdxGHug36_ShZdoKQkzqHrUejoqH-yM3ww9FKE",
    qi: "j4PiaouTjyQvSc9NNBAUZeWphGTZsMwjKG3FepbuzA60WcWVfcf2N-x5IA8i-sBpkTFYA4xLXVPD8cQMCkfciY2wv1I_zTUiCHNriuNMfqeYdADW9WbiIWVe9vjGoD5DdNnFyBIP8phjaM3RW6eHUJViROgJrspY2Pnxqamqm0E",
    kid: "2e4ab4cb554d2fc1a2d73478b95c936a",
    use: "sig",
  },
} as const

// OAuth endpoints
export const OAUTH_ENDPOINTS = {
  authorization: `${OKTA_CONFIG.authServerIssuer}/v1/authorize`,
  token: `${OKTA_CONFIG.orgDomain}/oauth2/v1/token`,
  jwks: `${OKTA_CONFIG.authServerIssuer}/v1/keys`,
  metadata: `${OKTA_CONFIG.authServerIssuer}/.well-known/oauth-authorization-server`,
}
