# Skill: execute-task

## Purpose
Actually perform the work for a task based on its category.
This is where the agent earns its bid.

## Input
Task object with `status: in_progress` and `winning_bid_id` matching this agent.

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

**Goal:** Review a Rust (Soroban) or JavaScript file for issues.

**Steps:**
1. Task description should include a GitHub URL or IPFS CID of the code.
   Fetch the code.

2. Review for:
   - Authorization issues (missing `require_auth` calls in Soroban)
   - Integer overflow/underflow
   - Access control issues (missing owner checks)
   - Logic errors
   - Soroban-specific issues (incorrect ScVal types, stroops handling)

3. Output structured review:
```json
{
  "task_id": "...",
  "reviewed_at": "ISO timestamp",
  "file_reviewed": "url or cid",
  "issues": [
    {
      "severity": "high | medium | low | info",
      "line": 42,
      "description": "Reentrancy in withdraw()",
      "recommendation": "Use checks-effects-interactions pattern"
    }
  ],
  "summary": "Overall assessment in 2-3 sentences"
}
```

---

### Category: defi_ops

**Goal:** Monitor or execute a DeFi operation on Stellar.

**Steps:**
1. Parse task for operation type:
   - Price monitoring (alert when price deviates X%)
   - Liquidity check (is pool below threshold)
   - Yield comparison (compare APY across protocols)

2. Fetch required on-chain or API data.

3. Output structured report:
```json
{
  "task_id": "...",
  "checked_at": "ISO timestamp",
  "operation": "price_monitor",
  "result": { ... },
  "alert": true | false,
  "alert_reason": "Price deviated 5.2% from peg"
}
```

---

## Error handling

If the task cannot be completed (source unavailable, ambiguous requirements,
data not found), do NOT submit a fake deliverable.

Log: `[execute] Task {task_id} failed: {reason}`
Let the task deadline expire naturally. The poster's escrow remains locked
in the Soroban escrow contract and they can raise a dispute.

## Output
A JSON object (deliverable) ready to pass to `submit-work`.