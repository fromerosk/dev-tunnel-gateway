# Dev Tunnel Gateway

An ngrok-like relay system that enables mobile apps under development to reach a developer's local backend server through an AWS-hosted serverless gateway.

## Architecture

```
┌─────────────────┐         ┌──────────────────────────────────────────────┐
│   Mobile App    │         │              AWS Cloud                        │
│                 │         │                                               │
│  HTTPS request  │────────▶│  HTTP API Gateway                            │
│                 │         │       │                                       │
└─────────────────┘         │       ▼                                       │
                            │  Forward Lambda ──▶ DynamoDB (session lookup) │
                            │       │                                       │
                            │       ▼                                       │
                            │  WebSocket API Gateway (PostToConnection)     │
                            │       │                                       │
                            └───────┼───────────────────────────────────────┘
                                    │ WSS
                                    ▼
                            ┌─────────────────┐
                            │  Tunnel Client   │
                            │  (dev-tunnel)    │
                            │       │          │
                            │       ▼          │
                            │  localhost:PORT  │
                            │  (your server)   │
                            └─────────────────┘
```

**Data flow:**

1. Mobile app sends HTTPS request to `https://{subdomain}.{gateway-domain}/path`
2. HTTP API Gateway invokes the Forward Lambda
3. Forward Lambda looks up the active session in DynamoDB by subdomain
4. Lambda serializes the request and sends it through the WebSocket connection
5. Tunnel Client receives the request, proxies it to `localhost:PORT`
6. Local server responds; client relays the response back through WebSocket
7. Gateway returns the response to the mobile app

## Prerequisites

- **AWS CLI** configured with valid credentials (`aws configure`)
- **Node.js 20+**
- **AWS CDK CLI** (`npm install -g aws-cdk`)
- **Optional:** A custom domain with a hosted zone in Route 53

## Quick Start

Full workflow from deploy to first tunneled request:

### 1. Deploy the gateway

```bash
cd packages/dev-tunnel-gateway
npx cdk deploy
```

Note the stack outputs:
- `WebSocketApiEndpoint` — your WSS gateway URL
- `HttpApiEndpoint` — the public HTTP endpoint for mobile traffic

### 2. Create an authentication token

```bash
aws ssm put-parameter \
  --name "/dev-tunnel/tokens/my-token" \
  --type SecureString \
  --value '{"secret":"my-secret-value","expiresAt":1767225600,"owner":"your-name"}'
```

### 3. Start your local dev server

```bash
# Example: start your backend on port 3000
cd packages/backend && npm run dev
```

### 4. Start the tunnel

```bash
dev-tunnel --gateway-url wss://abc123.execute-api.us-east-1.amazonaws.com/prod \
           --token my-secret-value \
           --port 3000
```

Output:
```
✔ Connected to gateway
✔ Tunnel established: https://a3f8k2m9.your-domain.com/
  Forwarding to localhost:3000
  Ready for requests...
```

### 5. Send a request from the mobile app

Point the mobile app's base URL at the public tunnel URL:

```
GET https://a3f8k2m9.your-domain.com/api/users
```

The request flows through the gateway to your local server and back.

### 6. Tear down when done

```bash
npx cdk destroy
```

## CLI Usage

```
dev-tunnel [options]
```

### Flags

| Flag | Required | Description |
|------|----------|-------------|
| `--gateway-url <url>` | Yes | WSS endpoint of the deployed gateway |
| `--token <token>` | Yes | Authentication token secret value |
| `--port <port>` | Yes | Local port to forward traffic to (1–65535) |

### Example

```bash
dev-tunnel --gateway-url wss://abc123.execute-api.us-east-1.amazonaws.com/prod \
           --token my-secret-value \
           --port 3000
```

### Output

While the tunnel is active, each forwarded request is logged to stdout:

```
✔ Connected to gateway
✔ Tunnel established: https://a3f8k2m9.your-domain.com/
  Forwarding to localhost:3000
  Ready for requests...

← POST /api/users 201 45ms
← GET  /api/users 200 12ms
← GET  /api/users/42 404 8ms
```

### Signals

- `Ctrl+C` (SIGINT) or SIGTERM: completes in-flight requests, closes the tunnel, and exits with code 0
- If the gateway is unreachable, the client retries with exponential backoff (1s, 2s, 4s, 8s, 16s) before exiting with code 1

## Deployment

```bash
npx cdk deploy
```

After deployment, the stack outputs will display:

- **WebSocketApiEndpoint** — WSS endpoint for the tunnel control channel
- **HttpApiEndpoint** — HTTPS endpoint for inbound mobile app traffic
- **HealthCheckUrl** — Health check endpoint (GET)

## Authentication Tokens

