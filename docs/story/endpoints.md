# Story API — Interactive narrative (GraphQL)

Generates and continues AI-driven story nodes for an assigned **session** (child + template). Uses Gemini for text, optional image/audio via storage, and updates **behavioral analytics** as choices are recorded.

## Base URL

- Local: `http://localhost:3000`
- Endpoint: `POST /graphql`

---

## Authentication

- `Authorization: Bearer <access_token>`

### Roles

| Operation | `THERAPIST` | `CHILD` | `GUARDIAN` |
|-----------|-------------|---------|------------|
| `startStory` / `restartStory` / `continueStory` | ✅ | ✅ | ❌ |
| `getSessionBehavioralAnalytics` | ✅ | ✅ | ✅ |

Access to a **session** is enforced in `StoryService` (child may only use their own sessions; therapist only sessions for their assigned children). Requests can fail if the session is missing, not **`ACTIVE`**, or the user is not allowed.

---

## Mutations

### `startStory(sessionId: String!): StoryNodeResponse!`

Starts the story for the session: creates the first **story node** (if none exist) or returns the latest node if the session was already started.

- **Args:** `sessionId` — non-empty string.

### `restartStory(sessionId: String!): StoryNodeResponse!`

Re-runs the start flow for an existing session (same validation as `startStory`).

### `continueStory(sessionId: String!, choiceId: String!, timeTakenMs: Int!): ContinueStoryResponse!`

Applies a choice, logs an **interaction**, updates **behavioral analytics**, and returns the next node (or ending node).

- **Args:**
  - `sessionId`
  - `choiceId` — must belong to the **current** node’s choices
  - `timeTakenMs` — non-negative integer (milliseconds to decide)

---

## Query

### `getSessionBehavioralAnalytics(sessionId: String!): SessionBehavioralAnalyticsResponse!`

Returns persisted **`BehavioralAnalytics`**, ordered **interactions** (with choice/node snippets), and a small **summary** (engagement, flags, etc.). Use only for sessions the caller is allowed to access.

---

## Response types (conceptual)

**`StoryNodeResponse`**

- `sessionId`
- `node` (`StoryNodeEntity`): `id`, `textContent`, `imageUrl`, `audioUrl`, `confidenceScore`, `isApproved`, `choices[]` (`id`, `text`, `behavioralTag` — `Positive` or `Negative` only)

**`ContinueStoryResponse`**

- `sessionId`
- `isEnding` — when `true`, the narrative may be finished; `node.choices` may be empty
- `node` — same shape as above

**`SessionBehavioralAnalyticsResponse`**

- `analytics` — full behavioral analytics row (`positiveChoices`, `negativeChoices` for non-positive choices, engagement, flags, notes, etc.)
- `interactions[]` — per-choice log with timing and optional node/choice detail
- `summary` — `sessionId`, `totalInteractions`, `sessionDuration`, `overallEngagement`, `therapistNotesForReview`, `flaggedForTherapistReview`

Types are defined in `src/story/entities/story.entity.ts`.

---

## Examples

**Start**

```graphql
mutation Start($sessionId: String!) {
  startStory(sessionId: $sessionId) {
    sessionId
    node {
      id
      textContent
      confidenceScore
      choices {
        id
        text
        behavioralTag
      }
    }
  }
}
```

**Continue**

```graphql
mutation Continue($sessionId: String!, $choiceId: String!, $timeTakenMs: Int!) {
  continueStory(
    sessionId: $sessionId
    choiceId: $choiceId
    timeTakenMs: $timeTakenMs
  ) {
    sessionId
    isEnding
    node {
      id
      textContent
      choices {
        id
        text
      }
    }
  }
}
```

**Analytics**

```graphql
query Analytics($sessionId: String!) {
  getSessionBehavioralAnalytics(sessionId: $sessionId) {
    analytics {
      engagementScore
      totalChoices
      positiveChoices
      negativeChoices
      flaggedForReview
      notesForTherapist
    }
    summary {
      totalInteractions
      overallEngagement
      flaggedForTherapistReview
    }
  }
}
```

---

## Errors

GraphQL typically returns HTTP `200` with an `errors` array for resolver failures (validation, `401`-style auth, `404` not found, etc.), or `400` depending on driver configuration. Inspect `errors[].message` and `extensions` in your client.

---

## Behavior notes

- **Child name / age** for prompts come from the **session**, **template**, and **child profile** in the service layer—not from the start mutation args (only `sessionId` is passed).
- Story generation uses **Gemini**, prompts under `src/story/prompt/`, and optional **media** via configured storage.
- **`timeTakenMs`** is stored on each interaction for analytics.
- If the session already has nodes, **`startStory`** returns the latest node instead of duplicating generation (see `StoryService.startStory`).

---

## Related docs

- Sessions (assigning a session): `docs/session/endpoints.md`
- Therapist cross-session analytics: `docs/analytics/endpoints.md`
