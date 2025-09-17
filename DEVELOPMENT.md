# DEVELOPMENT.md - Technical Implementation Decisions

## User Experience Principles

### Reduced Interaction Workflow
- **No buttons that reveal more buttons** - Avoid multi-step UI patterns where a button shows additional controls to perform a function
- **Direct action interfaces** - Users should be able to complete tasks with minimal clicks and state changes
- **Inline inputs preferred** - Instead of modal dialogs or toggle buttons, provide inputs directly in context

### Browser Dialog Restrictions
- **Browser-native dialogs are forbidden** - Never use `alert()`, `prompt()`, `confirm()` or similar browser dialogs
- **Custom UI components required** - All user interactions must use properly styled, accessible HTML elements
- **Contextual feedback** - Error messages, confirmations, and input requests should appear inline within the application UI

### Implementation Guidelines
- When a user needs to input data (names, values, etc.), provide a text input field directly in the interface
- Pre-populate input fields with sensible defaults when possible (e.g., "Series Name - Current Date" for board names)
- Use loading states and immediate feedback instead of separate confirmation steps
- Replace toggle-based workflows with always-visible, contextual interfaces

### Real-time UI Consistency
- **Server-side and client-side rendering must be identical** - UI elements created via real-time updates must look and behave exactly the same as those rendered server-side
- **Complete data in API responses** - When creating/updating resources via API, return the complete data structure that matches what server-side rendering expects
- **Consistent state management** - Ensure newly created elements have all required properties (roles, relationships, computed fields, etc.)
- **Visual parity requirement** - No differences in appearance, functionality, or data display between real-time updates and page refreshes

### Examples Applied
- **Series Creation**: Shows text input and "Add" button directly, not a "Create Series" button that reveals inputs
- **Board Creation**: Each series card includes a pre-populated text input and "Create Board" button, eliminating the need for prompt dialogs
- **Error Handling**: Displays inline error messages with proper styling rather than browser alerts

## API Design Principles

### RESTful Endpoint Consistency
- **MANDATORY: Identical data structures across HTTP methods** - GET, POST, PUT, PATCH operations for the same resource MUST return identical data structures
- **No method-specific data variations** - A POST that creates a resource must return the exact same fields and structure as a GET that retrieves it
- **Complete resource representation** - All CRUD operations must return the full resource data, not partial representations
- **Consistent relationship data** - If GET includes joined/related data (roles, associations, computed fields), POST/PUT/PATCH must return the same
- **Type safety enforcement** - Use TypeScript interfaces to ensure all endpoints for a resource return the same shape

### API Response Standards
- **Standardized success format**: `{ success: true, [resource]: data }`
- **Standardized error format**: `{ success: false, error: string, details?: any }`
- **HTTP status codes must be meaningful**: 200 (OK), 201 (Created), 400 (Bad Request), 401 (Unauthorized), 403 (Forbidden), 404 (Not Found), 500 (Server Error)
- **Always return created/updated resource data** - Never return just success messages without the data

### Verbose Error Reporting
- **NEVER return generic error messages** - "Failed to X" is useless for debugging
- **Always include error details** - Return the actual error message from caught exceptions
- **Log errors on server** - Use `console.error()` to log full error details server-side
- **Include stack traces in development** - Add stack traces to error responses when helpful
- **Error response format**:
  ```typescript
  {
    success: false,
    error: "Human-readable error summary",
    details: "Specific error message from exception",
    stack: "Stack trace (in development)"
  }
  ```

### Data Consistency Between API and SSE

#### DRY Principle for Response Generation
- **MANDATORY: Same functions generate both API responses and SSE messages** - Avoid duplicating logic between HTTP endpoints and SSE broadcasts
- **Shared data builders** - Extract response generation into reusable functions that both API and SSE can call
- **Example pattern**:
  ```typescript
  // Shared function used by both API and SSE
  export function buildCardResponse(card: Card) {
    return {
      id: card.id,
      content: card.content,
      columnId: card.columnId,
      userId: card.userId,
      voteCount: card.voteCount,
      createdAt: card.createdAt,
      // ... all fields consistently included
    };
  }

  // API endpoint
  const card = await createCard(data);
  return json({ success: true, card: buildCardResponse(card) });

  // SSE broadcast
  broadcastCardCreated(boardId, buildCardResponse(card));
  ```

#### SSE Message Structure
- **SSE events must include complete resource data** - Not just IDs or partial updates
- **Match API response structure exactly** - Client code should handle both identically
- **Include all relationships and computed fields** - If API returns user roles, SSE must too
- **Timestamp all SSE messages** - For ordering and debugging

