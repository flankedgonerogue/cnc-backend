# CNC Backend Documentation

This directory contains the current, actively maintained guides for the backend service.

## Guides

- **Quick Start** (`QUICK_START.md`)
  Get the API running locally, configure environment variables, and smoke‑test the auth flows.

- **Auth + Admin API Guide** (`auth/endpoints.md`)
  Authentication (REST and GraphQL): register, login, OAuth, password reset, JWT verification; admin therapist provisioning and stats.

- **Template API Guide** (`template/endpoints.md`)
  GraphQL reference for therapist story templates, including `visualStyle` and ownership rules.

- **Story API Guide** (`story/endpoints.md`)
  Start / continue / restart story and session analytics (GraphQL), roles, and examples.

- **Session API Guide** (`session/endpoints.md`)
  Session and child profile endpoints, request/response examples, and access rules.

- **Therapist analytics (GraphQL)** (`analytics/endpoints.md`)
  Cross-session dashboard query: trends per child, template effectiveness, week/month windows.

## Suggested Reading Order

1. `QUICK_START.md`
2. `auth/endpoints.md`
3. `template/endpoints.md` (if you use therapist templates)
4. `story/endpoints.md`
5. `session/endpoints.md`
6. `analytics/endpoints.md` (therapist dashboards)

## Notes

If you are looking for historical or implementation‑detail writeups, those have been removed to keep the docs focused and current. If you need any of that material restored or rewritten, tell me which sections you want back.
