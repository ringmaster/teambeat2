# Teambeat Public API v1 — Specification

Version: 1.0  
Base path: `/api/v1`  
Content-Type: `application/json`

---

## Authentication

Every v1 endpoint accepts one of two credential types:

### Bearer Token (primary — for AI/programmatic clients)

```
Authorization: Bearer tb_<64-hex-chars>
```

Tokens are created on the profile page. A token is a cryptographically random 256-bit value
prefixed with `tb_`. The server stores only its SHA-256 hash; the raw token is shown **once**
at creation and cannot be retrieved again.

Default token lifetime: **90 days** from creation.

### Session Cookie (secondary — browser clients)

The existing `session` cookie is also accepted on all v1 routes, so the browser UI can call
the same endpoints without needing a token.

### Error response when unauthenticated

```json
HTTP 401
{ "success": false, "error": "Unauthorized" }
```

---

## Token Management

### `GET /api/v1/tokens`

List all active API tokens for the authenticated user. Token hashes are **never** returned.

**Response 200**
```json
{
  "success": true,
  "tokens": [
    {
      "id": "uuid",
      "label": "My AI integration",
      "expiresAt": 1780000000000,
      "lastUsedAt": 1770000000000,
      "createdAt": 1750000000000
    }
  ]
}
```

---

### `POST /api/v1/tokens`

Create a new API token. The `token` field in the response is the **only time** the raw token
is available.

**Request body**
```json
{ "label": "My AI integration" }
```

| Field   | Type   | Required | Constraints          |
|---------|--------|----------|----------------------|
| `label` | string | yes      | 1–100 characters     |

**Response 201**
```json
{
  "success": true,
  "token": "tb_a3f2b1c4...",
  "tokenInfo": {
    "id": "uuid",
    "label": "My AI integration",
    "expiresAt": 1780000000000,
    "createdAt": 1750000000000
  }
}
```

**Errors**

| Status | Error                        | Cause                          |
|--------|------------------------------|--------------------------------|
| 400    | `"label is required"`        | Missing or empty label         |
| 400    | `"Invalid input"`            | Label >100 chars               |

---

### `DELETE /api/v1/tokens/:id`

Revoke a token immediately. Only the token owner can revoke it.

**Response 200**
```json
{ "success": true }
```

**Errors**

| Status | Error              | Cause                                   |
|--------|--------------------|-----------------------------------------|
| 404    | `"Token not found"` | ID doesn't exist or belongs to another user |

---

## Series

### `GET /api/v1/series`

List all series the authenticated user is a member of.

**Response 200**
```json
{
  "success": true,
  "series": [
    {
      "id": "uuid",
      "name": "Engineering Retrospectives",
      "slug": "eng-retros",
      "description": "Bi-weekly retros for the eng team",
      "role": "admin",
      "createdAt": "2026-01-01T00:00:00.000Z"
    }
  ]
}
```

---

### `GET /api/v1/series/:id/boards`

List boards in a series. Returns boards ordered by `meetingDate` descending (most recent first),
falling back to `createdAt`.

**Query parameters**

| Param    | Type   | Default | Description                                       |
|----------|--------|---------|---------------------------------------------------|
| `status` | string | all     | Filter by status: `draft`, `active`, `completed`, `archived` |
| `limit`  | number | 20      | Max results (1–100)                               |
| `offset` | number | 0       | Pagination offset                                 |

**Response 200**
```json
{
  "success": true,
  "boards": [
    {
      "id": "uuid",
      "name": "Sprint 42 Retro",
      "status": "completed",
      "meetingDate": "2026-06-01",
      "createdAt": "2026-05-30T10:00:00.000Z",
      "sceneCount": 4,
      "cardCount": 27,
      "agreementCount": 5
    }
  ],
  "meta": { "total": 42, "limit": 20, "offset": 0 }
}
```

**Errors**

| Status | Error               | Cause                              |
|--------|---------------------|------------------------------------|
| 403    | `"Access denied"`   | User is not a member of the series |
| 404    | `"Series not found"`| Series ID does not exist           |

