# Analytics API — Therapist dashboard (GraphQL)

Cross-session aggregates for therapists, built from existing **`BehavioralAnalytics`** rows (one per session with story interactions). Only sessions that have analytics records in the chosen time window are included.

## Base URL

- Local: `http://localhost:3000`
- GraphQL: `POST /graphql`

## Authentication

- `Authorization: Bearer <access_token>`
- Role: **`THERAPIST`**

---

## Query: `therapistDashboardAnalytics`

Returns summary KPIs, **per-child** rows (with trend buckets), **per-template** effectiveness, and optional **comparison** to the immediately preceding window of the same length.

### Arguments

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `period` | `DashboardPeriod` | yes | `WEEK` or `MONTH` (see below) |
| `comparePrevious` | `Boolean` | no (default `false`) | When `true`, also loads the prior window and fills comparison fields |
| `childProfileId` | `ID` / `String` | no | Restrict to one child; must belong to the therapist |
| `templateId` | `ID` / `String` | no | Restrict to one template; must be owned by the therapist (not deleted) |

### `DashboardPeriod`

- **`WEEK`** — **Rolling last 7 days** (`now - 7d` → `now`) vs **prior 7 days** when `comparePrevious` is true (`now - 14d` → `now - 7d`). Trend buckets per child: **7** sub-windows (equal length).
- **`MONTH`** — **Rolling last 30 days** vs **prior 30 days** when comparing. Trend buckets per child: **4** sub-windows (equal length).

All boundaries use the server clock (typically UTC depending on deployment).

### What is aggregated

Each row comes from **`BehavioralAnalytics`** joined to **`Session`** where:

- `Session.child.therapistId` matches the authenticated therapist’s profile, and  
- `Session.startedAt` falls inside the current (and, if comparing, previous) window, and  
- Optional filters `childProfileId` / `templateId` apply.

Metrics are derived from session analytics fields, e.g.:

- Average **`engagementScore`**, **`avgNodeConfidenceScore`**
- **`weightedPositiveChoiceRatio`** = `sum(positiveChoices) / sum(totalChoices)` (0 if no choices)
- **`flaggedSessionCount`** — sessions with `flaggedForReview`
- **Template `completionRate`** — share of sessions with `status === COMPLETED` among sessions for that template in the window

### Response shape (conceptual)

- `period` — echo of `DashboardPeriod`
- `currentWindow` / `previousWindow` — `{ start, end }` datetimes
- `summary` — `current` metrics; if `comparePrevious`, `previous` plus `avgEngagementScoreDeltaPercent` and `sessionCountDeltaPercent` (percent change; may be `null` when the previous value was 0 and the current is non-zero)
- `byChild` — sorted by average engagement (desc). Each row includes **`trendPoints`**: bucketed averages for the current window only (7 buckets for `WEEK`, 4 for `MONTH`)
- `byTemplate` — sorted by session count (desc); includes completion rate and optional deltas vs previous window

### Example

```graphql
query TherapistDashboard(
  $period: DashboardPeriod!
  $comparePrevious: Boolean!
  $childProfileId: String
) {
  therapistDashboardAnalytics(
    period: $period
    comparePrevious: $comparePrevious
    childProfileId: $childProfileId
    templateId: null
  ) {
    period
    currentWindow {
      start
      end
    }
    previousWindow {
      start
      end
    }
    summary {
      current {
        sessionCount
        avgEngagementScore
        flaggedSessionCount
        weightedPositiveChoiceRatio
      }
      previous {
        sessionCount
        avgEngagementScore
      }
      avgEngagementScoreDeltaPercent
    }
    byChild {
      childProfileId
      displayName
      sessionCount
      avgEngagementScore
      engagementScoreDeltaPercent
      trendPoints {
        bucketStart
        bucketEnd
        avgEngagementScore
        sessionCount
      }
    }
    byTemplate {
      templateId
      targetBehavior
      sessionCount
      avgEngagementScore
      completionRate
      engagementScoreDeltaPercent
    }
  }
}
```

**Variables**

```json
{
  "period": "MONTH",
  "comparePrevious": true,
  "childProfileId": null
}
```

### Errors

- `401` / GraphQL auth error — missing or invalid JWT
- `403` — role is not `THERAPIST`, or `childProfileId` / `templateId` is not allowed for this therapist
- `404` — therapist profile missing for the user (unexpected for a valid `THERAPIST` token)

### Related

- Per-session detail: `getSessionBehavioralAnalytics` (Story module) — single session analytics + interactions.
