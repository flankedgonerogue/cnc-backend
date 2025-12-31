# Quick Start — CNC Backend (NestJS + Prisma)

This guide gets the backend running locally with a Postgres database and Prisma.

---

## Prerequisites

- Node.js 18+ (or 20+)
- npm
- PostgreSQL running locally (or a hosted instance)

---

## 1) Install dependencies

```/dev/null/sh#L1-2
npm install
```

---

## 2) Configure environment

Create a `.env` file in the project root with **required** settings:

```/dev/null/.env#L1-6
# Server
PORT=3000

# Database (required)
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"

# Auth
JWT_SECRET="replace-with-a-long-random-string"
JWT_EXPIRES_IN="7d"

# Google OAuth (optional)
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GOOGLE_CALLBACK_URL="http://localhost:3000/auth/google/callback"
```

> `DATABASE_URL` is **required** and must be set before the app starts.

---

## 3) Generate Prisma client

```/dev/null/sh#L1-1
npm run prisma:generate
```

---

## 4) Run database migrations

If you already have the database created and want to apply the schema:

```/dev/null/sh#L1-1
npm run prisma:migrate
```

This will create the database tables based on `prisma/schema.prisma`.

---

## 5) Start the server

```/dev/null/sh#L1-1
npm run start:dev
```

The API will be available at `http://localhost:3000`.

---

## 6) Quick API check

Register a user:

```/dev/null/sh#L1-4
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123456","role":"GUARDIAN"}'
```

Login:

```/dev/null/sh#L1-4
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123456"}'
```

Get profile (replace `TOKEN`):

```/dev/null/sh#L1-3
curl -X GET http://localhost:3000/auth/profile \
  -H "Authorization: Bearer TOKEN"
```

---

## Common issues

### `DATABASE_URL is required`
Your `.env` is missing `DATABASE_URL` or it’s empty. Fix it and restart the server.

### Prisma client not generated
Run:

```/dev/null/sh#L1-1
npm run prisma:generate
```

### Migration errors
Check your `DATABASE_URL` credentials and that the database exists.

---

## Next steps

- Review API endpoints in the main `README.md`
- Add OAuth credentials if you plan to use Google login
- Run tests as needed