Tokens are **not** provisioned automatically by the CDK stack. They must be created manually in AWS Systems Manager Parameter Store.

### Creating a Token

Create a SecureString parameter at the path `/dev-tunnel/tokens/{tokenId}`:

```bash
aws ssm put-parameter \
  --name "/dev-tunnel/tokens/my-token-id" \
  --type SecureString \
  --value '{"secret":"your-secret-value","expiresAt":1735689600,"owner":"developer-name"}'
```

**Token value format (JSON):**

| Field | Type | Description |
|-------|------|-------------|
| `secret` | string | The secret value the CLI client presents to authenticate |
| `expiresAt` | number | Unix timestamp (epoch seconds) when the token expires |
| `owner` | string | Developer name or identifier for auditing purposes |

### Token Path Convention

The stack stores the expected token path prefix in SSM at `/dev-tunnel/config/token-path`. All tokens must be created under `/dev-tunnel/tokens/` for the Lambda authorizer to find them.

### Rotating a Token

1. Create a new token parameter with a new `tokenId`
2. Update the CLI client configuration with the new token
3. Delete the old token parameter once no sessions are using it

## Custom Domain Setup

By default the gateway uses auto-generated API Gateway URLs. To use a custom domain (e.g., `*.tunnel.yourcompany.dev`):

### Prerequisites

- A domain with its hosted zone in Route 53
- Permissions to create ACM certificates

### Steps

1. **Set context values** in `cdk.json` or pass them at deploy time:

```bash
npx cdk deploy \
  --context domainName=tunnel.yourcompany.dev \
  --context hostedZoneId=Z1234567890ABC
```

2. **What the stack provisions:**
   - ACM wildcard certificate for `*.tunnel.yourcompany.dev`
   - Route 53 A/AAAA alias records pointing to the HTTP API Gateway
   - Custom domain mapping on the HTTP API Gateway

3. **Result:** Tunnel sessions get URLs like `https://a3f8k2m9.tunnel.yourcompany.dev/`

4. **DNS propagation** may take a few minutes. Verify with:

```bash
dig a3f8k2m9.tunnel.yourcompany.dev
```

## Tear Down

```bash
npx cdk destroy
```

This removes all stack-provisioned resources. Manually created SSM token parameters are **not** deleted by stack destruction — remove them separately if no longer needed.

## Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| `CLI exits with "Gateway is unreachable"` | Gateway not deployed or wrong URL | Verify the WSS URL from stack outputs. Check `npx cdk deploy` completed. |
| `CLI exits with "Authentication failed: invalid"` | Token secret doesn't match | Verify the `secret` field in SSM matches the `--token` value exactly. |
| `CLI exits with "Authentication failed: expired"` | Token `expiresAt` is in the past | Create a new token with a future expiration timestamp. |
| Mobile app gets HTTP 502 | Tunnel is offline or local server not running | Ensure `dev-tunnel` is running and your local server is listening on the configured port. |
| Mobile app gets HTTP 504 | Local server took >30s to respond | Check for slow endpoints. The gateway timeout is 30 seconds. |
| `WebSocket connection dropped` | Idle timeout or network issues | The client auto-reconnects within 5 minutes. If it fails, restart the tunnel. |
| `Local port not reachable` in logs | Local server crashed or wrong port | Restart your dev server or fix the `--port` flag. |
| Custom domain not resolving | DNS propagation delay or wrong hosted zone | Wait 2–5 minutes. Verify the hostedZoneId matches your domain. |
| `cdk deploy` fails with permission error | Missing IAM permissions | Ensure your AWS credentials have permissions for API Gateway, Lambda, DynamoDB, SSM, and (if custom domain) Route 53 + ACM. |

## Cost Estimate

The gateway uses fully serverless, pay-per-request resources that scale to zero:

| Resource | Pricing Model | Estimated Cost (idle) | Estimated Cost (active dev) |
|----------|---------------|----------------------|----------------------------|
| WebSocket API Gateway | Per connection-minute + per message | $0 | ~$0.50/mo |
| HTTP API Gateway | Per request | $0 | ~$0.10/mo |
| Lambda (6 functions) | Per invocation + duration | $0 | ~$0.05/mo |
| DynamoDB (2 tables) | Per read/write request | $0 | ~$0.01/mo |
| SSM Parameter Store | Free tier (standard params) | $0 | $0 |
| **Total** | | **< $1/mo** | **~$0.70/mo** |

**Notes:**
- "Idle" means no active tunnel sessions. All resources scale to zero.
- "Active dev" assumes a single developer with moderate usage (~1000 requests/day).
- Custom domain adds Route 53 hosted zone cost (~$0.50/mo) and no other charges.
- Data transfer is excluded (typically negligible for dev traffic).
- There are no NAT Gateways, load balancers, or other fixed-cost resources.
