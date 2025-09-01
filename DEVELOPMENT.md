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

### WebSocket Integration
- WebSocket server runs on port 8080 alongside main application
- Presence tracking for collaborative features
- Real-time board updates and user activity monitoring
- Connection handling designed for horizontal scaling preparation

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