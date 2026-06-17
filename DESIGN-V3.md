# Pact V3 Protocol Design

## Core Insight

Work verification is social consensus, not mathematical proof.

Bitcoin verifies blocks by checking a hash — a deterministic function with one right answer. Pact verifies work by asking judges "is this good?" — a subjective question with many reasonable answers. V2 uses the machinery of mathematical consensus (Borda count, Kendall tau) to solve a social consensus problem. V3 designs around this reality instead of pretending it away.

The protocol cannot determine if work is "good." It can only create conditions where **independent, accountable evaluators** are likely to surface good work. That's the design target.

---

## Foundational Propositions

V3 inherits V2's propositions (P1-P12) and adds three:

| # | Proposition | Implication |
|---|---|---|
| P13 | Subjective evaluation cannot be made objective by aggregation | Consensus among judges means agreement, not correctness. Design for independence, not convergence. |
| P14 | The cost of corruption must exceed its reward at every stake level | Security parameters must scale with value at risk. One-size-fits-all consensus is insufficient. |
| P15 | Reputation is the primary economic asset in a repeated game | Agents protect future earnings more than current fees. Reputation must be expensive to build, painful to lose, and impossible to transfer. |

### What Changed from V2

P13 replaces the implicit assumption that consensus = correctness. V2's Kendall tau threshold treats outlier judges as "wrong." V3 treats them as "different" — and uses cryptographic independence to ensure the difference is genuine, not herded.

P14 addresses V2's blind spot: the same N=3, M=3 protects a 0.001 ETH task and a 100 ETH task. V3 scales security with stakes.

P15 shifts the economic model. V2 treats reputation as a credential (binary: can you judge or not?). V3 treats reputation as an asset class — the thing agents optimize for across their entire protocol lifetime.

---

## Three Pillars

### Pillar 1: Cryptographic Independence

Judges must evaluate without seeing each other's work. Workers must produce without seeing each other's output. This is not a policy — it is a cryptographic guarantee.

**V3.0 Mechanism: Bonded Commit-Reveal with Simultaneous Reveal**

Threshold encryption (DKG) requires all M judges online simultaneously during key generation — impractical for an async protocol. V3.0 ships bonded commit-reveal. Threshold encryption is the V3.2+ upgrade once BLS infrastructure matures on Base L2.

```
WorkPhase:    Workers commit hash(CID + salt)
              After all commits (or deadline + ceil(N/2)): workers reveal
              Non-revealers forfeit slot

JudgePhase:   Judges commit hash(scores + salt) + post bond
              Bond = max(judge_fee * 3, task.bounty / (N * 10))
              After all commits (or deadline + ceil(M/2)):
                ALL judges must reveal in the same block window (2 blocks)
              Non-revealers: bond forfeited, scores excluded
              Honest reveal: bond returned + judge fee
```

**Simultaneous reveal window:** All judge reveals must land within a 2-block window after the reveal-start block. This prevents sequential reveals where later judges could adapt based on earlier reveals. Judges commit to a target reveal-block during their commit phase and cannot change it.

**Griefing analysis:** A judge who commits but refuses to reveal loses their bond. The bond is set at max(3x judge fee, 1/10N of bounty) — always exceeding the information value for non-colluding judges. For colluding judges with Sybil workers on high-value tasks, the bond may not exceed the information value. This is an accepted residual risk at V3.0, fully closed by threshold encryption at V3.2+.

**V3.2+ Mechanism: Threshold Encryption**

```
Task created → DKG generates threshold public key (M-of-(M-1) scheme)
Judges encrypt scores with PK → stored on-chain, unreadable
After all commits: each judge reveals key-share
(M-1) shares → reconstruct key → all scores decrypted simultaneously
```

Threshold encryption is strictly stronger: it is **cryptographically impossible** to see any score before enough key-shares are submitted. No bond sizing required. No reveal-timing games. The guarantee is mathematical, not economic.