#### SSE Data Completeness Principles

##### Always Include Full Data (No Additional Requests Needed)
- **Entity CRUD operations** - When a card/column/scene is created, updated, or deleted, include the complete entity
- **Vote changes** - Include updated vote count, user's vote status, and remaining votes
- **Board state changes** - Include all affected data (current scene, permissions, etc.)
- **User presence updates** - Include user details (name, role) not just user ID
- **Principle**: If the UI needs to update based on this event, include all data needed for that update

##### When to Use Notification-Only Events
- **Large dataset changes** - If updating would require sending massive amounts of data
- **Security-sensitive updates** - When different users should see different subsets of data
- **Rate-limited events** - High-frequency updates where full data would overwhelm clients
- **Examples**:
  ```typescript
  // GOOD: Complete data for UI update
  {
    type: 'card_created',
    card: {
      id: '...',
      content: 'Card text',
      userId: '...',
      userName: 'John Doe',
      columnId: '...',
      voteCount: 0,
      userVoted: false,
      createdAt: '...'
    }
  }

  // AVOID: Notification requiring follow-up request
  {
    type: 'card_created',
    cardId: '...',  // Forces client to GET /api/cards/:id
  }
  ```

##### Data Parity Rule
- **SSE data === API response data** - The exact same object structure should be returned
- **Use shared builder functions** - One function creates the response for both SSE and API
- **Example implementation**:
  ```typescript
  // Shared builder used by both API and SSE
  async function buildCompleteCardData(card: DBCard, userId: string) {
    const user = await getUser(card.userId);
    const userVote = await getUserVoteForCard(card.id, userId);
    return {
      id: card.id,
      content: card.content,
      userId: card.userId,
      userName: user.name,
      columnId: card.columnId,
      voteCount: card.voteCount,
      userVoted: !!userVote,
      createdAt: card.createdAt
    };
  }
  ```

##### Performance Considerations
- **Denormalize for SSE** - Include user names, not just IDs, to avoid lookups
- **Cache frequently used data** - Board metadata, user roles, etc.
- **Batch related updates** - Send one message with multiple changes when possible
- **Consider message size** - SSE has practical limits (~64KB per message)

#### Client-Side Handling
- **Single update function per resource type** - Same function processes API responses and SSE events
- **Idempotent updates** - Applying same update multiple times should have same result
- **Optimistic updates with SSE confirmation** - Update UI immediately, reconcile with SSE
- **No follow-up requests on SSE** - Client should never need to fetch after receiving SSE event

### Critical: Repository Functions Must Return Values
- **ALL repository functions MUST return a value** - Never leave a function without an explicit return statement
- **Transactions must return results** - Database transactions should return success indicators or the affected data
- **Void operations are forbidden** - Even delete operations should return `{ success: true }` or similar confirmation
- **API endpoints depend on return values** - SvelteKit endpoints will error with undefined responses if repository functions don't return properly
- **Example of INCORRECT pattern**:
  ```typescript
  // BAD - returns undefined, causes API errors
  export async function updateSomething(id: string) {
    await db.update(table).set(data).where(eq(table.id, id));
  }
  ```
- **Example of CORRECT pattern**:
  ```typescript
  // GOOD - always returns a value
  export async function updateSomething(id: string) {
    const [result] = await db.update(table).set(data).where(eq(table.id, id)).returning();
    return result; // or return { success: true }
  }
  ```

### Examples Applied
- **Series API**: POST `/api/series` returns identical structure to GET `/api/series` including role and boards array
- **Board API**: POST `/api/boards` returns complete board data with all relationships
- **User API**: All endpoints return consistent user object structure

## Database Architecture

### Critical: SQLite Transaction Limitations with better-sqlite3
- **TRANSACTIONS CANNOT BE ASYNC** - better-sqlite3 is a synchronous driver
- **Transaction functions CANNOT return promises** - Will throw "Transaction function cannot return a promise"
- **No `await` inside transactions** - All operations must be synchronous
- **Use `.run()` for execution** - Don't await database operations in transactions
- **INCORRECT pattern (causes errors)**:
  ```typescript
  // BAD - async transaction causes error
  db.transaction(async (tx) => {
    await tx.update(table).set(data).where(condition);
  });
  ```
- **CORRECT pattern**:
  ```typescript
  // GOOD - synchronous transaction
  db.transaction((tx) => {
    tx.update(table).set(data).where(condition).run();
  });
  ```