---

### `POST /api/v1/series/:id/boards`

Create a new board in the series with an optional full structure (scenes, columns, seed cards).
All sub-resources are created atomically; if any fail the whole operation rolls back.

**Request body**
```json
{
  "name": "Sprint 43 Retro",
  "meetingDate": "2026-06-15",
  "blameFreeMode": false,
  "votingAllocation": 3,
  "columns": [
    { "title": "What went well",    "seq": 1 },
    { "title": "What needs work",   "seq": 2 },
    { "title": "Shout-outs",        "seq": 3 }
  ],
  "scenes": [
    { "title": "Collect",  "mode": "columns",    "seq": 1, "flags": ["allow_add_cards", "allow_edit_cards"] },
    { "title": "Vote",     "mode": "columns",    "seq": 2, "flags": ["allow_voting", "show_votes"] },
    { "title": "Discuss",  "mode": "review",     "seq": 3 },
    { "title": "Actions",  "mode": "agreements", "seq": 4 }
  ],
  "cards": [
    { "columnTitle": "What went well", "content": "Deployed on time" },
    { "columnTitle": "What needs work", "content": "Test coverage gaps" }
  ]
}
```

| Field              | Type    | Required | Constraints                               |
|--------------------|---------|----------|-------------------------------------------|
| `name`             | string  | yes      | 1–100 chars                               |
| `meetingDate`      | string  | no       | ISO date `YYYY-MM-DD`                     |
| `blameFreeMode`    | boolean | no       | Default `false`                           |
| `votingAllocation` | number  | no       | Integer 0–10, default 3                   |
| `columns`          | array   | no       | Up to 20 columns                          |
| `columns[].title`  | string  | yes      | 1–100 chars                               |
| `columns[].seq`    | number  | no       | Auto-assigned if omitted                  |
| `scenes`           | array   | no       | Up to 20 scenes                           |
| `scenes[].title`   | string  | yes      | 1–100 chars                               |
| `scenes[].mode`    | string  | yes      | `columns`, `present`, `review`, `agreements`, `scorecard`, `static`, `survey`, `quadrant` |
| `scenes[].seq`     | number  | no       | Auto-assigned if omitted                  |
| `scenes[].flags`   | array   | no       | Scene capability flags                    |
| `cards`            | array   | no       | Seed cards; require at least one column   |
| `cards[].columnTitle` | string | yes   | Must match a column title in this request |
| `cards[].content`  | string  | yes      | 1–2000 chars                              |

**Scene flags** (any subset):
`allow_add_cards`, `allow_edit_cards`, `allow_obscure_cards`, `allow_move_cards`,
`allow_group_cards`, `show_votes`, `allow_voting`, `show_comments`, `allow_comments`,
`multiple_votes_per_card`

**Response 201**
```json
{
  "success": true,
  "board": {
    "id": "uuid",
    "name": "Sprint 43 Retro",
    "status": "draft",
    "meetingDate": "2026-06-15",
    "columns": [ { "id": "uuid", "title": "What went well", "seq": 1 } ],
    "scenes": [ { "id": "uuid", "title": "Collect", "mode": "columns", "seq": 1, "flags": ["allow_add_cards"] } ],
    "cards": [ { "id": "uuid", "columnId": "uuid", "content": "Deployed on time" } ],
    "createdAt": "2026-06-10T00:00:00.000Z"
  }
}
```

**Errors**

| Status | Error                                     | Cause                                |
|--------|-------------------------------------------|--------------------------------------|
| 400    | `"Invalid input"`                         | Zod validation failure               |
| 400    | `"Card references unknown column: '...'"` | columnTitle doesn't match any column |
| 403    | `"Access denied"`                         | User not a series member             |
| 404    | `"Series not found"`                      | Series ID does not exist             |

---

### `GET /api/v1/series/:id/agreements`

All action items across every board in the series.

**Query parameters**

| Param       | Type    | Default | Description                         |
|-------------|---------|---------|-------------------------------------|
| `completed` | boolean | all     | `true` / `false` to filter by state |
| `limit`     | number  | 50      | Max results (1–200)                 |
| `offset`    | number  | 0       | Pagination offset                   |

