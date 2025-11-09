# Testing Policy

## Core Principles

**ZERO TOLERANCE FOR BREAKING TESTS**
All tests must pass before any change is marked complete. No exceptions.

## Test Enforcement Rules

### 1. **All Changes Must Pass Tests**
Before completing any task:
```bash
npm test
```
- Must show `Test Files: X passed`
- Must show `Tests: X passed (X)`
- Zero failures allowed

### 2. **Critical Areas Require Additional Tests**
When modifying these areas, consider adding new tests:

#### SSR Data Loading (`src/routes/*/+page.server.ts`)
- **Why**: Causes visible flash if data loads client-side instead of SSR
- **Test**: Verify all necessary data (cards, votes, comments, reactions) loads during SSR
- **Example**: `tests/unit/pages/board-page-server.test.ts`

#### Scene Capabilities (`src/lib/utils/scene-capability.ts`)
- **Why**: Wrong capability checks break features silently
- **Test**: Verify capability checks use `getSceneCapability()` with flags array
- **Example**: `tests/unit/services/board-initialization.test.ts`

#### Voting System
- **SSR Loading**: `tests/unit/pages/board-page-server.test.ts`
- **API Endpoints**: `tests/unit/api/user-votes.test.ts`, `tests/unit/api/card-vote.test.ts`
- **Data Building**: `tests/unit/utils/voting-data.test.ts`

#### Card Data Enrichment
- **Why**: Missing reactions/comments/voteCount causes incomplete UI
- **Test**: Verify `enrichCardsWithCounts()` is called in SSR
- **Location**: Covered by SSR tests

#### API Endpoints with Authorization
- **Why**: Security vulnerabilities if auth checks are wrong
- **Test**: Always test both authorized and unauthorized access
- **Example**: Every `tests/unit/api/*.test.ts` file

### 3. **Test-First for Bug Fixes**
When fixing bugs:
1. ✅ Write a failing test that demonstrates the bug
2. ✅ Fix the code
3. ✅ Verify the test passes
4. ✅ Add comment explaining what the test prevents

Example from voting regression:
```typescript
it("BUG TEST: would fail with old buggy code that checked direct properties", async () => {
  // This test demonstrates the bug that was fixed
  const mockScene = {
    id: "scene-1",
    flags: ["allow_voting"], // Correct structure with flags
    allowVoting: undefined, // These properties don't exist!
    showVotes: undefined,
  };

  // The BUGGY condition that was used before the fix:
  const buggyCondition = mockScene && (mockScene.allowVoting || mockScene.showVotes);
  expect(buggyCondition).toBeFalsy(); // Would be false incorrectly

  // The CORRECT condition using getSceneCapability:
  const correctCondition = getSceneCapability(mockScene, "active", "allow_voting");
  expect(correctCondition).toBe(true); // Correctly returns true
});
```

### 4. **Make Tests Resilient**
- **Avoid brittle string matching**: Use `.toContain()` instead of `.toBe()` for error messages
- **Use mocks correctly**: Follow existing patterns in `tests/unit/api/*.test.ts`
- **Test behavior, not implementation**: Focus on what the code does, not how

Example:
```typescript
// ❌ Brittle - breaks if message wording changes
expect(data.error).toBe("Registration failed. Email may already be in use.");

// ✅ Resilient - checks for key concepts
expect(data.error).toContain("Registration failed");
expect(data.error).toContain("Email");
```

## Pre-Commit Checklist

Before committing code:
- [ ] All tests pass (`npm test`)
- [ ] Build succeeds with no warnings (`npm run build`)
- [ ] If touching critical areas (SSR, capabilities, voting, auth), consider new tests
- [ ] If fixing a bug, added a test that would have caught it

## Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test tests/unit/api/user-votes.test.ts

# Run tests matching a pattern
npm test -- voting

# Watch mode during development
npm test -- --watch
```

## Test Coverage Goals

### Current Coverage (Jan 2025)
- API Endpoints: ✅ Comprehensive (354+ tests)
- SSR Data Loading: ✅ Core scenarios covered
- Scene Capabilities: ✅ Covered
- Voting System: ✅ Comprehensive

### Areas for Future Improvement
- E2E tests for real-time SSE synchronization (use playwright-test-writer agent)
- Integration tests with real database
- Client-side component tests

## When Tests Fail

1. **Read the error message carefully** - it usually tells you exactly what's wrong
2. **Check recent changes** - what did you modify that could affect this test?
3. **Run just that test** - isolate the failure: `npm test tests/unit/api/specific-test.test.ts`
4. **Never skip or disable tests** - if a test is failing, either fix the code or fix the test
5. **Ask for help** - if stuck, the test failure is telling you something important

## Anti-Patterns to Avoid

### ❌ DON'T: Skip failing tests
```typescript
it.skip("should work correctly", async () => { // Never do this!
```

### ❌ DON'T: Modify tests to pass without understanding why they failed
```typescript
// Bad: changing expected value without understanding the failure
expect(result).toBe(false); // Changed from true to make test pass
```

### ❌ DON'T: Use exact string matching for error messages
```typescript
expect(error).toBe("Exact error message"); // Fragile!
```

### ✅ DO: Fix the underlying issue
```typescript
// Fixed the bug in the code, test now passes correctly
expect(result).toBe(true);
```

### ✅ DO: Use flexible matchers
```typescript
expect(error).toContain("key concept");
```

### ✅ DO: Write tests that match actual behavior
```typescript
// Test reflects how the code actually works
expect(getSceneCapability(scene, "active", "allow_voting")).toBe(true);
```

## Emergency: Tests Blocking Urgent Fix

If tests are blocking an urgent production fix:
1. **Verify the test is actually wrong** - 99% of the time, the test is right and found a real issue
2. **Document the issue** - create a ticket explaining why the test needs updating
3. **Get review** - have another developer confirm the test needs changing
4. **Fix test AND code** - update both to match correct behavior

**NEVER bypass tests without documented justification.**
