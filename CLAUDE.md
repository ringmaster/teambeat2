# CLAUDE.md - Development Guidelines

## Project Philosophy

This project prioritizes **developer autonomy** over framework magic. We choose tools that enhance productivity without imposing rigid patterns or hiding important details.

## Core Principles

### 1. Explicit over Implicit
- Prefer clear, readable code over clever abstractions
- Database queries should be obvious and debuggable
- Authorization logic lives in one place (SvelteKit endpoints)
- Real-time updates use straightforward websocket patterns

### 2. Libraries vs Custom Code
- **Libraries are preferred** when they tangibly simplify the application
- Libraries must not over-complicate maintenance (**primary directive: human-readable, human-maintainable code**)
- Choose well-maintained libraries with good documentation
- Avoid libraries that add complexity without clear value

### 3. Build Quality
- **Remove all warnings and errors** before calling any feature complete
- Zero tolerance for build warnings in production code
- Address TypeScript errors immediately, don't suppress them

### 4. Schema as Code
- Database schema lives in version control
- Types are generated from schema, not maintained separately
- Migrations are code, not magic
- Schema changes should be reviewable diffs

### 5. Real-time First
- WebSocket connections are first-class citizens
- State synchronization is explicit and understandable
- Presence and collaboration features are built-in considerations
- Offline behavior is defined, not accidental

## Technology Choices

### Framework: Svelte 5 + SvelteKit
- **Why**: Minimal runtime, excellent developer experience, full-stack capabilities
- **Usage**: Server-side rendering, API routes, websocket handling
- **Avoid**: Over-relying on client-side state for server data

#### Critical Svelte 5 Requirements

**MANDATORY: Write all Svelte components in Runes mode** - This is vital for error-free code
- Use `$state()`, `$derived()`, `$props()`, `$effect()` instead of legacy reactive declarations
- Use `let { prop1, prop2 } = $props()` for component props
- Use `let variable = $state(initialValue)` for reactive state
- Use `let computed = $derived(expression)` for computed values
- **Never mix runes with legacy Svelte syntax** - causes compilation errors

**CRITICAL $derived SYNTAX** - This is a recurring mistake:
- Use `$derived(expression)` for simple expressions: `let doubled = $derived(count * 2)`
- Use `$derived.by(() => {...})` for complex logic with function body: `let filtered = $derived.by(() => { return items.filter(...); })`
- **NEVER use `$derived(() => {...})`** - This creates a function, not a value, causing "X is not a function" errors

Example:
```svelte
<script lang="ts">
  // Correct - Runes mode
  let count = $state(0);
  let doubled = $derived(count * 2);
  let { user } = $props();

  // Correct - $derived.by for complex logic
  let filteredItems = $derived.by(() => {
    if (!config) return items;
    return items.filter(item => item.active);
  });

  // Wrong - Legacy mode (DO NOT USE)
  // export let user;
  // let count = 0;
  // $: doubled = count * 2;

  // Wrong - $derived with arrow function (DO NOT USE)
  // let filteredItems = $derived(() => {
  //   return items.filter(item => item.active);
  // });
</script>
```

**ALWAYS add `key` attributes to `{#each}` blocks** - Use unique identifiers (user.id, card.id, etc.) to prevent rendering issues
```svelte
{#each users as user (user.id)}
  <!-- content -->
{/each}
```

**Implement proper ARIA attributes** for accessibility:
- Add `aria-label` to all buttons that need context (especially icon-only or action buttons)
- Use `role` attributes for custom interactive elements
- Include `aria-disabled` for disabled states
- Add `aria-live` regions for dynamic content updates
- Use semantic HTML (`<button>`, `<nav>`, `<main>`) instead of `<div>` with roles where possible

**Avoid unused CSS rules** - Only define CSS classes that are actually used in the component
- Remove or comment out unused selectors before committing
- Use CSS variables for values that might be needed across components
- Move reusable styles to global stylesheets or mixins