**Response 200**
```json
{
  "success": true,
  "agreements": [
    {
      "id": "uuid",
      "content": "Add integration tests for auth flow",
      "completed": false,
      "boardId": "uuid",
      "boardName": "Sprint 42 Retro",
      "meetingDate": "2026-06-01",
      "createdAt": "2026-06-01T15:30:00.000Z",
      "completedAt": null,
      "completedByName": null
    }
  ],
  "meta": { "total": 12, "limit": 50, "offset": 0 }
}
```

---

### `GET /api/v1/series/:id/health-summary`

Time-series view of survey (health check) responses across all boards in the series.
Questions are grouped by `threadId` so longitudinal tracking is possible even across boards.

**Query parameters**

| Param      | Type   | Default | Description                               |
|------------|--------|---------|-------------------------------------------|
| `limit`    | number | 10      | Number of most-recent boards to include   |

**Response 200**
```json
{
  "success": true,
  "series": { "id": "uuid", "name": "Engineering Retrospectives" },
  "questions": [
    {
      "threadId": "some-thread-id",
      "question": "How is team morale?",
      "questionType": "range1to5",
      "history": [
        {
          "boardId": "uuid",
          "boardName": "Sprint 42 Retro",
          "meetingDate": "2026-06-01",
          "avgRating": 3.8,
          "responseCount": 6,
          "distribution": { "1": 0, "2": 1, "3": 1, "4": 3, "5": 1 }
        }
      ]
    }
  ]
}
```

---

## Boards

### `GET /api/v1/boards/:id`

Full board detail including all scenes, columns, cards (with vote counts), and comments.

**Response 200**
```json
{
  "success": true,
  "board": {
    "id": "uuid",
    "seriesId": "uuid",
    "name": "Sprint 42 Retro",
    "status": "completed",
    "meetingDate": "2026-06-01",
    "blameFreeMode": false,
    "votingAllocation": 3,
    "currentSceneId": "uuid",
    "columns": [
      { "id": "uuid", "title": "What went well", "seq": 1 }
    ],
    "scenes": [
      {
        "id": "uuid",
        "title": "Collect",
        "mode": "columns",
        "seq": 1,
        "flags": ["allow_add_cards", "allow_edit_cards"]
      }
    ],
    "cards": [
      {
        "id": "uuid",
        "columnId": "uuid",
        "content": "Deployed on time",
        "voteCount": 4,
        "commentCount": 2,
        "groupId": null,
        "createdAt": "2026-06-01T10:00:00.000Z"
      }
    ],
    "createdAt": "2026-05-30T10:00:00.000Z"
  }
}
```

**Errors**

| Status | Error               | Cause                                |
|--------|---------------------|--------------------------------------|
| 403    | `"Access denied"`   | User not a member of the board's series |
| 404    | `"Board not found"` | Board ID does not exist              |

---

### `GET /api/v1/boards/:id/cards`

All cards in a board with vote counts, comment counts, and group info.

**Response 200**
```json
{
  "success": true,
  "cards": [
    {
      "id": "uuid",
      "columnId": "uuid",
      "columnTitle": "What went well",
      "content": "Deployed on time",
      "notes": null,
      "voteCount": 4,
      "commentCount": 2,
      "groupId": null,
      "isGroupLead": false,
      "seq": 1,
      "createdAt": "2026-06-01T10:00:00.000Z"
    }
  ]
}
```

---

### `GET /api/v1/boards/:id/agreements`

Action items for a single board.

**Query parameters**

| Param       | Type    | Default | Description                         |
|-------------|---------|---------|-------------------------------------|
| `completed` | boolean | all     | Filter by completion state          |

**Response 200**
```json
{
  "success": true,
  "agreements": [
    {
      "id": "uuid",
      "content": "Add integration tests",
      "completed": false,
      "createdAt": "2026-06-01T15:30:00.000Z",
      "completedAt": null,
      "completedByName": null
    }
  ]
}
```