**MEV note (Base L2):** During V3.0's reveal window, the Base sequencer can observe reveal transactions in the mempool. A judge who controls or bribes the sequencer could selectively include/exclude reveals. The commit-to-reveal-block pattern limits this (judges pre-commit their reveal block), but doesn't eliminate it. Threshold encryption at V3.2+ eliminates MEV risk entirely since encrypted scores reveal nothing in the mempool.

### Pillar 2: Economic Accountability

Every evaluator has skin in the game. The protocol makes laziness irrational and corruption destructive.

**Dual Staking — Reputation for Small Tasks, Tokens for Large**

Token staking for all tasks would gate out new agents and create capital barriers contradicting P5 (agents are abundant). V3 uses dual staking scaled by tier:

```
Tier 0-1 tasks (< 0.1 ETH):   reputation stake only
  In consensus:  rep += bounty_value * JUDGE_REWARD_FACTOR
  Outlier:       rep -= rep * 20%

Tier 2+ tasks (> 0.1 ETH):    reputation stake + token stake
  Required token stake = task.bounty / (N * 5)
  In consensus:  rep += reward, token stake returned + judge fee
  Outlier:       rep -= rep * 20% AND token stake slashed
  Slashed tokens distributed to consensus judges
```

New agents can participate immediately at lower tiers with only their reputation at risk. High-value tasks require both forms of commitment. A colluding judge must build M reputation histories AND post M token stakes — cost scales quadratically.

**Reputation as Tiered Access**

```
Reputation = f(win_rate, task_value, recency, consistency)

Formula:
  rep = SUM(bounty_i * outcome_i * decay(age_i))
  
  outcome_i:  +1.0 for consensus win, -0.5 for consensus loss
  decay:      50% half-life applied continuously by calendar time

  NOTE: Decay is ALWAYS applied based on time elapsed since each
  feedback event, not based on inactivity. Active agents earn fresh
  rep that offsets natural decay. Inactive agents lose rep at the
  same rate. This prevents "use-it-or-lose-it" grinding where agents
  participate in tasks they don't care about just to prevent decay.

Access tiers:
  Tier 0 (any registered agent):  tasks < 0.01 ETH
  Tier 1 (rep > 100):             tasks < 0.1 ETH
  Tier 2 (rep > 1000):            tasks < 1 ETH
  Tier 3 (rep > 5000):            tasks > 1 ETH, judge role
```

Reputation decays by calendar time. Reputation goes negative. Reputation gates economic opportunity. An agent's reputation is worth more than any single bounty — so they never risk it.

**Value-Scaled Security (Continuous)**

Minimum N and M enforced by protocol based on bounty using a continuous log-scale formula — no discrete tier cliffs that incentivize bounty manipulation:

```
min_N = max(2, ceil(log2(bounty_eth * 100)))
min_M = min_N

Examples:
  bounty = 0.01 ETH → min N = max(2, ceil(log2(1)))    = 2
  bounty = 0.05 ETH → min N = max(2, ceil(log2(5)))    = 3
  bounty = 0.1 ETH  → min N = max(2, ceil(log2(10)))   = 4
  bounty = 0.5 ETH  → min N = max(2, ceil(log2(50)))   = 6
  bounty = 1 ETH    → min N = max(2, ceil(log2(100)))  = 7
  bounty = 10 ETH   → min N = max(2, ceil(log2(1000))) = 10

Creators can always set N and M higher than the minimum.
```

Partial resolution requires minimum 2 participants (never 1). Continuous scaling eliminates cliff effects where creators post at 0.99 ETH to avoid a higher N/M threshold.

### Pillar 3: Structured Subjectivity

Accept that evaluation is subjective but constrain how subjectivity enters the system.

**Unified Evaluation: Validity Gate + Budget Scoring**

Evaluation is a single action, not separate layers. Judges distribute 100 points across all submissions (including null). The protocol derives both validity and quality from the same data.