### Schema Management
- Database schema lives in `/src/lib/server/db/schema.ts`
- All schema changes require migration generation via `npm run db:generate`
- Use composite keys and proper foreign key relationships
- Slug generation includes UUID prefixes to ensure uniqueness across all tables

### Query Patterns
- Use Drizzle ORM for type-safe database operations
- Implement repository pattern in `/src/lib/server/repositories/`
- Prefer explicit SQL joins over nested queries when performance matters
- Always handle database errors gracefully with user-friendly messages

## Authentication System

### Email-Based Authentication
- **No username field** - Users authenticate with email addresses only
- Session management uses in-memory storage with cleanup intervals
- Session data includes `{ userId, email, expiresAt }` structure
- Password hashing uses bcryptjs with proper salt rounds

### Session Management
- 7-day session expiration with automatic cleanup
- Session structure changes require server restart and user re-authentication
- Session validation in `requireUser()` function throws Response objects for proper HTTP status codes

## Real-time Features

### Server-Side Events (SSE) Integration
- SSE endpoint at `/api/sse` runs on same port as main application (not separate port)
- Uses EventSource API for real-time updates, not WebSockets
- Presence tracking for collaborative features with 30-second timeout
- Real-time board updates and user activity monitoring
- SSE chosen for simplicity: works through proxies, firewalls, and requires no special protocols

### Presence System
- **30-second timeout** for user presence (configurable in `constants.ts`)
- **Automatic presence refresh** on all board API calls via middleware
- **Ping/Pong system** for active users:
  - Server sends `presence_ping` SSE events to users approaching timeout (70% of timeout period)
  - Client responds with PUT to `/api/boards/[id]/presence` with `activity: "pong"` to refresh presence
  - Prevents unnecessary presence timeouts for active users
- **Cleanup intervals**: Stale presence records removed every minute
- **API middleware**: `refreshPresenceOnBoardAction()` automatically updates presence for board-related requests

## Error Handling

### Server-Side Error Management
- Structured error responses with consistent format
- Detailed logging for debugging while providing user-friendly error messages
- Proper HTTP status codes for different error types
- Database constraint violations handled with specific error messages

### Client-Side Error Display
- Inline error messages with proper styling and icons
- Field-level validation feedback
- Loading states during async operations
- No browser dialogs for error communication

## Post-Tailwind Design System

### Component-Focused Styling Architecture

#### Semantic Classes Over Utilities
- **MANDATORY: Use purpose-based class names** - Classes should describe what something *is*, not what it looks like
- **DON'T use single-property utilities** - No `.flex`, `.p-4`, `.bg-white` classes in global CSS
- **Component-specific styling** - All element styles live in component `<style>` blocks

#### LESS Integration for Reusable Patterns
- **LESS mixins for common patterns** - Use mixins for layout patterns, button styles, form inputs
- **Design tokens in CSS variables** - Colors, spacing, typography scales defined once
- **Mixin examples available** - `.flex-between()`, `.button-style()`, `.card-surface()`

#### File Organization
```
src/
├── app.less          # Design tokens + mixins only
├── routes/
│   └── +layout.svelte # Import app.less here
└── lib/components/
    └── *.svelte      # Component styles in <style> blocks
```

#### Available Design Tokens
- **Colors**: `--color-primary`, `--color-teal-500`, `--color-gray-700`
- **Spacing**: `--spacing-1` through `--spacing-20` (0.25rem to 5rem)
- **Typography**: Use `.heading()`, `.body-text()` mixins
- **Transitions**: `--transition-fast`, `--transition-normal`

#### Component Styling Examples
```svelte
<!-- CORRECT: Semantic component approach -->
<div class="card-header">
  <h2 class="card-title">Title</h2>
  <button class="primary-action">Save</button>
</div>

<style lang="less">
  .card-header {
    .flex-between();
    padding: var(--spacing-4);
  }

  .primary-action {
    .button-style(var(--color-teal-500));
  }
</style>
```

#### Migration Principles
- **Replace utility classes with semantic names** - `.flex items-center` becomes `.toolbar`
- **Move styles to components** - Global utilities become component-specific styles
- **Use LESS mixins for patterns** - Reusable layout patterns become mixins
- **Maintain design consistency** - Same visual result with better architecture

## API Testing Strategy (Future Implementation)

### Testing Approach
- **Scenario-based tests** - Test complete user workflows, not just individual endpoints
- **Precondition setup** - Database seeding with known test data states
- **Response validation** - Verify both structure and content of API responses
- **Side effect verification** - Check database state changes after API calls
- **SSE event validation** - Ensure correct events are broadcast with API actions

