# API Endpoints — Sessions

This document describes the session REST and GraphQL APIs for the CNC Backend.

## Base URL

- Local: `http://localhost:3000`

## Authentication & Access

All session endpoints require:

- `Authorization: Bearer <access_token>`
- Roles: `THERAPIST` or `CHILD` (per route)

Pagination query params:

- `take` (default `20`, max `100`)
- `skip` (default `0`, max `100`)

---

## Session response shape

REST and GraphQL use the same underlying `Session` model.

### `Session`

| Field         | Notes |
|---------------|--------|
| `id`          | Session id |
| `childId`     | Child profile id |
| `templateId`  | Linked story template id |
| `status`      | `ACTIVE`, `COMPLETED`, etc. |
| `startedAt`   | ISO datetime |
| `endedAt`     | ISO datetime or null |
| `child`       | Child + nested `user` (`firstName`, `lastName`) where loaded |
| **`template`** | **Optional in the GraphQL schema** (`null` if not requested or missing). When present, it is the **full** story template (not a partial summary). |
| `nodes`       | Story nodes with choices (**detail** only) |
| `interactions`| Ordered interactions (**detail** only) |
| `_count`      | e.g. `{ nodes }` for list endpoints |

### `template` (when loaded)

Listing (`GET /sessions`, `GET /sessions/mine`) and **session detail** (`GET /sessions/:id`) load the related **`StoryTemplate`** so clients receive the full object:

- `id`, `therapistId`
- `targetBehavior`, `setting`, `mainCharacter`, `emotionalTone`
- `promptSuggestion`, `visualStyle`
- `createdAt`, `updatedAt`, `deletedAt` (nullable)

**Assign session** (`POST /sessions`) returns a minimal payload (see below) and does **not** embed `template`; fetch the session again or use **`session`** query to read it.

---

# REST — Session Endpoints

## Assign Session (Therapist Only)

Create a new session for a child using a template owned by the therapist.

```http
POST /sessions
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "childProfileId": "child_profile_123",
  "templateId": "template_456"
}
```

**Request Body**

- `childProfileId` (string, required)
- `templateId` (string, required)

**Responses**

- `201 Created` with the created session (id, childId, templateId, status, startedAt — no embedded `template`)
- `401 Unauthorized` if token is missing/invalid
- `403 Forbidden` if the child is not assigned to the therapist
- `404 Not Found` if therapist profile, child profile, or template is not found

**Response Shape (Example)**

```json
{
  "id": "session_123",
  "childId": "child_profile_123",
  "templateId": "template_456",
  "status": "ACTIVE",
  "startedAt": "2024-01-01T12:00:00.000Z"
}
```

---

## List Sessions (Therapist Only)

List sessions for the therapist, optionally filtered.

```http
GET /sessions?childProfileId=child_profile_123&status=ACTIVE&take=20&skip=0
Authorization: Bearer <access_token>
```

**Query Params**

- `childProfileId` (string, optional)
- `status` (string, optional)
- `take` (number, optional)
- `skip` (number, optional)

**Responses**

- `200 OK` — array of sessions with **child** (and user names), **full `template`**, and **`_count.nodes`**
- `401 Unauthorized` if token is missing/invalid
- `403 Forbidden` if role is not `THERAPIST`
- `404 Not Found` if therapist profile does not exist

---

## List My Sessions (Child Only)

List sessions for the authenticated child.

```http
GET /sessions/mine?status=ACTIVE&take=20&skip=0
Authorization: Bearer <access_token>
```

**Query Params**

- `status` (string, optional)
- `take` (number, optional)
- `skip` (number, optional)

**Responses**

- `200 OK` — array of sessions with **full `template`** and **`_count.nodes`** (no child block on this route)
- `401 Unauthorized` if token is missing/invalid
- `403 Forbidden` if role is not `CHILD`
- `404 Not Found` if child profile does not exist

---

## Get Session Detail (Therapist or Child)

Fetch full session detail, including nodes, choices, interactions, child, and **full `template`**.

```http
GET /sessions/{sessionId}
Authorization: Bearer <access_token>
```

**Access Rules**

- Child can access their own sessions.
- Therapist can access sessions for their assigned children.

**Responses**

- `200 OK` — session with **`template`** (full object), **`child`**, **`nodes`** (with **`choices`**), **`interactions`**
- `401 Unauthorized` if token is missing/invalid
- `403 Forbidden` if the user does not have access to the session
- `404 Not Found` if session does not exist

---

# GraphQL — Sessions

`POST /graphql` — same authentication (`Authorization: Bearer`).

| Operation        | Role        | Description |
|-----------------|-------------|-------------|
| `assignSession` | `THERAPIST` | Create session; returns minimal fields (no `template`). |
| `listSessions`  | `THERAPIST` | Paginated list with **`template`**, **`child`**, **`_count`**. |
| `mySessions`    | `CHILD`     | Paginated list with **`template`** and **`_count`**. |
| **`session`**   | `THERAPIST` \| `CHILD` | Single session by id; **`template`** optional field — include **`template { ... }`** in the selection set to load the full template alongside nodes and interactions. |

**Example — session detail with template**

```graphql
query SessionWithTemplate($id: String!) {
  session(id: $id) {
    id
    status
    templateId
    startedAt
    endedAt
    template {
      id
      targetBehavior
      setting
      mainCharacter
      emotionalTone
      promptSuggestion
      visualStyle
      createdAt
      updatedAt
    }
    child {
      id
      user {
        firstName
        lastName
      }
    }
    nodes {
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

In the schema, `Session.template` is **nullable**: omit the `template` selection, or expect `null` only if the relation cannot be resolved (normal sessions return the full template when requested).

---

## Notes

- Session access is enforced on `GET /sessions/{id}` and GraphQL `session` using an access guard.
- Session listing supports pagination with `take` and `skip` capped at `100`.