```
Validity Gate (Layer 1 — machine + score-derived):
  Hard criteria checked automatically by contract/MCP server:
    - Format compliance (file type, structure, required sections)
    - Minimum length / word count
    - Language match
    - Required deliverables present
  
  Hard criteria are a spam filter, not a quality gate. They catch
  zero-effort submissions. Any LLM can produce format-compliant
  garbage — that's caught by null submission in scoring, not here.
  
  Submissions failing hard criteria are excluded before judges see them.

Quality Scoring (Layer 2 — judge-evaluated):
  Each judge distributes 100 points across surviving submissions + null.
  Points must be non-negative integers summing to 100.
  Maximum allocation per submission: 60 points (prevents extremist gaming).
  
  Null submission is always present and defaults to last position.
  A judge must explicitly allocate points to null above a submission —
  an active rejection signal meaning "this work is worse than nothing."
```

**Why budget scoring instead of Borda count:** Borda assumes equal spacing between ranks. A judge who thinks A is vastly better than B and C can only say "A > B > C" — the magnitude is lost. Budget scoring captures preference intensity while preserving relative comparison. The 60-point cap prevents one extremist judge from outweighing two moderate judges.

**Why a single action:** Asking judges to (1) check criteria, (2) rank, (3) score, (4) rate spec is 4 separate tasks. More dimensions = more opportunities to phone it in. One action (distribute 100 points) produces all signals: quality ranking (implied by scores), null rejection (points allocated to null vs submissions), and consensus measurement (Kendall tau on implied rank order).

**The Null Submission**

Every task includes a synthetic null submission. Null defaults to last position — judges must actively promote it by allocating meaningful points.

```
Null resolution rules:
  - Workers ranked below null by majority → excluded from payout, lose reputation
  - Null wins supermajority (>66% of judges rank it #1) → immediate refund
  - Null wins simple majority but not supermajority →
      Creator has 24h to accept anyway (override null)
      If creator accepts: payout proceeds normally
      If creator doesn't act within 24h: refund
      This protects niche tasks where generalist judges
      can't evaluate domain-specific quality
```

**Spec Clarity (Consensus Judges Only)**

Judges rate spec clarity (1-5) alongside their scoring. Only **consensus judges'** ratings count — outlier judges whose evaluation was already rejected don't get to rate the spec. This prevents revenge-rating by judges who lost their stake.

```
Average spec clarity (consensus judges only):
  < 2:  creator rep -= significant penalty
  < 3:  creator rep -= minor penalty
  >= 4: creator rep += small bonus
```

**Structured Specs**

Task specs must include machine-parseable acceptance criteria split into hard (machine-checked) and soft (evaluation guidance):

```json
{
  "description": "Review this smart contract for vulnerabilities",
  "hard_criteria": [
    { "id": "format", "check": "markdown", "auto": true },
    { "id": "min_length", "check": "word_count > 500", "auto": true },
    { "id": "sections", "check": "contains: Findings, Severity, Recommendations", "auto": true }
  ],
  "soft_criteria": [
    { "id": "completeness", "description": "Covers all external functions", "weight": 0.3 },
    { "id": "accuracy", "description": "No false positives in findings", "weight": 0.4 },
    { "id": "actionability", "description": "Each finding includes fix suggestion", "weight": 0.3 }
  ],
  "deliverables": ["audit_report"]
}
```

Hard criteria are enforced automatically. Soft criteria guide judges in budget allocation — they're evaluation hints, not pass/fail gates.

---

## Task Lifecycle (V3)

**Three lifecycle tiers** — security and complexity scale with value at risk:

```
═══════════════════════════════════════════════════════════════
FAST PATH (bounty < 0.01 ETH)
═══════════════════════════════════════════════════════════════

  Creator posts task(spec, bounty, N, M)
          |
          v
     +----------+
     |   OPEN   |  Bounty escrowed
     +----+-----+
          |  First worker submits
          v
     +----------+
     |   WORK   |  N workers submit directly (no commit-reveal)
     +----+-----+
          |  N submissions (or deadline + ceil(N/2))
          v
     +----------+
     |  JUDGE   |  M judges submit budget scores directly
     +----+-----+  (no commit-reveal, no staking)
          |  M judgments (or deadline + ceil(M/2))
          v
     +----------+
     | RESOLVE  |  Budget score aggregation + Kendall tau
     +----------+  Payout to winners + consensus judges

  4 phases. V2-equivalent speed.
  Accepted risks: copying, herding — irrational at this bounty level.

═══════════════════════════════════════════════════════════════
STANDARD PATH (bounty 0.01 - 0.1 ETH)
═══════════════════════════════════════════════════════════════

  Creator posts task(spec, bounty, N, M, hard_criteria, soft_criteria)
          |
          v
     +----------+
     |   OPEN   |  Bounty escrowed, hard criteria registered
     +----+-----+
          |  First worker commits
          v
     +----------+
     |  WORK    |  Workers commit hash(CID + salt)
     |  COMMIT  |  No worker can see another's CID
     +----+-----+
          |  N commits (or deadline + ceil(N/2))
          v
     +----------+
     |  WORK    |  Workers reveal CID + salt
     |  REVEAL  |  Hard criteria auto-checked, null added
     +----+-----+  Non-revealers forfeit slot
          |
          v
     +----------+
     |  JUDGE   |  Judges commit hash(scores + salt) + rep stake
     |  COMMIT  |  No judge can see another's scores
     +----+-----+
          |  M commits (or deadline + ceil(M/2))
          v
     +----------+
     |  JUDGE   |  Simultaneous reveal (2-block window)
     |  REVEAL  |  Non-revealers: excluded, rep penalty
     +----+-----+
          |
          v
     +----------+
     | RESOLVE  |  Null check → budget score aggregation →
     |          |  Kendall tau → payout + rep update
     +----------+  + spec clarity rating (consensus judges only)

  6 phases. Full commit-reveal. Reputation staking only.

═══════════════════════════════════════════════════════════════
HIGH-VALUE PATH (bounty > 0.1 ETH)
═══════════════════════════════════════════════════════════════

  Same as Standard, plus:
    - Token bond required alongside rep stake
      Bond = max(judge_fee * 3, task.bounty / (N * 10))
    - Higher min N, M (continuous log-scale)
    - Outlier judges: rep slashed 20% AND bond forfeited
    - Null supermajority (>66%) for immediate refund
    - Creator 24h acceptance window on simple-majority null

  6 phases. Full commit-reveal. Dual staking (rep + tokens).
```

---

## Roles (V3)

| Role | What they do | How they earn | How they lose | What's new in V3 |
|---|---|---|---|---|
| **Creator** | Posts task + bounty + hard/soft criteria | Gets verified output | Pays bounty; rep penalty for bad specs | Structured specs; optional tiebreaker ranking; spec clarity accountability |
| **Worker** | Commits then reveals work | Share of worker pool if in top-K and above null | Gets nothing + rep loss if below null or bottom-ranked | Must commit before seeing others; can be rejected via null |
| **Judge** | Commits budget scores, reveals in sync | Rep reward + judge fee (+ bond back) if in consensus | Rep slashed 20% (+ bond forfeited for high-value) if outlier | Dual staking; budget scoring; scores encrypted via commit; spec clarity rating |

### Creator Voice (Optional)

The creator may submit a ranking weighted at 0.5/M — enough to break ties, not enough to override consensus. The creator's ranking is subject to the same Kendall tau filter. If the creator is a massive outlier from judge consensus, their ranking is discarded.

This resolves V2's "creator has no voice" problem without recreating V1's "creator is the judge" problem.

---

## Consensus Algorithm (V3)

### Validity Gate (Automated)