### Test Structure
```typescript
// Example test structure (not yet implemented)
describe('Card Creation Flow', () => {
  beforeEach(() => {
    // Setup: Create test user, series, board
    // Seed database with known state
  });

  test('POST /api/boards/:id/cards creates card and broadcasts SSE', async () => {
    // Given: User has access to board in "brainstorm" scene
    // When: POST request to create card
    // Then:
    //   - Returns 201 with complete card data
    //   - Card exists in database with correct fields
    //   - SSE event 'card_created' broadcast with identical data
    //   - Vote count initialized to 0
  });

  test('POST /api/cards/:id/vote toggles vote and updates stats', async () => {
    // Given: Card exists with 2 votes from other users
    // When: User votes on card
    // Then:
    //   - Returns updated vote count (3)
    //   - User's vote recorded in database
    //   - SSE 'vote_changed' broadcast to all users
    //   - SSE 'voting_stats_updated' sent to facilitators
    //   - User's remaining votes decreased by 1
  });
});
```

### Test Data Management
- **Isolated test database** - Separate SQLite file for tests
- **Transaction rollback** - Each test runs in transaction, rolled back after
- **Factory functions** - Create test data with sensible defaults
- **Deterministic IDs** - Use predictable UUIDs for easier assertions

### Coverage Goals
- **Critical paths first** - Authentication, board creation, card management
- **Edge cases** - Permission boundaries, vote limits, scene restrictions
- **Error scenarios** - Invalid inputs, unauthorized access, race conditions
- **Real-time sync** - Multiple users, concurrent updates, SSE delivery

### Implementation Tools (Proposed)
- **Vitest** - Fast, ESM-native test runner compatible with SvelteKit
- **Supertest or native fetch** - HTTP request testing
- **Database helpers** - Direct DB access for setup/verification
- **SSE test client** - EventSource mock for validating broadcasts
- **Playwright** - End-to-end testing with multi-user scenarios

### Multi-User Interaction Testing with Playwright

#### Real-time Collaboration Scenarios
- **Multiple browser contexts** - Simulate concurrent users in same board
- **SSE synchronization tests** - Verify real-time updates across sessions
- **Race condition detection** - Test simultaneous card creation, voting, grouping
- **Presence testing** - Validate user join/leave notifications

#### Example Multi-User Test Patterns
```typescript
// Playwright multi-user test example (not yet implemented)
test('Multiple users see real-time card updates', async ({ browser }) => {
  // Create two browser contexts (two users)
  const context1 = await browser.newContext();
  const context2 = await browser.newContext();

  const user1 = await context1.newPage();
  const user2 = await context2.newPage();

  // Both users join same board
  await user1.goto('/board/test-board-id');
  await user2.goto('/board/test-board-id');

  // User 1 creates a card
  await user1.fill('[data-testid="card-input"]', 'New idea');
  await user1.click('[data-testid="add-card"]');

  // User 2 should see the card appear without refresh
  await expect(user2.locator('text=New idea')).toBeVisible({ timeout: 2000 });

  // User 2 votes on the card
  await user2.click('[data-testid="vote-card"]');

  // User 1 should see vote count update
  await expect(user1.locator('[data-testid="vote-count"]')).toHaveText('1');
});

test('Facilitator controls affect all users', async ({ browser }) => {
  const facilitator = await browser.newContext();
  const participant = await browser.newContext();

  // Setup: Facilitator changes scene
  // Verify: Participant sees scene change and UI updates
  // Verify: Participant permissions change accordingly
});
```

#### Testing Focus Areas
- **Voting conflicts** - Multiple users voting simultaneously
- **Card grouping** - Concurrent grouping operations
- **Scene transitions** - Permission changes propagate correctly
- **Presence accuracy** - Active user list stays synchronized
- **Connection recovery** - SSE reconnection after network interruption
- **Performance under load** - 10+ concurrent users on same board

#### Browser Context Management
- **Session isolation** - Each context has separate cookies/storage
- **Parallel execution** - Run multiple user actions simultaneously
- **Network conditions** - Simulate slow/interrupted connections
- **Viewport testing** - Different screen sizes for responsive testing

### Test Commands (Proposed)
```bash
npm run test           # Run all tests
npm run test:api       # API tests only
npm run test:e2e       # Playwright end-to-end tests
npm run test:e2e:ui    # Playwright with UI mode
npm run test:watch     # Watch mode for development
npm run test:coverage  # Coverage report
```
