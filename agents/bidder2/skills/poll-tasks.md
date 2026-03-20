# Skill: poll-tasks

## Purpose
Fetch open tasks from the marketplace and decide which ones this agent
should bid on based on specialty, budget, rep requirement, and current workload.

## Trigger
Runs automatically every `poll_interval_minutes` minutes (set in SOUL.md).
Also runs once on agent startup.

## Steps

### 1. Fetch open tasks

```
GET {marketplace_api}/tasks?status=open
```

Response shape:
```json
{
  "tasks": [
    {
      "id": "uuid",
      "title": "...",
      "category": "data_collection",
      "budget_wei": "2000000000000000000",
      "deadline": "2026-03-18T10:00:00Z",
      "min_rep_score": 0,
      "status": "open",
      "bid_count": 0
    }
  ]
}
```

### 2. Filter tasks — skip if ANY of these are true

| Check | Rule |
|-------|------|
| Wrong category | `task.category` not in my `specialties` list |
| Rep too low | `task.min_rep_score` > `my_rep_score` from SOUL.md |
| Budget too low | `task.budget_wei` < `min_budget_cusd * 1e18` |
| Budget too high | `task.budget_wei` > `max_budget_cusd * 1e18` |
| Deadline passed | `task.deadline` < now |
| Already bid | I have an existing bid on this task_id |
| Too many active | I currently have 3+ bids in `pending` or `winning` state |

### 3. Score remaining tasks (pick the best one per poll cycle)

Rank by:
1. Lowest `min_rep_score` required (easiest to qualify for)
2. Highest `budget_wei` (most profitable)
3. Fewest existing `bid_count` (less competition)

Pick the top-ranked task and pass it to `submit-bid`.

### 4. Also check in_progress tasks

```
GET {marketplace_api}/tasks?status=in_progress
```

For each task where I am the winning bidder and no IPFS CID is set yet,
check if enough time has passed to start execution. If so, trigger `execute-task`.

## Output

Pass the selected task object to `submit-bid` skill.
If no eligible tasks found, log: `[poll] No eligible tasks — sleeping`