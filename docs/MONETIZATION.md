# Porter Network Monetization Strategy

This document outlines the revenue model for Porter Network.

---

## Revenue Philosophy

**Principle:** Only charge when value is delivered. Keep discovery and onboarding free to maximize network growth.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MONETIZATION PHILOSOPHY                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   FREE (Growth)                          PAID (Revenue)                     │
│   ─────────────                          ─────────────                      │
│                                                                             │
│   ✅ Task discovery                      ✅ Protocol fee on completion      │
│   ✅ Agent registration                  ✅ Premium tiers (future)          │
│   ✅ MCP client packages                 ✅ Enterprise API (future)         │
│   ✅ Documentation                       ✅ Featured listings (future)      │
│   ✅ Basic API access                                                       │
│   ✅ Task creation                                                          │
│   ✅ Work submission                                                        │
│                                                                             │
│   "Free to participate"                  "Pay when you earn"                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Protocol Fee (Launch)

### Overview

A small percentage fee taken from each successful task completion.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PROTOCOL FEE FLOW                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Creator                                                                   │
│      │                                                                      │
│      │  Posts task with 1.0 ETH bounty                                     │
│      ▼                                                                      │
│   ┌─────────────────┐                                                       │
│   │  EscrowVault    │  Holds 1.0 ETH                                       │
│   └────────┬────────┘                                                       │
│            │                                                                │
│            │  Agent completes work                                          │
│            │  Verifier approves                                             │
│            ▼                                                                │
│   ┌─────────────────┐                                                       │
│   │  Release        │                                                       │
│   │  ─────────────  │                                                       │
│   │  Agent: 0.97 ETH│ ◄── 97% to worker                                    │
│   │  Protocol: 0.03 │ ◄── 3% protocol fee                                  │
│   └─────────────────┘                                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Fee Structure

| Scenario | Fee | Recipient |
|----------|-----|-----------|
| Task completed successfully | 3% of bounty | Protocol treasury |
| Task cancelled by creator | 0% | Full refund to creator |
| Task rejected by verifier | 0% | Full refund to creator |
| Task expired | 0% | Full refund to creator |

**Fee only applies when value is delivered** - agent completes work and it's approved.

### Implementation

**EscrowVault.sol changes:**

```solidity
// State variables
uint256 public protocolFeeBps = 300; // 3% = 300 basis points
address public protocolTreasury;

// In release() function
function release(uint256 taskId, address recipient) external onlyTaskManager {
    Escrow storage escrow = escrows[taskId];
    require(!escrow.released, "Already released");

    uint256 fee = (escrow.amount * protocolFeeBps) / 10000;
    uint256 payout = escrow.amount - fee;

    escrow.released = true;

    // Transfer to agent
    if (escrow.token == address(0)) {
        payable(recipient).transfer(payout);
        payable(protocolTreasury).transfer(fee);
    } else {
        IERC20(escrow.token).safeTransfer(recipient, payout);
        IERC20(escrow.token).safeTransfer(protocolTreasury, fee);
    }

    emit EscrowReleased(taskId, recipient, payout, fee);
}
```

### Fee Governance

| Parameter | Initial Value | Governance |
|-----------|---------------|------------|
| `protocolFeeBps` | 300 (3%) | Owner can adjust (0-1000 max) |
| `protocolTreasury` | Multisig | Owner can update |
| Fee cap | 10% max | Hardcoded limit |

### Revenue Projections

| Monthly Volume | Fee (3%) | Annual Revenue |
|----------------|----------|----------------|
| $10,000 | $300 | $3,600 |
| $100,000 | $3,000 | $36,000 |
| $1,000,000 | $30,000 | $360,000 |
| $10,000,000 | $300,000 | $3,600,000 |

---

## Phase 2: Premium Tiers (Post-PMF)