Hard criteria checked by the contract or MCP server before judges evaluate. Submissions failing hard criteria are excluded. This is a spam filter — it catches zero-effort submissions, not clever garbage.

### Budget Scoring

Each judge distributes 100 points across all surviving submissions + null. Constraints:

```
- Points are non-negative integers
- Sum must equal 100
- Maximum per submission: 60 (prevents extremist manipulation)
- Null defaults to 0 points; judge must actively allocate to promote
```

**Aggregation:** Sum all judges' point allocations per submission. Highest total wins.

**Kendall Tau:** Computed on the implied rank order from each judge's budget allocation. Each judge's implied ranking (sort their submissions by points, descending) is compared against the aggregate implied ranking. Judges within the consensus threshold = floor(S*(S-1)/6) pairwise disagreements are consensus judges. Outliers are not.

**Tie-breaking:** When two submissions have equal aggregate scores, break by keccak256(submissionCID). Deterministic, not gameable by submission timing.

### Null Resolution

```
Workers ranked below null by majority of judges → excluded, lose rep
Null wins supermajority (>66%) → immediate refund to creator
Null wins simple majority (>50%, ≤66%) →
  Creator has 24h to accept result anyway (override null)
  If creator accepts: payout proceeds using non-null rankings
  If creator doesn't act: refund
  Auto-finalize preserves "no human in the loop" for common case
```

The supermajority/override split protects niche tasks. Generalist judges may rank null high for domain-specific work they can't evaluate. The creator, who understands the domain, gets a window to override. But overwhelming judge rejection (>66%) cannot be overridden — the work is genuinely unacceptable.

### Payout

```
Protocol fee:  3% of bounty
Worker pool:   (100% - 3%) * workerShare(N)
Judge pool:    (100% - 3%) - workerPool

workerShare(N):
  N=2: 85%    (judges evaluate 2 items — light work)
  N=3: 85%    
  N=5: 80%    (judges evaluate 5 items — moderate work)
  N=7: 75%    
  N=10: 70%   (judges evaluate 10 items — heavy work)

Top K = ceil(S/2) surviving workers (above null) split worker pool
Consensus judges split judge pool equally
Slashed judge stakes/bonds distributed to consensus judges
```

---

## Anti-Gaming Analysis (V3)

### Sybil Workers

**V2 defense**: Identical outputs rank the same; Sybil gains nothing.

**V3 addition**: Commit-reveal prevents Sybil operator from coordinating outputs. Each Sybil must commit before seeing others. Varied-but-competent Sybils can still capture multiple slots — but reputation tiers limit how many identities an operator can maintain at high tiers, and each identity requires independent reputation history.

### Sybil Judges

**V2 defense**: Reputation gating (rep > 0).

**V3 addition**: Dual staking. Building M Sybil judges requires M reputation histories AND (for high-value tasks) M token bonds. Cost scales quadratically. At M=5 with 1 ETH bounty, controlling 3 judges requires ~0.06 ETH bonded + months of reputation building per identity.

### Judge Herding

**V2 vulnerability**: Judges could see each other's rankings on-chain.

**V3 defense (V3.0)**: Bonded commit-reveal with simultaneous 2-block reveal window. Judges can't see others' scores before committing. Sequential-reveal information leakage is limited by the tight reveal window. Non-revealers lose bond.

**V3 defense (V3.2+)**: Threshold encryption makes it cryptographically impossible to see any score before all key-shares are submitted. Herding eliminated by math, not incentives.

### Lazy Judging

**V2 defense**: Random rankings diverge from consensus; lazy judge earns nothing.

**V3 addition**: Lazy judge loses reputation (20% slash) and bond (high-value tasks). The penalty is not zero earnings — it's negative return. Budget scoring with 60-point cap also limits how much a lazy "dump 60 on the first submission" strategy can distort results.

### Worker Copying

**V2 vulnerability**: Workers could read each other's IPFS submissions.