### Database: SQLite + PostgreSQL with Drizzle ORM
- **Why**: Flexible deployment (SQLite for simplicity, PostgreSQL for scale), excellent performance, familiar SQL
- **Usage**: Drizzle for schema/types, generate migrations with drizzle-kit
- **Avoid**: Using drizzle-kit push for PostgreSQL (known bugs with composite keys)
- **Note**: Same schema works for both databases with conditional type builders

### Real-time: Server-Side Events (SSE)
- **Why**: Direct control, minimal overhead, standard protocol, works through proxies/firewalls
- **Usage**: Board state sync, presence tracking, live collaboration
- **Architecture**: Same port as HTTP, EventSource API on client
- **Avoid**: Incomplete SSE messages that require follow-up API calls

### Validation: Zod
- **Why**: TypeScript-first, composable, runtime safety
- **Usage**: API input validation, form validation, data parsing
- **Avoid**: Duplicate validation logic between client/server

### Formula Evaluation: Custom RPN System
- **Why**: Unambiguous evaluation, no operator precedence complexity, easy to validate
- **Usage**: Scorecard formula evaluation, data source calculations
- **Implementation**: Parser, validator, and stack-based evaluator
- **Avoid**: Using eval() or complex expression parsers

### Style Management: Custom Design System
- **Why**: Full control over UI, no dependency on third-party themes
- **Usage**: Reusable components, consistent styling, responsive design, selector composition with LESS
- **Avoid**: Overly complex CSS frameworks like Tailwind that bloat the codebase
- **Note**: Remove Tailwind-style classes as you go, ensuring that the styles they provided are replaced with custom styles.

## Code Organization

### Directory Structure
```
src/
├── lib/
│   ├── server/
│   │   ├── db/           # Database connection, migrations
│   │   ├── repositories/ # Data access layer
│   │   ├── websockets/   # Real-time connection handling
│   │   └── auth/         # Authentication/authorization
│   ├── components/       # Reusable UI components
│   ├── stores/           # Client-side state management
│   └── types/            # Shared TypeScript definitions
├── routes/               # SvelteKit routes (pages + API)
└── app.html             # Root HTML template
```

### Naming Conventions
- **Files**: kebab-case (`card-editor.svelte`, `user-repository.js`)
- **Components**: PascalCase (`CardEditor`, `UserPresence`)
- **Variables**: camelCase (`boardId`, `currentUser`)
- **Constants**: SCREAMING_SNAKE_CASE (`MAX_CARDS_PER_COLUMN`)
- **Database**: snake_case (`board_id`, `created_at`)

## Development Workflow

### 1. Database First
- Define schema changes in Drizzle schema files
- Generate types automatically
- Test queries in isolation before building features

### 2. API Design
- Design JSON APIs that match client needs
- Validate inputs with Zod schemas
- Handle authorization at the endpoint level
- Return consistent error formats

### 3. Real-time Integration
- Plan SSE (Server-Side Events) message types alongside API design
- Test real-time features with multiple browser windows
- Handle connection drops and reconnection gracefully
- Consider message ordering and race conditions
- Include complete data in SSE messages to avoid follow-up API calls

### 4. Component Development
- Build components in isolation first
- Use TypeScript interfaces for component props
- Test with realistic data, not just happy paths
- Consider loading and error states

### 5. User Feedback
- **NEVER use `alert()`, `prompt()`, or `confirm()` for user feedback**
- **ALWAYS use the toast system** (`toastStore.success()`, `toastStore.error()`, `toastStore.info()`) for notifications and confirmations
- For confirmations, use modal components with proper UI

## Quality Standards

### Code Readability - **MUST-HAVE**
- **Code must be manually maintainable** - any developer should be able to understand and modify functionality without extensive research
- **Avoid clever abstractions** that obscure what the code is doing
- **Use descriptive variable and function names** that explain intent
- **Keep functions focused** on single responsibilities
- **Comment complex business logic** but not obvious operations
- **Prefer explicit code** over implicit magic