---

### `GET /api/v1/boards/:id/scorecard-results`

All processed scorecard results attached to scenes in this board.

**Response 200**
```json
{
  "success": true,
  "results": [
    {
      "sceneScorecardId": "uuid",
      "sceneId": "uuid",
      "sceneTitle": "Data Review",
      "scorecardName": "Sprint Metrics",
      "datasourceName": "Velocity",
      "section": "Delivery",
      "title": "Velocity trending down 3 sprints",
      "primaryValue": "-18%",
      "secondaryValues": { "current": "35", "previous": "43" },
      "severity": "warning",
      "seq": 1
    }
  ]
}
```

---

## AI Datasource Injection

### `POST /api/v1/datasources/:id/inject`

Push pre-processed scorecard results into a datasource. Intended for AI clients that analyze
data externally and push findings for display in the next board meeting. Requires the
datasource's `sourceType` to be `"ai"`.

The authenticated user must be a member of the series that owns the scorecard containing
this datasource.

**Request body**
```json
{
  "data": [
    {
      "section": "Delivery",
      "title": "Velocity trending down 3 sprints",
      "primaryValue": "-18%",
      "secondaryValues": { "current": "35", "previous": "43", "baseline": "43" },
      "severity": "warning",
      "sourceData": { "sprint_42": 35, "sprint_41": 38, "sprint_40": 43 }
    }
  ]
}
```

| Field                  | Type   | Required | Constraints                           |
|------------------------|--------|----------|---------------------------------------|
| `data`                 | array  | yes      | 1–500 items                           |
| `data[].section`       | string | yes      | 1–100 chars; groups results visually  |
| `data[].title`         | string | yes      | 1–200 chars                           |
| `data[].primaryValue`  | string | no       | Display value (e.g., `"-18%"`)        |
| `data[].secondaryValues` | object | no    | Key/value pairs for detail display    |
| `data[].severity`      | string | no       | `info` (default), `warning`, `critical` |
| `data[].sourceData`    | any    | no       | Raw evidence attached to the result   |

The server stores these as the datasource's pending injection. On the next scorecard
collection (when a facilitator runs a scene containing this scorecard), the injected data
replaces any prior injection for this datasource.

**Response 200**
```json
{
  "success": true,
  "injected": 3
}
```

**Errors**

| Status | Error                              | Cause                                         |
|--------|------------------------------------|-----------------------------------------------|
| 400    | `"Invalid input"`                  | Validation failure                            |
| 403    | `"Access denied"`                  | User not in series, or datasource not 'ai' type |
| 404    | `"Datasource not found"`           | Datasource ID does not exist                  |

---

## OpenAPI Schema

### `GET /api/v1/openapi.json`

Returns the full OpenAPI 3.1 specification for all v1 endpoints. Unauthenticated.
Intended for AI tooling (GPT plugins, Claude tools, Copilot Workspace) to discover and
call the API without additional documentation.

---

## Common Error Shape

All error responses follow:

```json
{
  "success": false,
  "error": "Human-readable message",
  "details": [ ... ]
}
```

`details` is present only for Zod validation errors and contains the raw Zod issue array.

---

## Rate Limits

Token-authenticated requests share the same per-IP rate limits as session-authenticated ones:
- Board/card creation: 30 per minute
- Auth operations: not applicable (tokens bypass auth rate limiting)

---

## Migration Safety Notes

The `api_tokens` table is introduced in migration `0016_add_api_tokens`. Both PostgreSQL and
SQLite migrations are handwritten to avoid the known Drizzle composite-index auto-generation
bug. Only single-column indexes are used on this table:
- `api_tokens_token_hash_unique` — unique index on `token_hash`
- `api_tokens_user_id_idx` — index on `user_id`

The postgres migration journal was missing entry 15 (`0015_add_continuation_fields`) which
has been corrected. The file existed but was not registered; it is idempotent and safe to
apply to databases that already have those columns (uses `IF NOT EXISTS` / `IF NOT EXISTS`
pattern with a DO-block guard in postgres).
