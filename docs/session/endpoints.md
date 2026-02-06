# API Endpoints — Sessions

This document describes the session endpoints for the CNC Backend.

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

# Session Endpoints

## Assign Session (Therapist Only)

Create a new session for a child using a template owned by the therapist.

```/dev/null/http.txt#L1-9
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

- `201 Created` with the created session
- `401 Unauthorized` if token is missing/invalid
- `403 Forbidden` if the child is not assigned to the therapist
- `404 Not Found` if therapist profile, child profile, or template is not found

**Response Shape (Example)**

```/dev/null/http.txt#L1-8
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

```/dev/null/http.txt#L1-2
GET /sessions?childProfileId=child_profile_123&status=ACTIVE&take=20&skip=0
Authorization: Bearer <access_token>
```

**Query Params**

- `childProfileId` (string, optional)
- `status` (string, optional)
- `take` (number, optional)
- `skip` (number, optional)

**Responses**

- `200 OK` array of sessions with child info, template summary, and node counts
- `401 Unauthorized` if token is missing/invalid
- `403 Forbidden` if role is not `THERAPIST`
- `404 Not Found` if therapist profile does not exist

---

## List My Sessions (Child Only)

List sessions for the authenticated child.

```/dev/null/http.txt#L1-2
GET /sessions/mine?status=ACTIVE&take=20&skip=0
Authorization: Bearer <access_token>
```

**Query Params**

- `status` (string, optional)
- `take` (number, optional)
- `skip` (number, optional)

**Responses**

- `200 OK` array of sessions with template summary and node counts
- `401 Unauthorized` if token is missing/invalid
- `403 Forbidden` if role is not `CHILD`
- `404 Not Found` if child profile does not exist

---

## Get Session Detail (Therapist or Child)

Fetch full session detail, including nodes and interactions.

```/dev/null/http.txt#L1-2
GET /sessions/{sessionId}
Authorization: Bearer <access_token>
```

**Access Rules**

- Child can access their own sessions.
- Therapist can access sessions for their assigned children.

**Responses**

- `200 OK` with session, template, child info, nodes, and interactions
- `401 Unauthorized` if token is missing/invalid
- `403 Forbidden` if the user does not have access to the session
- `404 Not Found` if session does not exist

---

## Notes

- Session access is enforced on `GET /sessions/{id}` using an access guard.
- Session listing supports pagination with `take` and `skip` capped at `100`.
