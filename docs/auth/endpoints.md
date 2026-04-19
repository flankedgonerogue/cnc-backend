# API Reference — Auth + Admin

This document describes **authentication** (REST and GraphQL) and **admin** HTTP endpoints for the CNC Backend. **Story templates** for therapists are GraphQL-only — see `docs/template/endpoints.md`.

## Base URL

- Local: `http://localhost:3000`

## Environment

**Required**

- `DATABASE_URL`
- `JWT_SECRET`

**Common**

- `JWT_EXPIRES_IN` (optional, default `7d`)
- `PORT` (optional, default `3000`)
- `FRONTEND_URL` (optional; used in password-reset emails, default `http://localhost:3000` in code paths — align with your frontend for reset links)
- `BACKEND_URL` (optional; used to build absolute pairing confirmation URL, default `http://localhost:3000`)
- `FRONTEND_SUCCESSFUL_PAIRING_URL` (optional; redirect target after successful child pairing confirmation)
- `FRONTEND_ERROR_URL` (optional; redirect target after failed/expired child pairing confirmation)

**Google OAuth** (optional; required only if you use Google login)

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_CALLBACK_URL` (optional, default `http://localhost:3000/auth/google/callback`)

**Email (password reset)** — configure `SMTP_*` in `.env` so `EmailService` can send reset messages. If SMTP is not configured or sending fails, the API still returns a generic success message (see password reset).

## Authentication model

- Users live in PostgreSQL via Prisma; passwords stored as `passwordHash` (OAuth users have no password).
- Roles: `ADMIN`, `THERAPIST`, `GUARDIAN`, `CHILD`.
- Self-service **registration** allows only **`GUARDIAN`** or **`CHILD`** (`THERAPIST` / `ADMIN` are rejected).
- Registering as **`CHILD`** requires `therapistEmail` pointing at an existing therapist user with a therapist profile.
- OAuth users without a role must call **`POST /auth/oauth/role`** (or GraphQL `setOAuthRole`) once; allowed values are **`GUARDIAN`** or **`CHILD`** only.
- Deactivated users (`deletedAt` set) cannot authenticate.
- Template operations (GraphQL) are restricted to **`THERAPIST`** and ownership rules where applicable.

---

# Auth — REST (`/auth`)

Unless noted, send `Content-Type: application/json` for bodies.

## Register

`POST /auth/register`

Creates a user with email and password. Returns a JWT and user payload.

```http
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "test123456",
  "role": "GUARDIAN",
  "firstName": "Optional",
  "lastName": "Optional"
}
```

**Body fields**

| Field | Required | Notes |
|-------|----------|--------|
| `email` | yes | Valid email |
| `password` | yes | Min length **6** |
| `role` | yes | **`GUARDIAN`** or **`CHILD`** only |
| `firstName`, `lastName` | no | Strings |
| `therapistEmail` | required if `role` is **`CHILD`** | Must match a user who has a **therapist profile** |

**Responses**

- `201 Created` — `{ access_token, user }` (`user` has no `passwordHash`)
- `400 Bad Request` — validation failure; or child registration without therapist / invalid therapist
- `401 Unauthorized` — `role` is `THERAPIST` or `ADMIN`
- `404 Not Found` — `therapistEmail` does not resolve to a therapist (child flow)
- `409 Conflict` — email already registered (password or Google-only messaging in the error detail)

---

## Login

`POST /auth/login`

Uses **Local** strategy: credentials validated before handler runs.

```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "test123456"
}
```

**Responses**

- `200 OK` — `{ access_token, user }`
- `401 Unauthorized` — wrong password; deactivated account; or **OAuth-only** account (“use Google to sign in”)

---

## Profile (protected)

`GET /auth/profile`

```http
GET /auth/profile
Authorization: Bearer <access_token>
```

**Responses**

- `200 OK` — current user (sanitized)
- `401 Unauthorized` — missing/invalid JWT, or user not found

---

## Verify token (protected)

`GET /auth/verify`

```http
GET /auth/verify
Authorization: Bearer <access_token>
```

**Responses**

- `200 OK` — `{ valid: true, user }`
- `401 Unauthorized` — missing/invalid JWT

---

## Google OAuth

### Start flow

`GET /auth/google`

Redirects to Google (no JSON body). Requires Google OAuth env vars.

### Callback

`GET /auth/google/callback`

**Responses**

- **302 Redirect** — redirects to `${FRONTEND_URL}/auth/callback` with a URL fragment containing:
  - `access_token`
  - `isNew`
  - `roleRequired`
- `200 OK` — `{ access_token, user, isNew, roleRequired, message }` when `FRONTEND_URL` is not set
- `401 Unauthorized` — e.g. deactivated user

---

## OAuth role initialization (protected)

`POST /auth/oauth/role`

One-time role assignment for OAuth users. **`GUARDIAN`** or **`CHILD`** only.
Creates the matching profile:
- `GUARDIAN` -> creates `guardianProfile`
- `CHILD` -> creates `childProfile` (requires therapist link)

```http
POST /auth/oauth/role
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "role": "CHILD",
  "therapistEmail": "therapist@example.com"
}
```

`therapistEmail` is required when `role` is `CHILD` and must resolve to an existing therapist account with a therapist profile.

**Responses**

- `200 OK` — updated user
- `401 Unauthorized` — cannot assign `THERAPIST` or `ADMIN`; invalid/missing JWT
- `409 Conflict` — role was already set for this user

---

## Password reset — request

`POST /auth/password-reset/request`

Always returns the same generic message whether or not the email exists (no enumeration). Only users with a **password** (`passwordHash`) receive a token email when SMTP works.

