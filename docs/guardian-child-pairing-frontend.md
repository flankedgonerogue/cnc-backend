# Frontend Integration Guide: Guardian-Child Pairing Rework

This guide explains how frontend clients should integrate the new guardian-child flows:

1. guardians can have multiple children
2. guardians can create a new child directly
3. guardians can request pairing with an existing child by email
4. pairing completes through a backend confirmation URL that redirects to frontend success/error pages

## Required frontend routes

Implement these routes in your frontend:

- `FRONTEND_SUCCESSFUL_PAIRING_URL` (example: `/pairing/success`)
- `FRONTEND_ERROR_URL` (example: `/pairing/error`)

The backend redirects users to these URLs after `GET /users/pairing/confirm`.

## Backend environment dependencies

Backend must be configured with:

- `BACKEND_URL` (used to build absolute pairing confirmation links in email)
- `FRONTEND_SUCCESSFUL_PAIRING_URL`
- `FRONTEND_ERROR_URL`

## GraphQL operations to use

All operations are sent to `POST /graphql`.

### 1) List guardian children

Use this query for guardian dashboards:

```graphql
query MyChildrenForGuardian {
  myChildrenForGuardian {
    id
    email
    role
    firstName
    lastName
    displayName
    childProfile {
      id
      therapistId
      guardianId
    }
  }
}
```

Auth: Guardian JWT required.

### 2) Create a new child directly

Use this mutation when guardian creates a brand-new child account.

```graphql
mutation AddChild($input: CreateChildInput!) {
  addChild(createChildInput: $input) {
    id
    email
    role
    firstName
    lastName
    displayName
    childProfile {
      id
      therapistId
      guardianId
    }
  }
}
```

Variables:

```json
{
  "input": {
    "email": "child@example.com",
    "password": "test123456",
    "therapistEmail": "therapist@example.com",
    "firstName": "Test",
    "lastName": "Child"
  }
}
```

Important:

- `therapistEmail` is required.
- `therapistEmail` must map to an existing therapist profile.
- A guardian can repeat this flow multiple times for multiple children.

### 3) Request pairing with an existing child email

Use this mutation when guardian enters an already-existing child account email.

```graphql
mutation RequestChildPairing($input: RequestChildPairingInput!) {
  requestChildPairing(requestChildPairingInput: $input) {
    success
    message
  }
}
```

Variables:

```json
{
  "input": {
    "childEmail": "existing-child@example.com"
  }
}
```

Auth: Guardian JWT required.

Backend behavior:

- creates a secure, expiring pairing token
- sends pairing email to the child email
- returns `{ success, message }`

## Pairing confirmation flow

1. Child (or account owner) receives an email with backend URL:
   - `GET /users/pairing/confirm?token=<token>`
2. Backend validates token and attempts pairing.
3. Backend redirects browser:
   - success -> `FRONTEND_SUCCESSFUL_PAIRING_URL`
   - failure/expired/invalid -> `FRONTEND_ERROR_URL`

Frontend should:

- show a clear success page and next actions (for example, "Return to guardian dashboard")
- show actionable error states on error page (expired token, invalid token, already consumed)

## Recommended frontend UX

- In "Add child" UI, offer two tabs:
  - `Create new child`
  - `Link existing child by email`
- After `requestChildPairing` success:
  - display "Pairing email sent" status
  - allow resend by submitting again
- In guardian home page:
  - always refresh via `myChildrenForGuardian` after add/link flows

## Error handling guidance

Typical backend errors to surface:

- therapist not found for `therapistEmail`
- child email not found (for pairing request)
- child already linked to this guardian
- pairing token invalid/expired/already consumed (redirect goes to error URL)

Prefer user-friendly copy in UI, but preserve API error details in logs.

## Migration checklist for frontend teams

- replace any usage of `myChild` query with `myChildrenForGuardian`
- update `addChild` variables to send `therapistEmail` (not `therapistId`)
- add `requestChildPairing` mutation integration
- implement success/error pairing redirect pages
- validate guardian child list rendering supports multiple children

---

# Frontend Integration Guide: Guardian Child Analytics (Parent-safe)

This section documents the new `guardianChildAnalytics` query intended for parent-facing experiences.

## Design intent

The guardian analytics payload is intentionally simplified:

