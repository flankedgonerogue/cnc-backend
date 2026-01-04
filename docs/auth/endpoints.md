# API Endpoints — Auth + Templates

This document describes the authentication and social story template endpoints for the CNC Backend.

## Base URL

- Local: `http://localhost:3000`

## Environment

Required at runtime:

- `DATABASE_URL` (required)
- `JWT_SECRET` (required)
- `JWT_EXPIRES_IN` (optional, default `7d`)
- `GOOGLE_CLIENT_ID` (optional, required for Google login)
- `GOOGLE_CLIENT_SECRET` (optional, required for Google login)
- `GOOGLE_CALLBACK_URL` (optional, default `http://localhost:3000/auth/google/callback`)

## Authentication Model

- Users are stored in PostgreSQL via Prisma.
- Passwords are stored as `passwordHash`.
- OAuth users have no `passwordHash`.
- Roles are `GUARDIAN`, `CHILD`, or `THERAPIST`.
- Role initialization for OAuth users only allows `GUARDIAN` or `CHILD`.
- Template routes are restricted to `THERAPIST` users and protected by ownership checks.

---

# Auth Endpoints

## Register

Create a new user with email + password.

```/dev/null/http.txt#L1-8
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "test123456",
  "role": "GUARDIAN"
}
```

**Responses**
- `201 Created` with `access_token` and `user`
- `409 Conflict` if email already exists
- `401 Unauthorized` if role is `THERAPIST`

---

## Login

Authenticate with email + password.

```/dev/null/http.txt#L1-7
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "test123456"
}
```

**Responses**
- `200 OK` with `access_token` and `user`
- `401 Unauthorized` if credentials are invalid
- `401 Unauthorized` if the account is OAuth-only (no password set)

---

## Profile (Protected)

Fetch the current user profile.

```/dev/null/http.txt#L1-3
GET /auth/profile
Authorization: Bearer <access_token>
```

**Responses**
- `200 OK` with user data
- `401 Unauthorized` if token is missing/invalid

---

## Verify Token (Protected)

Validate the JWT and echo the user payload.

```/dev/null/http.txt#L1-3
GET /auth/verify
Authorization: Bearer <access_token>
```

**Responses**
- `200 OK` with `{ valid: true, user }`
- `401 Unauthorized` if token is missing/invalid

---

## Google OAuth Initiation

Start the Google OAuth flow.

```/dev/null/http.txt#L1-1
GET /auth/google
```

**Behavior**
- Redirects the user to Google’s consent screen.

---

## Google OAuth Callback

Handle the OAuth callback.

```/dev/null/http.txt#L1-1
GET /auth/google/callback
```

**Responses**
- `200 OK` with:
  - `access_token`
  - `user`
  - `isNew` (boolean)
  - `roleRequired` (boolean, true if role is not set)
  - `message`

**Notes**
- If the email exists with a password, login is rejected.
- If the user is new, a record is created without a password.

---

## OAuth Role Initialization (Protected)

Set role for OAuth users once.

```/dev/null/http.txt#L1-7
POST /auth/oauth/role
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "role": "CHILD"
}
```

**Responses**
- `200 OK` with updated user
- `400/401` if role is invalid or already set
- `401 Unauthorized` if role is `THERAPIST`

---

# Templates Endpoints (Therapist Only)

All template endpoints require:
- `Authorization: Bearer <access_token>`
- Role: `THERAPIST`
- Ownership enforced per `templateId`

## Create Template

```/dev/null/http.txt#L1-10
POST /templates
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "targetBehavior": "Turn-taking",
  "setting": "Playground",
  "characterDetails": "Two kids sharing a ball",
  "emotionalTone": "CALM",
  "promptSuggestion": "Keep it short"
}
```

**Responses**
- `201 Created` with template record
- `401 Unauthorized` if token is missing/invalid
- `403 Forbidden` if role is not `THERAPIST`

---

## List Templates

Supports basic pagination via `take` and `skip`.

```/dev/null/http.txt#L1-1
GET /templates?take=20&skip=0
```

**Responses**
- `200 OK` array of templates belonging to the therapist
- `401 Unauthorized` if token is missing/invalid
- `403 Forbidden` if role is not `THERAPIST`

---

## Get Template (Ownership Protected)

```/dev/null/http.txt#L1-1
GET /templates/{templateId}
```

**Responses**
- `200 OK` with template record
- `401 Unauthorized` if token is missing/invalid
- `403 Forbidden` if not the owner
- `404 Not Found` if template does not exist

---

## Update Template (Ownership Protected)

```/dev/null/http.txt#L1-9
PATCH /templates/{templateId}
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "targetBehavior": "Updated behavior"
}
```

**Responses**
- `200 OK` with updated template record
- `401 Unauthorized` if token is missing/invalid
- `403 Forbidden` if not the owner
- `404 Not Found` if template does not exist

---

## Delete Template (Ownership Protected, Soft Delete)

```/dev/null/http.txt#L1-2
DELETE /templates/{templateId}
Authorization: Bearer <access_token>
```

**Responses**
- `204 No Content`
- `401 Unauthorized` if token is missing/invalid
- `403 Forbidden` if not the owner
- `404 Not Found` if template does not exist

---

## Template Fields

- `targetBehavior` (string, min 3, max 100)
- `setting` (string, max 200)
- `characterDetails` (string, max 500)
- `emotionalTone` (enum: `CALM`, `ENCOURAGING`, `PLAYFUL`, `EMPATHETIC`, `NEUTRAL`)
- `promptSuggestion` (string, max 500)

---

## Common Errors

- `401 Unauthorized`:
  - Invalid credentials
  - OAuth-only account attempting password login
  - Invalid or missing JWT
  - Attempt to set `THERAPIST` role via auth endpoints
- `403 Forbidden`:
  - Non-therapist attempting template routes
  - Ownership violations (IDOR protection)
- `409 Conflict`:
  - Email already registered
