# Authentication API Endpoints

This document describes the current authentication endpoints for the CNC Backend.

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

---

## Endpoints

### Register

Create a new user with email + password.

```
POST /auth/register
```

**Request Body**

- `email` (string, required, valid email)
- `password` (string, required, min length 6)
- `role` (string, required, one of `GUARDIAN` or `CHILD`)

**Example**

```
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

### Login

Authenticate with email + password.

```
POST /auth/login
```

**Request Body**

- `email` (string, required)
- `password` (string, required)

**Example**

```
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

### Profile (Protected)

Fetch the current user profile.

```
GET /auth/profile
```

**Headers**

- `Authorization: Bearer <access_token>`

**Responses**

- `200 OK` with user data
- `401 Unauthorized` if token is missing/invalid

---

### Verify Token (Protected)

Validate the JWT and echo the user payload.

```
GET /auth/verify
```

**Headers**

- `Authorization: Bearer <access_token>`

**Responses**

- `200 OK` with `{ valid: true, user }`
- `401 Unauthorized` if token is missing/invalid

---

### Google OAuth Initiation

Start the Google OAuth flow.

```
GET /auth/google
```

- Redirects the user to Google’s consent screen.

---

### Google OAuth Callback

Handle the OAuth callback.

```
GET /auth/google/callback
```

**Response**

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

### OAuth Role Initialization (Protected)

Set role for OAuth users once.

```
POST /auth/oauth/role
```

**Headers**

- `Authorization: Bearer <access_token>`

**Request Body**

- `role` (string, required, `GUARDIAN` or `CHILD`)

**Responses**

- `200 OK` with updated user
- `400/401` if role is invalid or already set
- `401 Unauthorized` if role is `THERAPIST`

---

## Response Shape

All successful auth responses return:

- `access_token` (string)
- `user` (object without `passwordHash`)

User fields:

- `id` (string)
- `email` (string)
- `role` (optional)
- `createdAt` (Date)
- `updatedAt` (Date)

---

## Common Errors

- `401 Unauthorized`:
  - Invalid credentials
  - OAuth-only account attempting password login
  - Invalid or missing JWT
  - Attempt to set `THERAPIST` role via these endpoints
- `409 Conflict`:
  - Email already registered