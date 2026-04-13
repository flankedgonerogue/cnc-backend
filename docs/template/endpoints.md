# API Specification — Template Management (GraphQL)

This document describes the **GraphQL** API for social story **templates** in the CNC Backend. Templates belong to the authenticated therapist and are soft-deleted (not returned once `deletedAt` is set).

## Base URL

- Local: `http://localhost:3000`

## Authentication & Authorization

All template operations require:

- `Authorization: Bearer <access_token>`
- Role: **`THERAPIST`**

Operations that target a single template by id (`template` query, `updateTemplate`, `removeTemplate`) enforce **ownership** via `TemplateOwnershipGuard`: the template must exist, not be soft-deleted, and belong to the therapist linked to the JWT user. Failure surfaces as a GraphQL error with a **forbidden** style message (including when the id does not exist or is not owned), not a “not found” split.

### `visualStyle`

Optional text (max **500** characters) on create and update. It is **persisted** in the database. If omitted on **create**, the server uses the Prisma default (`disney-pixar aesthetic`). Values are sanitized (script tags stripped, control characters removed, trimmed) like other string fields. Empty or whitespace-only input is treated as omitted on create; on partial update it does not overwrite the existing value.

---

# GraphQL

- **Endpoint:** `POST /graphql`
- **Auth:** `Authorization: Bearer <access_token>`
- **Role:** `THERAPIST` on the template resolver

## Types (conceptual)

```graphql
enum StoryTone {
  CALM
  ENCOURAGING
  PLAYFUL
  EMPATHETIC
  NEUTRAL
}

type Template {
  id: ID!
  therapistId: String!
  targetBehavior: String!
  setting: String!
  mainCharacter: String!
  emotionalTone: StoryTone!
  promptSuggestion: String!
  visualStyle: String!
  createdAt: DateTime!
  updatedAt: DateTime!
  deletedAt: DateTime
}

input CreateTemplateDto {
  targetBehavior: String!
  setting: String!
  mainCharacter: String!
  emotionalTone: StoryTone!
  promptSuggestion: String!
  visualStyle: String
}

input UpdateTemplateDto {
  targetBehavior: String
  setting: String
  mainCharacter: String
  emotionalTone: StoryTone
  promptSuggestion: String
  visualStyle: String
}
```

## Queries

### `templates(take: Int, skip: Int): [Template!]!`

Lists the current therapist’s templates. Pagination: `take` is clamped **1–100**, `skip` is **≥ 0**; service defaults apply when arguments are omitted.

**Example**

```graphql
query GetTemplates($take: Int, $skip: Int) {
  templates(take: $take, skip: $skip) {
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
}
```

### `template(id: ID!): Template!`

Returns one template; protected by the ownership guard.

**Example**

```graphql
query GetTemplate($id: ID!) {
  template(id: $id) {
    id
    therapistId
    targetBehavior
    setting
    mainCharacter
    emotionalTone
    promptSuggestion
    visualStyle
    createdAt
    updatedAt
    deletedAt
  }
}
```

## Mutations

### `createTemplate(createTemplateInput: CreateTemplateDto!): Template!`

Creates a template for the authenticated therapist.

### `updateTemplate(id: ID!, updateTemplateInput: UpdateTemplateDto!): Template!`

Updates a template (ownership required).

### `removeTemplate(id: ID!): Boolean!`

Soft-deletes the template; returns `true` on success (ownership required).

**Example — create**

```graphql
mutation CreateTemplate($input: CreateTemplateDto!) {
  createTemplate(createTemplateInput: $input) {
    id
    targetBehavior
    emotionalTone
    createdAt
  }
}
```

**Variables**

```json
{
  "input": {
    "targetBehavior": "Turn-taking",
    "setting": "Playground",
    "mainCharacter": "Two kids sharing a ball",
    "emotionalTone": "CALM",
    "promptSuggestion": "Keep it short",
    "visualStyle": "Soft watercolor, warm palette"
  }
}
```

`visualStyle` may be omitted; when present it is persisted.

---

## Errors

Typical failure modes map to GraphQL `errors` (often HTTP **200** with an `errors` array, or **400** depending on the client and error type):

| Situation | Notes |
|-----------|--------|
| Validation | Invalid input (e.g. class-validator) |
| Unauthenticated | Missing or invalid JWT |
| Wrong role | Not `THERAPIST` |
| Ownership / access | Template id not accessible (guard); therapist profile missing on create may surface as a not-found style error from the service |

Treat transport status codes and `errors[].extensions` per your Apollo / NestJS GraphQL setup.
