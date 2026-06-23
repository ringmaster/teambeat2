import { validateApiToken } from "$lib/server/auth/api-token.js";
import { findSeriesByUser } from "$lib/server/repositories/board-series.js";

export interface SetupData {
	token: string;
	user: { email: string };
	series: any[];
	baseUrl: string;
	openApiUrl: string;
	instructions: string;
}

export async function buildSetupData(rawToken: string, origin: string): Promise<SetupData | null> {
	const user = await validateApiToken(rawToken);
	if (!user) return null;

	const baseUrl = `${origin}/api/v1`;
	const openApiUrl = `${origin}/api/v1/openapi.json`;
	const series = await findSeriesByUser(user.userId);

	const seriesList = series.length === 0
		? "No series found for this account."
		: series.map((s: any) => `- **${s.name}** — ID: \`${s.id}\` (role: ${s.role})`).join("\n");

	const instructions = `# Teambeat AI Setup

You are connected to a Teambeat instance. Everything you need to operate the API is in this document.

## Authentication

All API requests require this header:
  Authorization: Bearer ${rawToken}

## Base URL

  ${baseUrl}

## Your Series

${seriesList}

## Key Endpoints

### Templates
  GET  ${baseUrl}/templates                           List all board templates (READ THIS BEFORE CREATING A BOARD)

  ⚠️  ALWAYS fetch templates before creating a board and use a templateId.
  Building a board without a templateId requires specifying every column, scene, scene flag,
  and display rule by hand. This is error-prone and produces poor results. Without explicit
  direction from the user to build a custom board structure, always use a template.

  Example workflow:
    1. GET ${baseUrl}/templates                       → choose the best-fit template id
    2. POST ${baseUrl}/series/{id}/boards             → { name, templateId }

### Series & Boards
  GET  ${baseUrl}/series                              List series you belong to
  GET  ${baseUrl}/series/{id}/boards                  Recent boards (?limit= &offset=)
  GET  ${baseUrl}/series/{id}/boards?status=active    The active board for a series
  GET  ${baseUrl}/series/{id}/health-summary          Longitudinal health trends
  GET  ${baseUrl}/series/{id}/agreements              Cross-board agreement history

### Creating a Board
  POST  ${baseUrl}/series/{id}/boards

  Required: name (string)
  Strongly recommended: templateId — see GET /templates for the list.

  Without a templateId you must provide columns and scenes arrays in full.
  This requires detailed knowledge of scene modes, flags, and display rules.
  Only omit templateId when the user has explicitly described a custom board structure.

  With templateId:
    { "name": "Sprint 42 Retro", "templateId": "startstop" }

  The response includes the resolved columns and scenes so you can confirm the structure.
  Available templateId values are returned by GET /templates.

### Cloning a Board
  POST  ${baseUrl}/series/{id}/boards/clone

  ⚠️  If the series already has any boards, ALWAYS clone the most recent one rather than
  creating a new board. Cloning is the ONLY way to preserve data continuity for recurring
  scenes like pulse checks and health surveys — health question threadIds are preserved so
  longitudinal trends remain unbroken. Creating a new board starts fresh and loses that history.

  Cloning copies all scenes, columns, health questions, scene flags, and incomplete
  agreements from an existing board into a new draft board.

  Required: sourceId (UUID of the board to clone, must belong to this series)
  Optional: name (defaults to the source board's name), meetingDate (YYYY-MM-DD)

  If the source board is active or draft, it is automatically marked as completed.
  The response includes sourceBoardCompleted: true/false to confirm what happened.

  Example:
    { "sourceId": "board-uuid", "name": "Sprint 43 Retro", "meetingDate": "2026-07-15" }

### Boards
  GET  ${baseUrl}/boards/{id}                         Full board (scenes, columns, cards)
  GET  ${baseUrl}/boards/{id}/cards                   Cards (?columnId= to filter)

### Cards
  POST   ${baseUrl}/boards/{id}/cards                 Create: { columnId, content }
  PATCH  ${baseUrl}/boards/{id}/cards/{cardId}        Update: { content?, columnId? }

### Agreements
  GET    ${baseUrl}/boards/{id}/agreements            List agreements
  PATCH  ${baseUrl}/agreements/{id}                   Update: { content?, completed? }

### Data Source (push structured data to a series)
  GET    ${baseUrl}/series/{id}/data-source           Read current dataset
  PATCH  ${baseUrl}/series/{id}/data-source           Merge data (MongoDB-style grammar)
  PUT    ${baseUrl}/series/{id}/data-source           Full replace

  PATCH body examples:
    Shallow merge:    { "cards": [...] }
    Deep set:         { "$set": { "sprint.name": "Sprint 42" } }
    Unset a key:      { "$unset": ["sprint.velocityDelta"] }

### Data Scene Rules (how the dataset is displayed)
  GET  ${origin}/api/v1/scenes/{sceneId}/data-rules      List display rules for a data scene
  PUT  ${origin}/api/v1/scenes/{sceneId}/data-rules      Replace all rules (admin/facilitator only)

  Rule object fields:
    query         JMESPath expression into the dataset (required)
    label         Name shown when no results found
    titleTemplate Panel title — use {field.path} to interpolate from the matched item
    bodyTemplate  Panel body — same {field.path} interpolation
    copyTemplate  Text used when copying a panel to a card (defaults to title + body)
    panelSize     "small" | "medium" | "full"  (grid column width)
    section       Optional section heading that groups rules visually
    seq           Display order (0-based integer)
    emphasisPath  JMESPath evaluated against each item for conditional styling
    emphasisMap   JSON string mapping emphasis values to CSS classes:
                  "danger" (red), "warning" (amber), or "info" (blue)
                  e.g. '{"high":"danger","medium":"warning","low":"info"}'

  Template interpolation: {field}, {nested.field}, {array.0.field}
  JMESPath on an array produces one panel per item.
  JMESPath on an object or scalar produces one panel total.

  Example — sprint health dataset:
    PUT ${baseUrl}/series/{id}/data-source
    Body:
    {
      "sprint": {
        "name": "Sprint 42",
        "velocity": 34,
        "planned": 40,
        "completion": 85
      },
      "blockers": [
        { "title": "Auth service down", "owner": "Alice", "severity": "high" },
        { "title": "CI pipeline slow",  "owner": "Bob",   "severity": "low"  }
      ]
    }

  Example rules for the dataset above:
    PUT ${origin}/api/v1/scenes/{sceneId}/data-rules
    Body:
    [
      {
        "seq": 0,
        "section": "Sprint Summary",
        "label": "Sprint",
        "query": "sprint",
        "titleTemplate": "{name}",
        "bodyTemplate": "Velocity: {velocity} of {planned} points · {completion}% complete",
        "panelSize": "medium"
      },
      {
        "seq": 1,
        "section": "Blockers",
        "label": "Blocker",
        "query": "blockers",
        "titleTemplate": "{title}",
        "bodyTemplate": "Owner: {owner}",
        "copyTemplate": "{title}\\nOwner: {owner}",
        "panelSize": "medium",
        "emphasisPath": "severity",
        "emphasisMap": "{\\"high\\":\\"danger\\",\\"low\\":\\"info\\"}"
      }
    ]

  What the board displays with that data and those rules:

    ── Sprint Summary ─────────────────────────────────────────────
    ┌────────────────────────────────────────────────────────────┐
    │ Sprint 42                                                  │
    │ Velocity: 34 of 40 points · 85% complete                  │
    └────────────────────────────────────────────────────────────┘

    ── Blockers ───────────────────────────────────────────────────
    ┌╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴┐  ┌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┐
    ┊ [red] Auth service down          ┊  ┊ [blue] CI pipeline slow       ┊
    ┊ Owner: Alice                     ┊  ┊ Owner: Bob                    ┊
    └╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴╴┘  └╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┘
    (severity=high → danger/red)           (severity=low → info/blue)

  The "Copy to column" button on each blocker panel copies copyTemplate text
  directly into a retro card in the column the user selects.

### Full API Reference
  ${openApiUrl}

## Session Startup (recommended)

When starting a session where Teambeat work is likely:
1. Your series are listed above — use those IDs directly.
2. GET /series/{id}/boards?status=active&limit=1 to find the active board.
3. GET /boards/{id} to load scenes, columns, and cards.
4. Confirm with the user before writing (creating cards, updating data, etc.).

## Data Scene

Structured data is stored at the series level and shared across all draft and active boards
in that series. Any board with a scene in "data" mode will display the data — if no data
scene exists on a board, the data will not appear there.

To push data to a series:
  PUT ${baseUrl}/series/{id}/data-source
  Body: any JSON document

To understand what the board expects and how it will render the data, fetch the rules
for any data scene on the board:
  GET ${origin}/api/v1/scenes/{sceneId}/data-rules

Each rule has a JMESPath query that extracts a value from the dataset and {field.path}
templates that control how it is displayed. Push data that satisfies those queries.
`;

	return {
		token: rawToken,
		user: { email: user.email },
		series,
		baseUrl,
		openApiUrl,
		instructions,
	};
}