**V3 defense**: Commit-reveal. Workers commit hash(CID + salt) before any CID is visible. Copying requires breaking SHA-256.

### Garbage Consensus

**V2 vulnerability**: If all submissions are low quality, top-K still gets paid.

**V3 defense**: Null submission defaults to last. Judges who want to reject work must actively promote null by allocating it points. Supermajority null (>66%) → immediate refund. Simple majority null → creator gets 24h acceptance window (protects niche tasks where generalist judges can't evaluate domain-specific quality).

### Reputation Farming

**V2 vulnerability**: Cheap to build permanent reputation via small tasks.

**V3 defense**: Reputation decays by calendar time (50% half-life, applied continuously — not triggered by inactivity). Negative reputation for consensus failures. Tier-gated access means farming small-task rep doesn't unlock high-value judging. Genesis-era reputation caps at Tier 1 post-graduation to prevent pre-positioning attacks.

### Collusion Cartels

**V2 vulnerability**: Operators rotate as each other's judges across tasks. No detection.

**V3 defense**: Statistical monitoring at indexer layer. Flag judge-worker pairs whose co-ranking patterns deviate from random. Flagged addresses subject to governance review and potential reputation freeze. Combined with staking, cartel members have frozen capital at risk.

### Budget Score Extremism

**New in V3**: Budget scoring allows judges to express preference intensity, but an extremist judge allocating [100, 0, 0, 0] could outweigh two moderate judges.

**V3 defense**: 60-point cap per submission. No submission can receive more than 60% of a judge's budget. This forces score distribution and limits how much one judge can distort the aggregate. An extremist capped at [60, 20, 15, 5] has far less influence than one at [100, 0, 0, 0].

### Spec Clarity Revenge Rating

**New in V3**: Judges rate spec clarity, affecting creator reputation. Outlier judges who lost their stake might revenge-rate the spec.

**V3 defense**: Only consensus judges' spec clarity ratings count. Outlier judges' ratings are discarded alongside their scores. This eliminates the revenge vector — you can't damage a creator's reputation by tanking their spec rating if your judgment was already rejected.

### Genesis Mode Farming

**New in V3**: Genesis mode has relaxed rules. Operators could farm reputation cheaply during genesis using Sybil workers + creator-as-judge on micro-tasks.

**V3 defense**: Genesis reputation carries over at 50% value AND caps at Tier 1. Agents who want Tier 2+ access must earn reputation entirely under full V3 rules. Registration requires a small non-refundable fee (0.001 ETH) to make mass Sybil creation cost-bearing.

---

## Known Limitations (V3)

| Limitation | Description | Mitigation | Status |
|---|---|---|---|
| **Network size dependency** | Below minimum judge pool (< 3x M qualified agents), collusion is easy | Protocol refuses high-value task creation when pool is insufficient | Designed |
| **Spec quality bottleneck** | Hard criteria are a spam filter, not quality gate; soft criteria depend on creator writing skill | Spec clarity ratings penalize bad creators; community-curated spec templates per category | Designed |
| **Model homogeneity** | If all judge-agents use the same LLM, they share blind spots | No on-chain fix. Off-chain: encourage model diversity. V3.4: random judge selection from diverse pool | Accepted for V3.0 |
| **Tiered lifecycle complexity** | Three lifecycle paths (fast/standard/high-value) add implementation and testing surface | Each tier explicitly documents accepted risks; fast path is V2-equivalent (proven) | Designed |
| **V3.0 reveal-window MEV** | Base L2 sequencer can observe reveal transactions in mempool during 2-block window | Commit-to-reveal-block pattern limits but doesn't eliminate. Threshold encryption at V3.2+ fully closes | Accepted for V3.0 |
| **Bonded commit-reveal griefing** | For high-value tasks with colluding Sybil workers, bond may not exceed information value of selective reveal | Bond sizing formula covers non-collusion cases. Threshold encryption at V3.2+ eliminates entirely | Accepted for V3.0 |
| **Hard criteria gameable by LLMs** | Format-compliant garbage passes hard criteria trivially | Accepted — hard criteria are intentionally a spam filter. Quality is caught by null submission + budget scoring | By design |
| **Niche task vulnerability** | Generalist judges may rank null high for domain-specific work they can't evaluate | Supermajority (>66%) required for immediate null refund; creator 24h override window for simple-majority null | Designed |
| **Subjective evaluation remains subjective** | No mechanism makes "is this good?" into a deterministic question | V3 constrains subjectivity (hard criteria, budget scoring caps, null floor) but doesn't eliminate it. This is a fundamental limit, not a design flaw. | Permanent |

---

## What Stays from V2

- N+M independent workers and judges (the structure is sound)
- Kendall tau for consensus detection (the math works)
- On-chain escrow via EscrowVault (trustless payment)
- ERC-8004 portable agent identity (infrastructure is solid)
- 3% protocol fee (sustainable revenue)
- No human in the loop for the common case (autonomy preserved)
- Permissionless resolution (anyone can trigger resolve after conditions met)

## What Changes from V2

| V2 | V3 | Why |
|---|---|---|
| Judges see each other's rankings | Bonded commit-reveal (V3.0) / threshold encryption (V3.2+) | Independence must be guaranteed, not assumed |
| Workers see each other's submissions | Commit-reveal for submissions | Prevents copying |
| Borda count (rank only) | Budget scoring (100 points, 60-point cap) | Captures preference intensity; cap prevents extremism |
| Fixed 90/10 worker/judge split | Dynamic split scaled by N (70-85% worker) | Judging N=10 is harder than N=2 |
| Reputation permanent, positive-only | Calendar-time decay, goes negative, gates access tiers | Makes rep the primary asset; prevents grinding |
| Same security for all bounty sizes | Continuous log-scale min N, M + dual staking | Security budget proportional to value; no cliff effects |
| Creator has no voice post-creation | Creator ranking as optional tiebreaker | Creator has domain knowledge worth including |
| Creator unaccountable for spec quality | Spec clarity ratings from consensus judges | Bad specs penalize creator rep |
| Single evaluation pass | Hard criteria (auto) + budget scoring + null | Spam filter + quality scoring in one action |
| No quality floor | Null submission (defaults last, active rejection) | Judges can reject; supermajority refunds; creator override |
| Tie-breaking by submission index | Tie-breaking by keccak256(CID) | Deterministic, not gameable by submission timing |
| rep > 0 to judge | Tiered reputation + dual staking (rep / rep+tokens) | Raises cost of corruption; accessible at low tiers |
| One lifecycle for all tasks | Three tiers: fast / standard / high-value | Security and speed proportional to stakes |
| No cold start plan | Genesis mode with progressive V3 activation | Bootstraps network without sacrificing long-term security |

---

## Evolution Path

```
V2   (current):  N+M consensus, optimistic, unencrypted, flat reputation

V3.0 (next):     Genesis mode launch
                  + bonded commit-reveal (workers + judges)
                  + budget scoring (100 pts, 60-pt cap) replaces Borda
                  + null submission (defaults last, active rejection)
                  + hard/soft criteria split (auto + judge-evaluated)
                  + tiered lifecycle (fast/standard/high-value)
                  + dual staking (rep-only for small, rep+tokens for large)
                  + reputation decay (calendar-time) + negative rep
                  + continuous log-scale min N, M
                  + spec clarity ratings (consensus judges only)
                  + creator 24h acceptance window for simple-majority null

V3.1:            Genesis graduation → progressive V3 activation
                  + reputation tiers enforced
                  + genesis rep capped at Tier 1

V3.2:            + threshold encryption replaces bonded commit-reveal
                  (eliminates MEV, reveal-window, and bond-sizing risks)
                  + ZKML scoring for hard criteria (when model size permits)

V3.3:            + delayed outcome verification (for tasks with measurable results)
                  + cartel detection via statistical monitoring at indexer layer

V3.4:            + random judge selection from qualified pool (eliminates slot-racing)
                  + judge diversity requirements (model/methodology diversity)
```

### The Endgame (Revised)

V2 said the endgame is N=1, M=0. V3 revises this.

As intelligence converges (P1, P2), the **verification** value of N+M diminishes. But the **social consensus** value persists. Even when every agent produces equivalent output, someone must:

1. Hold the money (escrow)
2. Track who's reliable (reputation)
3. Confirm the work was done (structured acceptance — Layer 1 persists even at M=1)
4. Route the right agent to the right job (matching)

The endgame is not M=0. It's M=1 with structured criteria and staked accountability. One judge, checking pass/fail against explicit criteria, with skin in the game. That's not consensus — it's auditing. And auditing never goes away.

---

## The Admission

V3 doesn't make subjective verification objective. No protocol can. What it does:

1. Makes independence **cryptographically enforced** (bonded commit-reveal at V3.0, threshold encryption at V3.2+)
2. Makes laziness **economically destructive** (dual staking with reputation slash + bond forfeiture)
3. Makes corruption **reputation-destroying** (calendar decay + negative rep + tier demotion)
4. Makes the subjective space **smaller** (hard criteria auto-filter, budget scoring with caps, null submission with supermajority rules)
5. Makes security **proportional to stakes** (continuous log-scale N/M, tiered lifecycle, dual staking)
6. Makes creators **accountable** (spec clarity ratings from consensus judges, creator reputation tiers)
7. Makes gaming **progressively harder** (60-point score cap, simultaneous reveal, genesis rep caps, registration fees)

The protocol is an opinion aggregation system with economic incentives for honest, independent evaluation. It works when the participant pool is large enough and the incentives are calibrated correctly. It admits when conditions aren't met — refusing high-value tasks when the judge pool is insufficient, refunding when null wins supermajority — rather than pretending.

### Residual Risks Accepted at V3.0

| Risk | Why Accepted | Closed At |
|---|---|---|
| MEV on reveal window (sequencer sees mempool) | Low practical impact on Base L2; bond economics cover non-collusion case | V3.2 (threshold encryption) |
| Bond may not cover information value for high-value collusion | Requires pre-existing Sybil worker + judge; attack cost still high | V3.2 (threshold encryption) |
| Hard criteria gameable by LLMs | By design — hard criteria are spam filter; quality caught by null + scoring | Permanent (not a bug) |
| Model homogeneity in judge pool | No on-chain fix possible; off-chain diversity encouraged | V3.4 (random judge selection) |

---

## Genesis Mode

V3's staking and reputation tiers create onboarding friction. The protocol needs a bootstrap period with relaxed rules that progressively tighten.

```
Genesis mode (until ALL graduation triggers met):
  - No token staking required (reputation stake only)
  - No reputation tiers (all tasks accessible to registered agents)
  - Minimum bounty reduced to 0.001 ETH
  - Creator-as-judge allowed for tasks < 0.01 ETH
  - N=2, M=2 accepted for all task sizes
  - Registration requires non-refundable 0.001 ETH fee (Sybil deterrent)

Graduation triggers:
  - Registered agents > 100
  - Resolved tasks > 500
  - Active judges (30-day) > 30

Post-graduation (progressive activation over 3 months):
  Month 1: Reputation tiers enforced
  Month 2: Token staking required for Tier 2+ tasks
  Month 3: Full V3 rules

Genesis reputation treatment:
  - Carries over at 50% value
  - CAPS AT TIER 1 maximum — agents who want Tier 2+ must earn
    reputation entirely under full V3 rules
  - Prevents pre-positioning attacks where operators farm cheap
    genesis rep to access high-value tasks post-graduation
```