```http
POST /auth/password-reset/request
Content-Type: application/json

{
  "email": "user@example.com"
}
```

**Responses**

- `200 OK` — `{ message }` (generic success text)

---

## Password reset — validate token

`POST /auth/password-reset/validate`

Check whether a raw token from the email link is still valid (not consumed; not expired).

```http
POST /auth/password-reset/validate
Content-Type: application/json

{
  "token": "<token-from-email>"
}
```

**Responses**

- `200 OK` — `{ valid: boolean }` (GraphQL may expose additional fields per schema)

---

## Password reset — confirm

`POST /auth/password-reset/confirm`

```http
POST /auth/password-reset/confirm
Content-Type: application/json

{
  "token": "<token-from-email>",
  "password": "new-secret-8-chars-min"
}
```

`password` must be at least **8** characters.

**Responses**

- `200 OK` — `{ message }` on success
- `400 Bad Request` — invalid/expired token, expired link, or password too short

---

# Auth — GraphQL (`POST /graphql`)

Same business logic as REST; use `Authorization: Bearer <access_token>` for protected operations.

| Operation | Kind | Arguments / inputs |
|-----------|------|-------------------|
| `register` | Mutation | `registerInput`: email, password, role, optional names, optional `therapistEmail` for `CHILD` |
| `login` | Mutation | `loginInput`: email, password |
| `profile` | Query | — (JWT) |
| `verifyToken` | Query | — (JWT) |
| `setOAuthRole` | Mutation | `setRoleInput`: `role` (`GUARDIAN` \| `CHILD`) (JWT); same errors as REST |
| `requestPasswordReset` | Mutation | `requestInput`: `email` |
| `validateResetToken` | Mutation | `validateInput`: `token` |
| `resetPassword` | Mutation | `resetInput`: `token`, `password` |

Response types include `AuthResponse` (`access_token`, `user`), `VerifyResponse`, `PasswordResetResponse`, `ValidateResetTokenResponse`, and `User` where applicable. See `src/auth/dto/auth.type.ts` and `src/auth/auth.resolver.ts`.

---

# User management — Guardian/Child pairing

## Guardian creates a new child (GraphQL)

`addChild(createChildInput: CreateChildInput!)`

`CreateChildInput` requires:
- `email`
- `password`
- `therapistEmail` (must map to an existing therapist profile)
- optional names

This creates:
- child `User` (`role: CHILD`)
- linked `ChildProfile`
- `guardianId` set to current guardian profile

## Guardian lists linked children (GraphQL)

`myChildrenForGuardian: [User!]!`

Returns all child users currently linked to the authenticated guardian.

## Guardian requests pairing to existing child account (GraphQL)

`requestChildPairing(requestChildPairingInput: RequestChildPairingInput!): PairingRequestResponse!`

Input:
- `childEmail`

Behavior:
- Creates a secure, expiring backend pairing request
- Sends a pairing email to the child account email containing a confirmation URL

## Pairing confirmation callback (REST)

`GET /users/pairing/confirm?token=<pairing-token>`

Behavior:
- validates token and expiry
- on success, links the child profile to guardian profile
- redirects to:
  - `FRONTEND_SUCCESSFUL_PAIRING_URL` (success)
  - `FRONTEND_ERROR_URL` (error/expired/invalid)

---

## Story templates (therapist, GraphQL)

Therapists manage story templates only via GraphQL. See **`docs/template/endpoints.md`** for `templates`, `template`, `createTemplate`, `updateTemplate`, `removeTemplate`, `visualStyle`, and ownership rules.

---

# Admin — REST (`/admin`)

All routes require:

- `Authorization: Bearer <access_token>`
- Role: **`ADMIN`**

## Create therapist

`POST /admin/therapists`

```http
POST /admin/therapists
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "email": "therapist@example.com",
  "password": "strong-password",
  "firstName": "Jane",
  "lastName": "Doe",
  "clinicName": "Bright Minds Clinic",
  "licenseNumber": "LIC-12345",
  "specialization": "Behavioral Therapy",
  "bio": "Clinician bio",
  "interventionThreshold": 0.6
}
```

**Responses**

- `201 Created` — therapist summary
- `401 Unauthorized` / `403 Forbidden` — auth/role
- `409 Conflict` — email or license already in use

---

## List therapists

`GET /admin/therapists`

**Responses**

- `200 OK` — array of therapist summaries (includes `activeChildCount` where implemented)
- `401` / `403` — as above

---

## Deprovision therapist

`DELETE /admin/therapists/{therapistUserId}`

Soft-deletes the therapist user (`deletedAt`).

**Responses**

- `204 No Content`
- `404 Not Found` — user not found
- `401` / `403` — as above

---

## Reprovision therapist

`POST /admin/therapists/{therapistUserId}/reprovision`

Clears `deletedAt` for a soft-deleted therapist.

**Responses**

- `200 OK` — e.g. `{ userId, deletedAt: null }`
- `404 Not Found` — therapist missing
- `401` / `403` — as above

---

## System stats

`GET /admin/stats`

**Responses**

- `200 OK` — KPI summary
- `401` / `403` — as above

---

## Common errors (summary)

| Code | Typical cases |
|------|----------------|
| `400` | Validation errors; invalid/expired password-reset token; child registration without valid therapist |
| `401` | Bad login; OAuth-only user on password login; deactivated user; missing/invalid JWT; registering as `THERAPIST`/`ADMIN`; OAuth role set to `THERAPIST`/`ADMIN` |
| `403` | Admin-only routes when role is not `ADMIN` |
| `404` | Child registration when therapist email not found |
| `409` | Email already registered on sign-up; duplicate therapist email/license on admin create; OAuth role already set |
