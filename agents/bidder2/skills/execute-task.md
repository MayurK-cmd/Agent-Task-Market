# Skill: execute-task

## Purpose
Actually perform the work for a task based on its category.
This is where the agent earns its bid.

## Input
Task object with `status: in_progress` and `winning_bid_id` matching this agent.

## This Agent's Specialties

This agent specializes in **code_review** and **defi_ops** — see detailed
execution steps below for these categories.

## Execution by category

---

### Category: data_collection

**Goal:** Collect structured data as specified in the task title/description.

**Steps:**
1. Parse the task title and description to understand exactly what data is needed
   - What entities? (protocols, wallets, prices, events)
   - What fields? (name, TVL, address, timestamp)
   - What source? (on-chain, API, public website)
   - What format? (JSON array, CSV)

2. Collect the data using available tools:
   - **On-chain Stellar data:** query via `{STELLAR_RPC_URL}` or Horizon APIs
   - **DeFi TVL data:** fetch from DeFiLlama API `https://api.llama.fi/protocols`
     then filter for `chain: "Stellar"`
   - **Token prices:** fetch from `https://api.coingecko.com/api/v3/simple/price`
   - **Wallet activity:** query Stellar RPC/Horizon for transaction history

3. Structure the output as clean JSON:
```json
{
  "task_id": "...",
  "collected_at": "ISO timestamp",
  "data": [ ... ],
  "source": "url or description of source",
  "record_count": 10
}
```

4. Validate — check record count matches what was requested. If fewer
   records than expected, note it in a `warnings` field.

---

### Category: content_gen

**Goal:** Generate written content as specified (tweets, articles, summaries).

**Steps:**
1. Parse task for:
   - Content type (tweet thread, blog post, summary, description)
   - Topic and key points to cover
   - Tone (professional, casual, technical)
   - Length / count (e.g. "5 tweets", "500 word article")

2. Generate the content. Structure output as:
```json
{
  "task_id": "...",
  "generated_at": "ISO timestamp",
  "content_type": "tweet_thread",
  "items": [
    { "index": 1, "text": "..." },
    { "index": 2, "text": "..." }
  ],
  "word_count": 120
}
```

3. Self-review checklist before submitting:
   - [ ] Matches requested count / length
   - [ ] On-topic (re-read task description)
   - [ ] No hallucinated facts or made-up statistics
   - [ ] Appropriate tone

---

### Category: code_review

**Goal:** Review Rust (Soroban) or JavaScript smart contract code for security issues.

**Steps:**

1. **Fetch the code** — Task description should include a GitHub URL, IPFS CID,
   or code snippet. Retrieve the full source code.

2. **Review checklist:**
   - **Authorization:** Missing `require_auth()` calls in Soroban contracts
   - **Access control:** Missing owner/admin checks in sensitive functions
   - **Integer issues:** Overflow/underflow, incorrect stroops conversion (1 XLM = 10^7 stroops)
   - **Reentrancy:** State changes after external calls
   - **Input validation:** Missing checks on function parameters
   - **Event emission:** Missing `emit()` for important state changes
   - **Error handling:** Proper `Result<T, E>` usage, no unchecked unwraps

3. **Soroban-specific checks:**
   - Correct `ScVal` type conversions
   - Proper `Address` trait usage with `require_auth()`
   - Contract data storage patterns (instance vs. persistent)
   - Token interface compliance (SAC-001)

4. **Output structured review:**
```json
{
  "task_id": "...",
  "reviewed_at": "ISO timestamp",
  "file_reviewed": "https://github.com/...",
  "contract_address": "CA... (if applicable)",
  "issues": [
    {
      "severity": "high",
      "line": 42,
      "function": "withdraw()",
      "description": "Missing require_auth() call allows unauthorized withdrawals",
      "recommendation": "Add env.require_auth(&from) before balance update",
      "cwe": "CWE-284 (Improper Access Control)"
    }
  ],
  "summary": "Overall assessment in 2-3 sentences",
  "auditor_notes": "Additional context or false positives to ignore"
}
```

---

### Category: defi_ops

**Goal:** Monitor, analyze, or execute DeFi operations on Stellar.

**Steps:**

1. **Parse task for operation type:**
   - **Price monitoring:** Alert when token price deviates X% from peg/reference
   - **Liquidity check:** Monitor pool reserves, alert if below threshold
   - **Yield comparison:** Compare APY across Stellar DeFi protocols
   - **Transaction analysis:** Analyze wallet activity, contract interactions
   - **Protocol health:** Check solvency, collateralization ratios

2. **Data sources:**
   - **Stellar RPC:** `https://soroban-testnet.stellar.org` — on-chain contract data
   - **Horizon API:** `https://horizon-testnet.stellar.org` — transactions, accounts
   - **DeFiLlama:** `https://api.llama.fi/protocols` — TVL data filtered by `chain: "Stellar"`
   - **CoinGecko:** `https://api.coingecko.com/api/v3/simple/price` — token prices
   - **Stellar Expert:** `https://stellar.expert/explorer/testnet` — contract analytics

3. **Output structured report:**
```json
{
  "task_id": "...",
  "checked_at": "ISO timestamp",
  "operation": "liquidity_check",
  "protocol": "Protocol name",
  "pool_address": "CA... (if applicable)",
  "result": {
    "current_price": 1.002,
    "peg_price": 1.000,
    "deviation_pct": 0.2,
    "threshold_pct": 5.0
  },
  "alert": false,
  "alert_reason": null,
  "summary": "All metrics within normal ranges. Pool healthy."
}
```

4. **Alert thresholds (default):**
   - Price deviation: >5% from reference
   - Liquidity drop: >20% in 24h
   - APY anomaly: >50% deviation from average

---

## Error handling

If the task cannot be completed (source unavailable, ambiguous requirements,
data not found), do NOT submit a fake deliverable.

Log: `[execute] Task {task_id} failed: {reason}`
Let the task deadline expire naturally. The poster's escrow remains locked
in the Soroban escrow contract and they can raise a dispute.

## Output
A JSON object (deliverable) ready to pass to `submit-work`.