- includes only information useful for a layman parent
- avoids therapist-level technical or clinical review fields
- provides plain-language summaries (`parentSummary`) and simple labels (`statusLabel`)

## Query

Use this for guardian dashboards and child detail pages:

```graphql
query GuardianChildAnalytics(
  $period: DashboardPeriod!
  $comparePrevious: Boolean
  $childProfileId: String
) {
  guardianChildAnalytics(
    period: $period
    comparePrevious: $comparePrevious
    childProfileId: $childProfileId
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
    children {
      childProfileId
      displayName
      sessionCount
      completionRate
      positiveChoiceRatio
      engagementDeltaPercent
      statusLabel
      parentSummary
      trend {
        bucketStart
        bucketEnd
        engagementScore
      }
    }
  }
}
```

### Variables

All children for guardian:

```json
{
  "period": "MONTH",
  "comparePrevious": true,
  "childProfileId": null
}
```

Single child:

```json
{
  "period": "WEEK",
  "comparePrevious": true,
  "childProfileId": "child_profile_id_here"
}
```

Auth: Guardian JWT required.

## Field semantics for frontend

- `sessionCount`:
  - total sessions included in the selected time window
- `completionRate`:
  - fraction between `0` and `1` (multiply by 100 for percent UI)
- `positiveChoiceRatio`:
  - fraction between `0` and `1` indicating overall positive choice share
- `engagementDeltaPercent`:
  - percent change compared to previous window (can be `null`)
- `statusLabel`:
  - one of:
    - `improving`
    - `steady`
    - `needsAttention`
- `parentSummary`:
  - short plain-language sentence intended to be displayed directly to parents
- `trend`:
  - bucketed line-chart points of engagement for the selected period
  - `WEEK` = 7 buckets, `MONTH` = 4 buckets

## Recommended UI mapping

### Status badge mapping

- `improving` -> green badge and positive reinforcement copy
- `steady` -> neutral/blue badge and consistency copy
- `needsAttention` -> amber badge and therapist check-in suggestion

### Card layout per child

Recommended child card sections:

1. Header
   - child name (`displayName`)
   - status badge (`statusLabel`)
2. Core metrics
   - sessions this period (`sessionCount`)
   - completion rate (`completionRate * 100`)
   - positive choices (`positiveChoiceRatio * 100`)
3. Trend
   - sparkline/mini chart from `trend.engagementScore`
4. Parent guidance
   - render `parentSummary` directly

### Empty state behavior

If `children` is empty:

- show "No analytics yet for this period"
- provide CTA to start a story session
- avoid showing warning-style colors for empty data

## Suggested frontend state model

Example TypeScript shapes:

```ts
type GuardianChildTrendPoint = {
  bucketStart: string;
  bucketEnd: string;
  engagementScore: number;
};

type GuardianChildSnapshot = {
  childProfileId: string;
  displayName: string | null;
  sessionCount: number;
  completionRate: number;
  positiveChoiceRatio: number;
  engagementDeltaPercent: number | null;
  statusLabel: "improving" | "steady" | "needsAttention";
  parentSummary: string;
  trend: GuardianChildTrendPoint[];
};
```

## Guardian dashboard loading strategy

Recommended sequence:

1. Query `myChildrenForGuardian` for child list and selectors.
2. Query `guardianChildAnalytics` for selected period.
3. If user selects a specific child, re-query with `childProfileId`.
4. Keep `period` and `childProfileId` in URL/query params for shareable navigation.

## Error handling for analytics

Expected cases:

- `401 Unauthorized`:
  - user token missing/expired
  - action: refresh token / force sign-in
- `403 Forbidden`:
  - guardian requested child profile not linked to them
  - action: clear selected child filter and refetch
- `404 Not Found`:
  - guardian profile missing (unexpected account state)
  - action: show support contact flow

## Combined migration checklist (pairing + analytics)

1. Replace any old `myChild` query usage with `myChildrenForGuardian`.
2. Update `addChild` mutation input to use `therapistEmail`.
3. Add `requestChildPairing` mutation flow (existing child by email).
4. Add frontend pages/routes for pairing success and error redirects.
5. Add `guardianChildAnalytics` query integration in guardian dashboard.
6. Render parent-safe metrics and status labels only (no therapist-centric fields).
7. Add period toggles (`WEEK` / `MONTH`) and optional child filter.
8. Add empty/error/loading states for both pairing and analytics screens.