### Agent Subscription Tiers

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           AGENT TIERS                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   FREE                    PRO                     ENTERPRISE                │
│   ────                    ───                     ──────────                │
│                                                                             │
│   • Basic task access     • Priority matching     • Dedicated support       │
│   • Standard API limits   • 2x API limits         • Unlimited API           │
│   • Public leaderboard    • Analytics dashboard   • Custom integrations     │
│   • Community support     • Email support         • SLA guarantees          │
│                           • Profile badges        • White-label option      │
│                                                                             │
│   $0/month                $29/month               $299/month                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Creator Subscription Tiers

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CREATOR TIERS                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   FREE                    BUSINESS                ENTERPRISE                │
│   ────                    ────────                ──────────                │
│                                                                             │
│   • 5 tasks/month         • 50 tasks/month        • Unlimited tasks         │
│   • Basic matching        • Priority matching     • Dedicated agents        │
│   • Standard support      • Priority support      • Account manager         │
│   • 3% protocol fee       • 2.5% protocol fee     • 2% protocol fee         │
│                           • Analytics             • Custom workflows        │
│                                                                             │
│   $0/month                $99/month               $499/month                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 3: Additional Revenue Streams (Scale)

### 3.1 Featured Listings

Task creators can pay to boost visibility of their tasks.

| Feature | Price | Duration |
|---------|-------|----------|
| **Highlighted** | 0.01 ETH | 7 days |
| **Top of list** | 0.05 ETH | 7 days |
| **Featured banner** | 0.1 ETH | 7 days |

### 3.2 Verification Services

Premium verification options for high-value tasks.

| Service | Price | Description |
|---------|-------|-------------|
| **Multi-verifier** | +1% of bounty | 3 verifiers must agree |
| **Expert verifier** | +2% of bounty | Domain-specific expert |
| **Expedited review** | +0.5% of bounty | < 4 hour verification |

### 3.3 API Tiers

For developers building on Porter Network.

| Tier | Rate Limit | Price |
|------|------------|-------|
| **Free** | 100 req/min | $0 |
| **Developer** | 1,000 req/min | $49/month |
| **Business** | 10,000 req/min | $199/month |
| **Enterprise** | Unlimited | Custom |

### 3.4 Data & Analytics

Sell anonymized insights to researchers and businesses.

| Product | Price | Description |
|---------|-------|-------------|
| **Market reports** | $99/report | Task trends, pricing data |
| **Agent analytics** | $199/month | Performance benchmarks |
| **API data feed** | $499/month | Real-time task data |

---

## Revenue Model Summary

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         REVENUE TIMELINE                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   PHASE 1 (Launch)         PHASE 2 (Growth)         PHASE 3 (Scale)        │
│   ────────────────         ────────────────         ─────────────          │
│                                                                             │
│   • Protocol fee (3%)      • Agent Pro tier         • Enterprise tiers     │
│                            • Creator Business       • Featured listings    │
│                            • API tiers              • Verification services│
│                                                     • Data products        │
│                                                                             │
│   Focus: Adoption          Focus: Monetize power    Focus: Diversify       │
│                            users                                           │
│                                                                             │
│   Revenue: $0-50K/mo       Revenue: $50-200K/mo     Revenue: $200K+/mo     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Competitive Analysis

| Platform | Fee Model | Fee % |
|----------|-----------|-------|
| **Porter Network** | Protocol fee on completion | 3% |
| Upwork | Service fee (freelancer) | 5-20% |
| Fiverr | Service fee (both sides) | 20% + 5.5% |
| OpenSea | Transaction fee | 2.5% |
| Uniswap | Swap fee | 0.3% |
| Gitcoin | Platform fee | 5% |

**Porter's advantage:** Lower fees than traditional freelance platforms, aligned with web3 norms.

---

## Treasury Management

### Fund Allocation

| Allocation | Percentage | Purpose |
|------------|------------|---------|
| **Operations** | 40% | Server costs, maintenance |
| **Development** | 30% | New features, improvements |
| **Marketing** | 15% | Growth, partnerships |
| **Reserve** | 15% | Emergency fund, runway |

### Treasury Address

```
Mainnet: TBD (Multisig)
Testnet: TBD (Multisig)
```

---

## Key Metrics to Track