### Type Safety
- All public APIs should have TypeScript definitions
- Database queries should return typed results
- Component props should be fully typed
- Avoid `any` types in production code

## Documentation Strategy - **TOKEN CONSERVATION**

### Three Critical Documentation Files Only
1. **README.md** - User documentation on how to use the application
2. **DEVELOPMENT.md** - Technical implementation decisions and architecture choices for future developers/AI agents
   - Document small but critical decisions that impact future development
   - Include reasoning behind architectural choices, library selections, schema decisions
   - Structure by topic (Database, Authentication, Real-time, etc.)
3. **REVISIT.md** - Tests and documentation items deferred for token conservation but potentially useful later
   - Structure into sections: Tests, Documentation, Features, Performance
   - Include brief rationale for why each item was deferred

### Documentation Rules
- **Create these files as needed** during development when decisions warrant documentation
- **No other documentation files** should exist beyond these three plus inline code comments
- **Single-file consolidation** - don't create new files for each feature
- **Optimize for fewer docs** as a token conservation effort
- **Avoid documentation sprawl** - consolidate related information
- **Additional files as needed**: STYLEGUIDE.md for design system, PERFORMANCE_SETUP.md for monitoring setup

### Code Comments
- **Inline comments only for complexity** - explain business logic, not obvious operations
- **Focus on why, not what** - document reasoning behind non-obvious implementations
- **Avoid over-commenting** - code should be self-explanatory where possible

### Testing Strategy - **NON-NEGOTIABLE REQUIREMENTS**

**ABSOLUTE RULES - NO EXCEPTIONS:**

1. **WRITE TESTS WHEN TOLD, HOW TOLD, EVERY TIME TOLD**
   - If the user requests a test, write it immediately
   - If the user asks "is there a test for X?", write it if it doesn't exist
   - If the user says "ensure there is a test", write it
   - **NO EXCUSES** - "it's complex" is not acceptable, follow existing patterns

2. **ALL TESTS MUST USE MOCKS - NEVER USE LIVE DATABASE**
   - Mock all repository functions using `vi.mock()`
   - Mock all database operations using `vi.mock('../../../src/lib/server/db/index')`
   - Mock all external services (email, auth, etc.)
   - Look at existing tests for patterns - we already do this everywhere
   - **NEVER** say "mocking the database is complex" - it's already done in every test

3. **TEST COVERAGE HIERARCHY** (in order of priority):
   - **Authorization/Security** - ALWAYS required for admin endpoints, permission checks, access control
   - **User-requested tests** - If user asks for a test, write it (API, repository, service, whatever they ask for)
   - **API endpoints** - Required when specification requests them or describes behavior
   - **Critical path** - Authentication, data integrity, security features
   - **Repository functions** - When implementing new data access logic or fixing bugs
   - **Edge cases** - When user identifies a bug or asks "what if X happens?"

**How to write tests:**
```typescript
// ALWAYS follow this pattern from existing tests:

// 1. Mock dependencies
vi.mock('../../../src/lib/server/repositories/user', () => ({
	findUserById: vi.fn(),
	ensureEmailVerificationSecret: vi.fn()
}));

// 2. Import mocked modules
import { findUserById, ensureEmailVerificationSecret } from '../../../src/lib/server/repositories/user';

// 3. Set up mocks in tests
vi.mocked(findUserById).mockResolvedValue({ id: 'user-1', ... });

// 4. Test behavior
expect(findUserById).toHaveBeenCalledWith('user-1');
```

**Example: Authorization bug that tests would catch:**
```typescript
// BAD - would pass without tests, but breaks in production
if (!sessionUser.isAdmin) { // isAdmin doesn't exist on SessionData!
  return 403;
}

// GOOD - tests force you to verify the actual behavior
const user = await findUserById(sessionUser.userId);
if (!user?.is_admin) {
  return 403;
}
```

