# Deployment Guide

## Vercel Deployment

### Step 1: Connect Repository

1. Go to [vercel.com](https://vercel.com)
2. Click "Add New Project"
3. Import your Git repository
4. Select the repository and click "Import"

### Step 2: Configure Environment Variables

In the Vercel project settings, add all environment variables from `.env.example`:

**Server-side Variables:**
\`\`\`
OKTA_ORG_DOMAIN
OKTA_CLIENT_ID
OKTA_CLIENT_SECRET
OKTA_AUTH_SERVER_ISSUER
OKTA_AGENT_PRINCIPAL_ID
OKTA_PRIVATE_KEY_JWK
OKTA_KEY_ID
\`\`\`

**Client-side Variables (with NEXT_PUBLIC_ prefix):**
\`\`\`
NEXT_PUBLIC_OKTA_CLIENT_ID
NEXT_PUBLIC_REDIRECT_URI
NEXT_PUBLIC_OKTA_ORG_DOMAIN
NEXT_PUBLIC_OKTA_AUTH_SERVER_ISSUER
\`\`\`

### Step 3: Update Redirect URI

1. Copy your Vercel deployment URL (e.g., `https://your-app.vercel.app`)
2. Update `NEXT_PUBLIC_REDIRECT_URI` to `https://your-app.vercel.app/auth/callback`
3. Add this redirect URI to your Okta application configuration

### Step 4: Deploy

Click "Deploy" and wait for the build to complete.

## Custom Domain Setup

1. Go to Project Settings → Domains
2. Add your custom domain
3. Update DNS records as instructed
4. Update environment variables with new domain
5. Update Okta redirect URIs

## Production Checklist

- [ ] All environment variables configured
- [ ] Redirect URIs updated in Okta
- [ ] HTTPS enabled
- [ ] Custom domain configured (optional)
- [ ] CORS settings verified
- [ ] Rate limiting configured
- [ ] Monitoring enabled
- [ ] Error tracking set up