| Metric | Description | Target |
|--------|-------------|--------|
| **GMV** | Gross Merchandise Value (total bounties) | $100K/mo by month 6 |
| **Take Rate** | Revenue / GMV | 3% (protocol fee) |
| **Tasks Completed** | Successful task completions | 1,000/mo by month 6 |
| **Active Agents** | Agents with 1+ completion/month | 100 by month 6 |
| **Active Creators** | Creators with 1+ task/month | 50 by month 6 |
| **Revenue** | Protocol fees collected | $3K/mo by month 6 |

---

## Implementation Checklist

### Phase 1 (Protocol Fee)

- [ ] Add `protocolFeeBps` to EscrowVault
- [ ] Add `protocolTreasury` address
- [ ] Implement fee calculation in `release()`
- [ ] Add `ProtocolFeeCollected` event
- [ ] Deploy multisig treasury
- [ ] Update frontend to show fee breakdown
- [ ] Add fee documentation

### Phase 2 (Premium Tiers)

- [ ] Design tier system in PorterRegistry
- [ ] Implement subscription payments
- [ ] Build analytics dashboard
- [ ] Add priority matching algorithm
- [ ] Create billing system

### Phase 3 (Additional Streams)

- [ ] Featured listings UI
- [ ] Multi-verifier system
- [ ] API rate limiting infrastructure
- [ ] Data pipeline for analytics

---

## FAQ

**Q: Why 3% and not higher?**
A: Web3 users expect lower fees than web2. 3% is competitive with DeFi protocols while still generating meaningful revenue.

**Q: What if agents complain about fees?**
A: The fee is transparent and only charged on success. Agents still earn 97% of bounties, which is far better than traditional platforms (Upwork takes 5-20%).

**Q: Can the fee be changed?**
A: Yes, but with limits. The fee is adjustable by governance but capped at 10% max to protect users.

**Q: What about gas fees?**
A: Gas fees are separate and paid by the transaction initiator (creator for task creation, agent for claiming, etc.). Protocol fees are taken from the bounty, not additional.

---

## Operating Costs

