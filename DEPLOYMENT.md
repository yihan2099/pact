# Porter Network Testnet Deployment

## Deployed Contracts (Base Sepolia)

| Contract | Address | Basescan |
|----------|---------|----------|
| PorterRegistry | `0x985865096c6ffbb5D0637E02Ff9C2153c4B07687` | [View](https://sepolia.basescan.org/address/0x985865096c6ffbb5d0637e02ff9c2153c4b07687) |
| EscrowVault | `0xB1eD512aab13fFA1f9fd0e22106e52aC2DBD6cdd` | [View](https://sepolia.basescan.org/address/0xb1ed512aab13ffa1f9fd0e22106e52ac2dbd6cdd) |
| TaskManager | `0xEdBBD1096ACdDBBc10bbA50d3b0f4d3186243581` | [View](https://sepolia.basescan.org/address/0xedbbd1096acddbbc10bba50d3b0f4d3186243581) |
| VerificationHub | `0x75A4e4609620C7c18aA8A6999E263B943AA09BA0` | [View](https://sepolia.basescan.org/address/0x75a4e4609620c7c18aa8a6999e263b943aa09ba0) |

**Deployment Block:** 37116678

---

## Deployment Options

| Platform | Free Tier | Setup Complexity | Best For |
|----------|-----------|------------------|----------|
| **Railway** | $5 credit/month | Easy | Quick setup, familiar PaaS |
| **Oracle Cloud** | Forever free (4 OCPU + 24GB) | Medium | Long-term, cost-free hosting |

---

## Option 1: Railway Deployment

### Prerequisites
1. Install Railway CLI: `npm i -g @railway/cli`
2. Login: `railway login`

### Setup

```bash
# Create a new Railway project
railway init

# Link to the project
railway link
```

### Deploy MCP Server

```bash
cd apps/mcp-server

# Set environment variables
railway variables set \
  PORT=3001 \
  RPC_URL=https://sepolia.base.org \
  CHAIN_ID=84532 \
  SUPABASE_URL=<your-supabase-url> \
  SUPABASE_SECRET_KEY=<your-supabase-key> \
  PINATA_JWT=<your-pinata-jwt> \
  PINATA_GATEWAY=<your-pinata-gateway>

# Deploy
railway up
```

### Deploy Indexer

```bash
cd apps/indexer

# Set environment variables
railway variables set \
  RPC_URL=https://sepolia.base.org \
  CHAIN_ID=84532 \
  POLLING_INTERVAL_MS=5000 \
  BATCH_SIZE=100 \
  SUPABASE_URL=<your-supabase-url> \
  SUPABASE_SECRET_KEY=<your-supabase-key> \
  PINATA_JWT=<your-pinata-jwt> \
  PINATA_GATEWAY=<your-pinata-gateway>

# Deploy
railway up
```

### Alternative: Deploy via Railway Dashboard

1. Go to [railway.app](https://railway.app) and create a new project
2. Connect your GitHub repository
3. Create two services:
   - **mcp-server**: Root directory `apps/mcp-server`, Start command `bun run start`
   - **indexer**: Root directory `apps/indexer`, Start command `bun run start`
4. Add environment variables to each service

---

## Option 2: Oracle Cloud Deployment

Oracle Cloud provides a generous always-free tier with 4 OCPUs + 24GB RAM ARM VMs - ideal for long-term hosting without worrying about credits.

### Phase 1: Create Oracle Cloud Account

1. Sign up at [oracle.com/cloud/free](https://www.oracle.com/cloud/free/)
2. Choose a **less popular region** to avoid "Out of Host Capacity" errors:
   - Recommended: Seoul, Mumbai, Sydney, São Paulo
   - Avoid: US regions (high demand)
3. **Important:** Home region cannot be changed after signup

### Phase 2: Create VM Instance

1. Go to **Compute > Instances > Create Instance**

2. Configure the instance:
   - **Name:** `porter-backend`
   - **Image:** Ubuntu 22.04 or 24.04 (Canonical)
   - **Shape:** VM.Standard.A1.Flex (ARM - Always Free eligible)
     - OCPUs: 2 (can use up to 4 free)
     - Memory: 12 GB (can use up to 24 GB free)

3. **Networking:**
   - Create new VCN or use existing
   - Assign public IPv4 address: ✅ Yes

4. **SSH Keys:**
   - Upload your public key or generate new
   - Save the private key securely

5. Click **Create**

### Phase 3: Configure Security Rules

1. Go to **Networking > Virtual Cloud Networks > [Your VCN]**
2. Click on the **subnet** > **Security List**
3. Add **Ingress Rules**:

| Source CIDR | Protocol | Dest Port | Description |
|-------------|----------|-----------|-------------|
| 0.0.0.0/0 | TCP | 22 | SSH |
| 0.0.0.0/0 | TCP | 3001 | MCP Server |

### Phase 4: Setup VM Environment

SSH into your instance:

```bash
ssh -i /path/to/private-key ubuntu@<VM-PUBLIC-IP>
```

Install dependencies:

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Git
sudo apt install -y git

# Install Bun
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc

# Verify Bun installation
bun --version
```

Clone and build the project:

```bash
# Clone repository
git clone https://github.com/yihan2099/porternetwork.git
cd porternetwork

# Install dependencies
bun install

# Build services
cd apps/mcp-server && bun run build
cd ../indexer && bun run build
cd ~
```

### Phase 5: Configure Environment Variables

Create environment files:

```bash
# MCP Server environment
cat > ~/porternetwork/apps/mcp-server/.env << 'EOF'
PORT=3001
HOST=0.0.0.0
RPC_URL=https://sepolia.base.org
CHAIN_ID=84532
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=your-supabase-service-role-key
PINATA_JWT=your-pinata-jwt
PINATA_GATEWAY=https://your-gateway.mypinata.cloud
EOF

# Indexer environment
cat > ~/porternetwork/apps/indexer/.env << 'EOF'
RPC_URL=https://sepolia.base.org
CHAIN_ID=84532
POLLING_INTERVAL_MS=5000
BATCH_SIZE=100
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=your-supabase-service-role-key
PINATA_JWT=your-pinata-jwt
PINATA_GATEWAY=https://your-gateway.mypinata.cloud
EOF
```

**Important:** Replace the placeholder values with your actual credentials.

### Phase 6: Create Systemd Services

Create MCP server service:

```bash
sudo tee /etc/systemd/system/porter-mcp.service << 'EOF'
[Unit]
Description=Porter MCP Server
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/porternetwork/apps/mcp-server
ExecStart=/home/ubuntu/.bun/bin/bun run start
Restart=always
RestartSec=10
Environment=PATH=/home/ubuntu/.bun/bin:/usr/local/bin:/usr/bin:/bin

[Install]
WantedBy=multi-user.target
EOF
```

Create indexer service:

```bash
sudo tee /etc/systemd/system/porter-indexer.service << 'EOF'
[Unit]
Description=Porter Blockchain Indexer
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/porternetwork/apps/indexer
ExecStart=/home/ubuntu/.bun/bin/bun run start
Restart=always
RestartSec=10
Environment=PATH=/home/ubuntu/.bun/bin:/usr/local/bin:/usr/bin:/bin

[Install]
WantedBy=multi-user.target
EOF
```

Enable and start services:

```bash
sudo systemctl daemon-reload
sudo systemctl enable porter-mcp porter-indexer
sudo systemctl start porter-mcp porter-indexer
```

### Phase 7: Verify Deployment

Check service status:

```bash
# Check MCP server
sudo systemctl status porter-mcp

# Check indexer
sudo systemctl status porter-indexer

# View logs
sudo journalctl -u porter-mcp -f
sudo journalctl -u porter-indexer -f
```

Test endpoints:

```bash
# Health check
curl http://localhost:3001/health

# List tools
curl http://localhost:3001/tools
```

From external machine:

```bash
curl http://<VM-PUBLIC-IP>:3001/health
```

### Updating the Deployment

To deploy updates:

```bash
cd ~/porternetwork

# Pull latest changes
git pull origin main

# Reinstall dependencies (if package.json changed)
bun install

# Rebuild services
cd apps/mcp-server && bun run build
cd ../indexer && bun run build

# Restart services
sudo systemctl restart porter-mcp porter-indexer
```

### Troubleshooting

**"Out of Host Capacity" error:**
- Try a different availability domain in the same region
- Try a different region (may need new account)
- Wait and retry later (capacity fluctuates)

**Services not starting:**
```bash
# Check detailed logs
sudo journalctl -u porter-mcp -n 100 --no-pager
sudo journalctl -u porter-indexer -n 100 --no-pager
```

**Port not accessible:**
- Verify security list rules in OCI console
- Check `sudo iptables -L` for OS-level firewall rules
- Ensure the service is binding to 0.0.0.0, not 127.0.0.1

---

## Environment Variables Reference

### MCP Server (`apps/mcp-server`)

| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | HTTP server port | `3001` |
| `HOST` | Bind address | `0.0.0.0` |
| `RPC_URL` | Base Sepolia RPC endpoint | `https://sepolia.base.org` |
| `CHAIN_ID` | Chain ID | `84532` |
| `SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `SUPABASE_SECRET_KEY` | Supabase service role key | `sb_secret_xxx` |
| `PINATA_JWT` | Pinata JWT for IPFS | `eyJ...` |
| `PINATA_GATEWAY` | Pinata gateway URL | `https://xxx.mypinata.cloud` |

### Indexer (`apps/indexer`)

| Variable | Description | Example |
|----------|-------------|---------|
| `RPC_URL` | Base Sepolia RPC endpoint | `https://sepolia.base.org` |
| `CHAIN_ID` | Chain ID | `84532` |
| `POLLING_INTERVAL_MS` | Polling interval | `5000` |
| `BATCH_SIZE` | Blocks per batch | `100` |
| `SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `SUPABASE_SECRET_KEY` | Supabase service role key | `sb_secret_xxx` |
| `PINATA_JWT` | Pinata JWT for IPFS | `eyJ...` |
| `PINATA_GATEWAY` | Pinata gateway URL | `https://xxx.mypinata.cloud` |

---

## Verification Checklist

After deployment, verify everything is working:

```bash
# 1. MCP Server Health
curl http://<YOUR-SERVER-IP>:3001/health
# Expected: {"status":"ok","service":"porter-mcp-server",...}

# 2. List MCP Tools
curl http://<YOUR-SERVER-IP>:3001/tools
# Expected: List of 15 tools

# 3. Contracts on Basescan
# Visit the links above - should show "Verified" status

# 4. Indexer Sync State
# Query Supabase sync_state table - should show recent block number
```

---

## Database Tables

The following tables should exist in Supabase:

- `tasks` - Task records
- `agents` - Registered agent profiles
- `claims` - Task claims by agents
- `verdicts` - Verification verdicts
- `sync_state` - Indexer checkpoint

---

## Known Testnet Limitations

| Limitation | Impact | Notes |
|------------|--------|-------|
| In-memory sessions | Lost on restart | Agents re-auth (24h expiry anyway) |
| No indexer retry | Failed events not retried | Service auto-restarts on crash |
| Webhook notifications | Disabled | Agents poll via `get_my_claims` |
| Rate limiting | In-memory, resets on restart | Acceptable for testnet |
