# Okta Cross-App Access (CAA) Demo

A complete demonstration of Okta's Cross-App Access (CAA) pattern, featuring an AI Agent frontend that securely communicates with independent Resource Server applications using ID-JAG tokens.

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com/krish-venkatramans-projects-dc2c3c9c/v0-okta-cross-app-access)
[![Built with v0](https://img.shields.io/badge/Built%20with-v0.app-black?style=for-the-badge)](https://v0.app/chat/gt94bVu3ZTD)

## Architecture Overview

This demo consists of three main applications:

1. **Agent App** (`/`) - Frontend application with Okta authentication
2. **Financial Resource Server** (`/financial-server`) - Independent API for financial data
3. **KPI Resource Server** (`/kpi-server`) - Independent API for KPI metrics
4. **API Documentation** (`/api-docs`) - Complete API reference and code examples

```
┌─────────────────┐
│   Agent App     │
│                 │
│  1. User Login  │──────┐
│  2. Get ID Token│      │
└─────────────────┘      │
                         │ OIDC Auth
                         ▼
                  ┌─────────────┐
                  │    Okta     │
                  │  Org Auth   │
                  │   Server    │
                  └─────────────┘
                         │
                         │ Token Exchange
                         │ (ID Token → ID-JAG)
                         ▼
                  ┌─────────────┐
                  │    Okta     │
                  │   Custom    │
                  │ Auth Server │
                  └─────────────┘
                         │
                         │ ID-JAG Token
                         │ (with mcp:read scope)
                         ▼
         ┌───────────────┴───────────────┐
         │                               │
         ▼                               ▼
┌──────────────────┐          ┌──────────────────┐
│   Financial      │          │   KPI Server     │
│   Resource API   │          │   Resource API   │
│                  │          │                  │
│ - Validates JAG  │          │ - Validates JAG  │
│ - Returns Data   │          │ - Returns Data   │
└──────────────────┘          └──────────────────┘
```

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- Okta organization with Cross-App Access enabled
- Two Okta applications configured:
  - Agent Application (for user authentication)
  - Resource Application (for API access)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/okta-cross-app-access.git
cd okta-cross-app-access

# Install dependencies
npm install

# Set up environment variables (see below)
cp .env.example .env.local

# Run the development server
npm run dev
```

The application will be available at `http://localhost:3000`

## Environment Variables

### Required Variables

```bash
# Okta Org Configuration (Server-side only)
OKTA_CLIENT_ID=your_client_id              # Used for server-side token exchange
OKTA_CLIENT_SECRET=your_client_secret      # Used for server-side authentication
OKTA_ORG_DOMAIN=https://your-org.okta.com  # Your Okta organization domain
OKTA_AUTH_SERVER_ISSUER=https://your-org.okta.com/oauth2/your_auth_server_id
OKTA_AGENT_PRINCIPAL_ID=your_principal_id  # Agent's principal ID for JWT assertion
OKTA_PRIVATE_KEY_JWK={"kty":"RSA",...}     # Private key JWK as JSON string
OKTA_KEY_ID=your_key_id                    # Key ID from your JWK

# Public Variables (Available in browser)
NEXT_PUBLIC_OKTA_CLIENT_ID=your_client_id  # Same as OKTA_CLIENT_ID, needed for browser auth redirect
NEXT_PUBLIC_REDIRECT_URI=https://your-domain.vercel.app/auth/callback
NEXT_PUBLIC_OKTA_ORG_DOMAIN=https://your-org.okta.com
NEXT_PUBLIC_OKTA_AUTH_SERVER_ISSUER=https://your-org.okta.com/oauth2/your_auth_server_id
```

### Why NEXT_PUBLIC_ Variables?

In Next.js, environment variables are **server-only by default**. The `NEXT_PUBLIC_` prefix exposes them to the browser:

- **Without prefix** (`OKTA_CLIENT_SECRET`) - Only available on server (API routes, server components)
- **With prefix** (`NEXT_PUBLIC_OKTA_CLIENT_ID`) - Available in browser (client components, redirects)

**Why you need both:**
1. **Browser needs** `NEXT_PUBLIC_` variables to construct the Okta authorization redirect URL when user clicks "Login"
2. **Server needs** non-public variables to securely exchange authorization codes for tokens
3. **API endpoints** (`/api/resource/*`) are **publicly accessible** - they validate any incoming token

**External agents can call APIs directly** without needing these environment variables - they just need a valid ID-JAG token!

## Application Routes

### Agent App

**URL:** `/`

The main frontend application where users authenticate and access enterprise data.

**Features:**
- Okta OIDC authentication with PKCE
- Token inspector showing ID Token, OAuth Token, and ID-JAG Token
- Enterprise dashboard with tabs for HR, Financial, and KPI data
- Real-time token exchange visualization

**Endpoints Used:**
- `/api/auth/callback` - OAuth callback handler
- `/api/token-exchange` - Exchanges ID token for ID-JAG token
- `/api/resource/*` - Proxies requests to resource servers

### Financial Resource Server

**URL:** `/financial-server`

Independent resource server application managing financial data.

**Features:**
- Admin UI for managing financial records
- API documentation with authentication requirements
- Security configuration display
- Cross-App Access status indicator

**API Endpoints:**
- `GET /api/resource/financial` - Retrieve financial data
  - **Required:** `Authorization: Bearer <ID-JAG-TOKEN>`
  - **Scope:** `mcp:read`

### KPI Resource Server

**URL:** `/kpi-server`

Independent resource server application managing KPI metrics.

**Features:**
- Admin UI for managing KPI metrics
- API documentation with authentication requirements
- Security configuration display
- Cross-App Access status indicator

**API Endpoints:**
- `GET /api/resource/kpi` - Retrieve KPI data
  - **Required:** `Authorization: Bearer <ID-JAG-TOKEN>`
  - **Scope:** `mcp:read`

### API Documentation

**URL:** `/api-docs`

Complete API reference with code examples and authentication flows.

**Includes:**
- Authentication flow diagrams
- Request/response examples
- Code samples in JavaScript, cURL, and Python
- Error handling documentation

## API Reference

### Authentication Flow

1. **User Login**
   ```
   GET /oauth2/v1/authorize
   - response_type: code
   - client_id: <AGENT_CLIENT_ID>
   - redirect_uri: <REDIRECT_URI>
   - scope: openid profile email
   - state: <random_state>
   - code_challenge: <PKCE_challenge>
   - code_challenge_method: S256
   ```

2. **Token Exchange (ID Token → ID-JAG)**
   ```
   POST /oauth2/v1/token
   - grant_type: urn:ietf:params:oauth:grant-type:token-exchange
   - subject_token: <ID_TOKEN>
   - subject_token_type: urn:ietf:params:oauth:token-type:id_token
   - audience: <AUTH_SERVER_ISSUER>
   - scope: mcp:read
   - client_assertion_type: urn:ietf:params:oauth:client-assertion-type:jwt-bearer
   - client_assertion: <JWT_CLIENT_ASSERTION>
   ```

3. **Access Resource API**
   ```
   GET /api/resource/financial
   Headers:
   - Authorization: Bearer <ID-JAG-TOKEN>
   ```

### Resource API Endpoints

#### Financial Data
```
GET /api/resource/financial
Authorization: Bearer <ID-JAG-TOKEN>

Response:
{
  "data": [
    {
      "id": "1",
      "category": "Revenue",
      "amount": 1250000,
      "period": "Q1 2024",
      "trend": "up",
      "change": 15.2
    }
  ]
}
```

#### KPI Metrics
```
GET /api/resource/kpi
Authorization: Bearer <ID-JAG-TOKEN>

Response:
{
  "data": [
    {
      "id": "1",
      "name": "Customer Satisfaction",
      "value": 94,
      "target": 95,
      "trend": "up",
      "change": 2.5,
      "unit": "%"
    }
  ]
}
```

### Error Responses

```json
{
  "error": "invalid_token",
  "error_description": "Token validation failed: Invalid signature"
}
```

**Common Error Codes:**
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - Insufficient scope
- `500 Internal Server Error` - Server error

## Token Validation

Resource servers validate ID-JAG tokens by:

1. **Fetching JWKS** from Okta's public keys endpoint
2. **Verifying JWT Signature** using the public key
3. **Validating Claims:**
   - `iss` (issuer) matches Okta org domain
   - `aud` (audience) matches auth server issuer
   - `exp` (expiration) is not expired
   - `scope` contains required scope (`mcp:read`)
4. **Extracting Claims:**
   - `sub` (subject) - User ID
   - `client_id` - Agent application ID

## Code Examples

### JavaScript (Fetch API)

```javascript
// Exchange ID token for ID-JAG token
const response = await fetch('/api/token-exchange', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    idToken: 'your-id-token',
    scope: 'mcp:read'
  })
});

const { accessToken } = await response.json();

// Call resource API
const data = await fetch('/api/resource/financial', {
  headers: { 'Authorization': `Bearer ${accessToken}` }
});

const financialData = await data.json();
```

### cURL

```bash
# Exchange token
curl -X POST https://your-domain.vercel.app/api/token-exchange \
  -H "Content-Type: application/json" \
  -d '{"idToken": "your-id-token", "scope": "mcp:read"}'

# Call resource API
curl https://your-domain.vercel.app/api/resource/financial \
  -H "Authorization: Bearer your-id-jag-token"
```

### Python

```python
import requests

# Exchange token
response = requests.post(
    'https://your-domain.vercel.app/api/token-exchange',
    json={'idToken': 'your-id-token', 'scope': 'mcp:read'}
)
access_token = response.json()['accessToken']

# Call resource API
headers = {'Authorization': f'Bearer {access_token}'}
data = requests.get(
    'https://your-domain.vercel.app/api/resource/financial',
    headers=headers
)
print(data.json())
```

## Okta Configuration

### Agent Application Setup

1. Create a new **Web Application** in Okta
2. Configure settings:
   - **Sign-in redirect URIs:** `http://localhost:3000/auth/callback`
   - **Grant types:** Authorization Code, Token Exchange
   - **Client authentication:** Use PKCE and Public key/Private key
3. Add public JWK for JWT client assertion
4. Note the Client ID and configure as `OKTA_CLIENT_ID`

### Resource Application Setup

1. Create a new **API Services** application in Okta
2. Configure JWT client authentication
3. Add the application as a principal in your authorization server
4. Note the Principal ID as `OKTA_AGENT_PRINCIPAL_ID`

### Authorization Server Setup

1. Create a custom authorization server or use default
2. Add custom scope: `mcp:read`
3. Create policy and rules for cross-app access
4. Note the Issuer URI as `OKTA_AUTH_SERVER_ISSUER`

## Deployment

### Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables in Vercel Dashboard
# Settings → Environment Variables
```

**Important:** Update `NEXT_PUBLIC_REDIRECT_URI` to your production URL.

### Deploy to Other Platforms

The application is a standard Next.js app and can be deployed to:
- Netlify
- AWS Amplify
- Railway
- Any Node.js hosting platform

Ensure all environment variables are configured in your deployment platform.

## Development

### Project Structure

```
├── app/
│   ├── api/
│   │   ├── auth/callback/     # OAuth callback handler
│   │   ├── token-exchange/    # Token exchange endpoint
│   │   └── resource/          # Resource API endpoints
│   ├── financial-server/      # Financial resource server UI
│   ├── kpi-server/            # KPI resource server UI
│   ├── api-docs/              # API documentation page
│   └── page.tsx               # Agent app main page
├── components/
│   ├── enterprise-dashboard.tsx  # Main dashboard
│   ├── token-panel.tsx          # Token inspector
│   └── navigation-menu.tsx      # App navigation
├── lib/
│   ├── auth-client.ts           # OIDC authentication
│   ├── token-validator.ts       # JWT validation
│   ├── resource-client.ts       # API client
│   └── okta-config.ts          # Configuration
└── README.md
```

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage
```

### Building for Production

```bash
# Create production build
npm run build

# Start production server
npm start
```

## Troubleshooting

### Common Issues

**Issue: "Invalid client" error during token exchange**
- Verify `OKTA_AGENT_PRINCIPAL_ID` is correct
- Ensure private key JWK is properly configured
- Check that the public key is added to Okta application

**Issue: "No matching key found in JWKS"**
- Verify the token's `kid` matches a key in Okta's JWKS
- Check JWKS endpoint URL is correct
- Ensure the authorization server is properly configured

**Issue: Token validation fails with "Invalid audience"**
- Verify `OKTA_AUTH_SERVER_ISSUER` matches the `aud` claim
- Check authorization server configuration

**Issue: CORS errors when calling resource APIs**
- Ensure resource APIs are on the same domain
- Check CORS configuration if using separate deployments

### Debug Logging

Enable debug logs by checking the browser console and server logs:

```bash
# Server logs show:
[v0] Token endpoint: ...
[v0] Creating JWT with audience: ...
[v0] JWT structure: ...
[v0] Token validation succeeded
```

## Security Considerations

- Store private keys securely in environment variables
- Never commit `.env.local` to version control
- Use HTTPS in production
- Implement rate limiting on API endpoints
- Rotate keys regularly
- Monitor token usage and access patterns

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
- Open an issue on GitHub
- Check Okta documentation at [developer.okta.com](https://developer.okta.com)
- Visit the [v0.app chat](https://v0.app/chat/gt94bVu3ZTD)

## Resources

- [Okta Cross-App Access Documentation](https://developer.okta.com)
- [Next.js Documentation](https://nextjs.org/docs)
- [OAuth 2.0 Token Exchange RFC](https://datatracker.ietf.org/doc/html/rfc8693)

## Security

### Admin Pages
- Financial Server (`/financial-server`) and KPI Server (`/kpi-server`) require authentication
- Users must login with Okta before accessing admin interfaces
- Sessions are validated using ID tokens stored client-side

### API Endpoints
- **Publicly accessible** - No authentication required to call them
- **Token validation** - All endpoints validate incoming ID-JAG tokens
- External agents can call these APIs with valid cross-app access tokens