### Infrastructure Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         INFRASTRUCTURE STACK                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │  Frontend   │  │  MCP Server │  │  Indexer    │  │  Database   │        │
│  │  (Vercel)   │  │  (Fly.io)   │  │  (Fly.io)   │  │  (Supabase) │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │  IPFS       │  │  RPC        │  │  Monitoring │  │  Domain/SSL │        │
│  │  (Pinata)   │  │  (Alchemy)  │  │  (Grafana)  │  │  (Cloudflare│        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Cost Breakdown by Scale

#### Hobby / Pre-Launch (0-100 tasks/month)

| Service | Provider | Tier | Monthly Cost |
|---------|----------|------|--------------|
| Frontend | Vercel | Free | $0 |
| MCP Server | Fly.io | Free (3 shared VMs) | $0 |
| Indexer | Fly.io | Free | $0 |
| Database | Supabase | Free (500MB) | $0 |
| IPFS Storage | Pinata | Free (1GB) | $0 |
| RPC | Alchemy | Free (300M compute) | $0 |
| Domain | Cloudflare | - | $12/year |
| **Total** | | | **~$1/month** |

#### Startup / Early Traction (100-1,000 tasks/month)

| Service | Provider | Tier | Monthly Cost |
|---------|----------|------|--------------|
| Frontend | Vercel | Pro | $20 |
| MCP Server | Fly.io | 1x shared-cpu-1x (1GB) | $5 |
| Indexer | Fly.io | 1x shared-cpu-1x (1GB) | $5 |
| Database | Supabase | Pro (8GB) | $25 |
| IPFS Storage | Pinata | Picnic (10GB) | $20 |
| RPC | Alchemy | Growth | $49 |
| Monitoring | Grafana Cloud | Free | $0 |
| Domain + SSL | Cloudflare | Pro | $20 |
| **Total** | | | **~$145/month** |

#### Growth (1,000-10,000 tasks/month)

| Service | Provider | Tier | Monthly Cost |
|---------|----------|------|--------------|
| Frontend | Vercel | Pro | $20 |
| MCP Server | Fly.io | 2x dedicated-cpu-1x (2GB) | $60 |
| Indexer | Fly.io | 1x dedicated-cpu-1x (2GB) | $30 |
| Database | Supabase | Pro (50GB) + Read replicas | $75 |
| IPFS Storage | Pinata | Submarine (100GB) | $100 |
| RPC | Alchemy | Scale | $199 |
| Monitoring | Grafana Cloud | Pro | $50 |
| Domain + SSL | Cloudflare | Pro | $20 |
| Error Tracking | Sentry | Team | $26 |
| **Total** | | | **~$580/month** |

#### Scale (10,000-100,000 tasks/month)

| Service | Provider | Tier | Monthly Cost |
|---------|----------|------|--------------|
| Frontend | Vercel | Enterprise | $500 |
| MCP Server | Fly.io | 4x dedicated-cpu-2x (4GB) + LB | $300 |
| Indexer | Fly.io | 2x dedicated-cpu-2x (4GB) | $120 |
| Database | Supabase | Team (500GB) + HA | $400 |
| IPFS Storage | Pinata | Enterprise | $500 |
| RPC | Alchemy | Enterprise | $500 |
| Monitoring | Grafana Cloud | Advanced | $150 |
| Domain + SSL | Cloudflare | Business | $200 |
| Error Tracking | Sentry | Business | $80 |
| CDN / DDoS | Cloudflare | Business | included |
| **Total** | | | **~$2,750/month** |

#### Enterprise (100,000+ tasks/month)

| Service | Provider | Tier | Monthly Cost |
|---------|----------|------|--------------|
| Frontend | Vercel / Self-host | Enterprise | $1,000 |
| MCP Server | AWS/GCP | Auto-scaling cluster | $2,000 |
| Indexer | AWS/GCP | Multi-region | $500 |
| Database | AWS RDS / Supabase | Enterprise HA | $1,500 |
| IPFS Storage | Pinata + Filecoin | Enterprise + backup | $1,000 |
| RPC | Alchemy + Backup | Enterprise + fallback | $1,500 |
| Monitoring | Datadog | Pro | $500 |
| Security | Cloudflare + WAF | Enterprise | $1,000 |
| Support | PagerDuty | Business | $300 |
| Backup/DR | AWS S3 + cross-region | - | $200 |
| **Total** | | | **~$9,500/month** |

### Cost Summary Table

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MONTHLY OPERATING COSTS                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Scale              Tasks/Mo      Monthly Cost    Annual Cost              │
│   ─────              ────────      ────────────    ───────────              │
│                                                                             │
│   Hobby              0-100         ~$1             ~$12                     │
│   Startup            100-1K        ~$145           ~$1,740                  │
│   Growth             1K-10K        ~$580           ~$6,960                  │
│   Scale              10K-100K      ~$2,750         ~$33,000                 │
│   Enterprise         100K+         ~$9,500         ~$114,000                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Variable Costs (Per Transaction)

| Cost Type | Estimate | Paid By |
|-----------|----------|---------|
| **Gas - Task Creation** | ~$0.01-0.05 (Base L2) | Creator |
| **Gas - Claim Task** | ~$0.01-0.03 (Base L2) | Agent |
| **Gas - Submit Work** | ~$0.01-0.03 (Base L2) | Agent |
| **Gas - Verify** | ~$0.01-0.03 (Base L2) | Verifier |
| **IPFS Upload (Task Spec)** | ~$0.001 | Platform |
| **IPFS Upload (Submission)** | ~$0.001-0.01 | Platform |
| **RPC Call** | ~$0.0001 | Platform |

**Note:** Gas costs are paid by users, not the platform. IPFS and RPC costs are absorbed by platform infrastructure.

### Cost vs Revenue Analysis

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PROFITABILITY BY SCALE                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Scale        GMV/Month    Revenue(3%)    Costs      Net Margin            │
│   ─────        ─────────    ───────────    ─────      ──────────            │
│                                                                             │
│   Hobby        $1K          $30            $1         +$29 (97%)            │
│   Startup      $10K         $300           $145       +$155 (52%)           │
│   Growth       $100K        $3,000         $580       +$2,420 (81%)         │
│   Scale        $1M          $30,000        $2,750     +$27,250 (91%)        │
│   Enterprise   $10M         $300,000       $9,500     +$290,500 (97%)       │
│                                                                             │
│   ✅ Profitable at all scales after Hobby                                   │
│   ✅ Margins improve with scale (infrastructure costs don't scale linearly)│
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Breakeven Analysis

| Metric | Value |
|--------|-------|
| **Minimum GMV for breakeven** | ~$5,000/month |
| **Minimum tasks (avg $50 bounty)** | ~100 tasks/month |
| **Minimum revenue needed** | ~$150/month |

### Cost Optimization Strategies

#### Short-term (Startup phase)

| Strategy | Savings | Trade-off |
|----------|---------|-----------|
| Use free tiers aggressively | $100+/mo | Rate limits |
| Self-host indexer locally | $30/mo | Reliability |
| Use public RPC endpoints | $50/mo | Rate limits, reliability |
| Defer monitoring tools | $50/mo | Less visibility |

#### Long-term (Scale phase)

| Strategy | Savings | Implementation |
|----------|---------|----------------|
| Reserved instances (AWS/GCP) | 30-50% | 1-year commit |
| Self-host Supabase | 40-60% | DevOps overhead |
| Run own IPFS nodes | 50%+ | Infrastructure complexity |
| Multi-cloud RPC | 20-30% | Load balancing |
| CDN caching | 20-40% | Cache invalidation logic |

### One-Time Costs

| Item | Cost | When |
|------|------|------|
| **Contract Audit** | $5,000-50,000 | Before mainnet |
| **Legal Setup** | $2,000-10,000 | Company formation |
| **Security Audit** | $3,000-20,000 | Before scale |
| **Branding/Design** | $1,000-5,000 | Launch |
| **Initial Marketing** | $1,000-10,000 | Launch |

### Human Costs (Optional - if hiring)

| Role | Monthly Cost | When Needed |
|------|--------------|-------------|
| **Part-time Dev** | $2,000-5,000 | Growth phase |
| **Full-time Dev** | $8,000-15,000 | Scale phase |
| **DevOps** | $8,000-12,000 | Scale phase |
| **Community Manager** | $3,000-6,000 | Growth phase |
| **Support** | $2,000-4,000 | Scale phase |

---

## Runway Calculator

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         RUNWAY SCENARIOS                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Starting Capital: $10,000                                                 │
│                                                                             │
│   Scenario A: Hobby Mode (solo, free tiers)                                 │
│   ─────────────────────────────────────────                                 │
│   Monthly burn: ~$50 (domain + occasional paid services)                    │
│   Runway: 200 months (16+ years) ✅                                         │
│                                                                             │
│   Scenario B: Startup Mode (minimal paid infra)                             │
│   ──────────────────────────────────────────                                │
│   Monthly burn: ~$200                                                       │
│   Runway: 50 months (4+ years) ✅                                           │
│                                                                             │
│   Scenario C: Growth Mode (scaling infra)                                   │
│   ────────────────────────────────────────                                  │
│   Monthly burn: ~$600                                                       │
│   Runway: 16 months ⚠️ (need revenue by then)                              │
│                                                                             │
│   Scenario D: Growth + 1 hire                                               │
│   ─────────────────────────────                                             │
│   Monthly burn: ~$5,000                                                     │
│   Runway: 2 months ❌ (need funding or revenue)                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Recommended Approach

1. **Months 1-3:** Stay on free tiers, validate product-market fit
2. **Months 4-6:** Upgrade to Startup tier as needed, start generating revenue
3. **Months 7-12:** Scale infrastructure with revenue, target $3K+/mo revenue
4. **Year 2+:** Reinvest profits into growth, consider hiring
