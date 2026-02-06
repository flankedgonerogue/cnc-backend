# API Endpoints — Story

This document describes the story generation endpoints for the CNC Backend.

## Base URL

- Local: `http://localhost:3000`

## Authentication & Access

All story endpoints require:

- `Authorization: Bearer <access_token>`
- Roles: `THERAPIST` or `CHILD`

Access rules:

- A **child** can access their own sessions.
- A **therapist** can access sessions for children assigned to them.
- Requests are rejected when a session is not `ACTIVE`.

---

# Story Endpoints

## Start Story (Protected)

Generate the opening story node for a session.

```/dev/null/http.txt#L1-9
POST /story/start
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "sessionId": "sess_123",
  "childName": "Avery",
  "childAge": 7
}
```

**Request Body**

- `sessionId` (string, required, min length 1)
- `childName` (string, required, min length 1, max length 50)
- `childAge` (integer, required, min 3, max 18)

**Responses**

- `201 Created` with the initial story node, including choices
- `400 Bad Request`
  - Session is not active
  - Session has already been started
- `401 Unauthorized` if token is missing/invalid
- `403 Forbidden` if the user does not have access to the session
- `404 Not Found` if the session does not exist

**Response Shape (Example)**

```/dev/null/http.txt#L1-16
{
  "sessionId": "sess_123",
  "node": {
    "id": "node_1",
    "textContent": "Once upon a time...",
    "imageUrl": "https://cdn.example.com/story-images/...",
    "audioUrl": "https://cdn.example.com/story-audio/...",
    "confidenceScore": 0.98,
    "choices": [
      { "id": "choice_1", "text": "Say hello", "behavioralTag": "GREETING" },
      { "id": "choice_2", "text": "Look around", "behavioralTag": "CURIOSITY" }
    ]
  }
}
```

---

## Continue Story (Protected)

Advance the story by submitting a choice for the current node.

```/dev/null/http.txt#L1-9
POST /story/continue
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "sessionId": "sess_123",
  "choiceId": "choice_1",
  "timeTakenMs": 1400
}
```

**Request Body**

- `sessionId` (string, required, min length 1)
- `choiceId` (string, required, min length 1)
- `timeTakenMs` (integer, required, min 0)

**Responses**

- `200 OK` with the next story node
- `400 Bad Request`
  - Session is not active
  - Session is currently processing another request
  - Choice does not belong to the current story node
- `401 Unauthorized` if token is missing/invalid
- `403 Forbidden` if the user does not have access to the session
- `404 Not Found` if the choice does not exist

**Response Shape (Example)**

```/dev/null/http.txt#L1-17
{
  "sessionId": "sess_123",
  "isEnding": false,
  "node": {
    "id": "node_2",
    "textContent": "Avery smiles and waves back.",
    "imageUrl": "https://cdn.example.com/story-images/...",
    "audioUrl": "https://cdn.example.com/story-audio/...",
    "confidenceScore": 0.95,
    "choices": [
      { "id": "choice_3", "text": "Ask to play", "behavioralTag": "INITIATION" },
      { "id": "choice_4", "text": "Wait quietly", "behavioralTag": "SELF_REGULATION" }
    ]
  }
}
```

If `isEnding` is `true`, the story has concluded and `choices` will be empty or omitted.

---

## Notes

- These endpoints generate story nodes using LLM + safety gating.
- Image and audio generation run asynchronously during story generation and may return `null` if unavailable.
- Continuing a story records an interaction event with `timeTakenMs`.