**When user says "write a test":**
- Stop whatever you're doing
- Look at similar existing tests for patterns
- Write the test using the same mocking approach
- Run the test to verify it works
- **NEVER** say "it's complex" or "we don't have repository tests" - just write it

- **Style Observation Upon Change** - When writing code that is meant to change the appearance of the UI, attempt to use MCP tools that might be available to ensure that the change you've applied has had the desired effect. This is not a hard requirement for every visual change, but when given instruction that the UI does not look like desired, changes should be checked with MCP tools to ensure the change has had the desired effect.

### Performance Considerations
- **Page loads under 300ms** for reasonable connections
- Database queries should be indexable and efficient
- WebSocket messages should be minimal and focused
- Client-side state should not duplicate server state unnecessarily

## Security Guidelines

### Authentication
- Session-based authentication with secure cookies (7-day expiration)
- Password authentication with bcryptjs hashing
- WebAuthn/Passkey support for passwordless authentication
- Proper session timeout and automatic cleanup
- Admin users marked with is_admin flag for privileged access

### Authorization
- Role-based access control (RBAC) in API endpoints
- No client-side authorization logic
- Database-level constraints where appropriate
- Audit logging for sensitive operations

### Data Validation
- All user inputs validated server-side
- SQL injection prevention through parameterized queries
- XSS prevention through proper escaping
- CSRF protection for state-changing operations

## Deployment Considerations

### Single Instance Deployment
- SQLite database file with regular backups (or PostgreSQL for production)
- SSE connections handled in-process on same port as HTTP
- Static assets served by SvelteKit
- Environment configuration through DATABASE_URL and PORT variables
- Docker deployment with multi-stage builds
- Digital Ocean App Platform support with pre-deploy migrations

### Scaling Preparation
- PostgreSQL support already implemented
- SSE handling can be migrated to Redis pub/sub for horizontal scaling
- Session storage can be moved to Redis for multi-instance deployments
- Performance monitoring system provides baseline metrics
- Database migrations use generate + migrate workflow (not push)

## Architectural Patterns Established

### Performance-First Monitoring
The performance monitoring system exemplifies good architectural decisions:
- **In-memory collection** - Zero database overhead during metric collection
- **Periodic persistence** - Snapshots saved every 60 seconds, not on every request
- **Singleton pattern** - Single tracker instance, simple to integrate
- **Percentile tracking** - P50/P95/P99 provide actionable insights
- **Admin-only access** - Monitoring data protected, doesn't expose security issues

### Formula Evaluation System
The RPN scorecard system demonstrates thoughtful library choices:
- **Custom implementation** - Simple stack-based evaluation beats heavy parser libraries
- **Clear separation** - Parser, validator, evaluator as distinct modules
- **Extensible operations** - Easy to add new operators and functions
- **Error handling** - Validation catches issues before evaluation
- **Why not a library?** - Standard expression parsers add complexity without benefit for our constrained use case

### SSE Data Completeness
Real-time updates are designed to eliminate unnecessary API calls:
- **Complete data in broadcasts** - No follow-up requests needed
- **Shared builders** - Same functions generate API responses and SSE messages
- **User-specific messages** - Different users get relevant data based on permissions
- **Concurrent broadcasting** - User messages sent as soon as data is ready, not sequentially

### Lock Systems
The card notes locking mechanism shows good collaborative UX:
- **In-memory locks** - Fast, simple, appropriate for single-instance deployment
- **Time-based expiration** - Prevents permanent locks from crashes
- **SSE notifications** - All users see lock status in real-time
- **No lock stealing** - Prevents conflicts, forces communication

### Repository Pattern Consistency
All data access follows consistent patterns:
- **MUST return values** - Never leave functions without explicit returns
- **Typed results** - Drizzle ORM provides type safety
- **Error propagation** - Let errors bubble to API layer for consistent handling
- **Transaction helper** - Database-agnostic transaction wrapper handles SQLite/PostgreSQL differences

This document should be revisited as the project evolves, but these principles should guide architectural decisions throughout development.
