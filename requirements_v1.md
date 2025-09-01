# REQUIREMENTS_1.md - TeamBeat Application Specifications

## Project Overview

TeamBeat is a real-time collaborative retrospective tool that enables teams to conduct structured retrospective meetings. This document outlines requirements for building a modern TeamBeat application using SvelteKit 5 + SQLite architecture.

**Reference Implementation**: The existing TeamBeat application serves as a feature reference but not an implementation guide. The new application should be designed with clean architecture and extensibility from the ground up.

## Core Requirements

### 1. Board Organization
- **One-off boards** created as single-board series for consistent access control
- **Board series** provide continuity across multiple retrospectives
- **Team association** through series membership with role-based access
- **Board templates** for consistent retrospective formats
- **Resolution tracking** between boards in a series

### 2. Authentication & User Management
- **Local authentication** (username/password) as primary implementation
- **Extensible auth system** designed to support future SSO/OAuth providers
- **Direct board invites** via shareable links
- **Guest viewing** - anonymous users can view boards but must authenticate to interact
- **Blame-free mode** - option to display all content without attribution to users

### 3. Real-time Collaboration
- **40+ concurrent users** per board support
- **Live presence indicators** showing active participants
- **Instant synchronization** across all connected clients
- **Optimistic updates** with conflict resolution
- **Connection resilience** with graceful degradation
- **Voting presence** - facilitators can see outstanding votes and non-participating users

### 4. Card System
- **Rich text editing** using Ink-MDE for descriptions
- **Drag-and-drop organization** with visual grouping (**Phase 2 requirement**)
- **Single voting system** (configurable allocation per user)
- **Card comments** with threading
- **AI-powered card grouping** (when API keys available)

### 5. Retrospective Workflow
- **Multi-phase meetings** with facilitator-controlled transitions
- **Scene modes**: "Columns", "Present", "Review"
- **Flexible scene permissions** (add cards, edit cards, comment, column visibility)
- **Team health checks** as retrospective phase with anonymous rating and visual results
- **Action item tracking** with multi-person assignment
- **Robust timer system** with extension voting and facilitator controls

## Database Schema

### Core Tables
```sql
-- Authentication
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT,
  name TEXT,
  password_hash TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Board organization with consolidated access control
CREATE TABLE board_series (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE series_members (
  series_id TEXT REFERENCES board_series(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('admin', 'facilitator', 'member')) NOT NULL,
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (series_id, user_id)
);

CREATE TABLE boards (
  id TEXT PRIMARY KEY,
  series_id TEXT REFERENCES board_series(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT CHECK (status IN ('draft', 'active', 'completed', 'archived')) DEFAULT 'draft',
  current_scene_id TEXT,
  blame_free_mode BOOLEAN DEFAULT FALSE,
  voting_allocation INTEGER DEFAULT 3,
  voting_enabled BOOLEAN DEFAULT TRUE,
  meeting_date DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Board content structure
CREATE TABLE columns (
  id TEXT PRIMARY KEY,
  board_id TEXT REFERENCES boards(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  seq INTEGER NOT NULL,
  default_appearance TEXT CHECK (default_appearance IN ('shown', 'hidden', 'fixed')) DEFAULT 'shown',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE scene_column_settings (
  scene_id TEXT REFERENCES scenes(id) ON DELETE CASCADE,
  column_id TEXT REFERENCES columns(id) ON DELETE CASCADE,
  appearance TEXT CHECK (appearance IN ('shown', 'hidden', 'fixed')) NOT NULL,
  PRIMARY KEY (scene_id, column_id)
);

CREATE TABLE cards (
  id TEXT PRIMARY KEY,
  column_id TEXT REFERENCES columns(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id),
  content TEXT NOT NULL,
  group_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Scenes and workflow
CREATE TABLE scenes (
  id TEXT PRIMARY KEY,
  board_id TEXT REFERENCES boards(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  mode TEXT CHECK (mode IN ('columns', 'present', 'review')) NOT NULL,
  seq INTEGER NOT NULL,
  allow_add_cards BOOLEAN DEFAULT TRUE,
  allow_edit_cards BOOLEAN DEFAULT TRUE,
  allow_comments BOOLEAN DEFAULT TRUE,
  allow_voting BOOLEAN DEFAULT FALSE,
  multiple_votes_per_card BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Voting system (allows multiple votes when scene permits)
CREATE TABLE votes (
  id TEXT PRIMARY KEY,
  card_id TEXT REFERENCES cards(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Comments and action items (consolidated)
CREATE TABLE comments (
  id TEXT PRIMARY KEY,
  card_id TEXT REFERENCES cards(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id),
  content TEXT NOT NULL,
  is_action_item BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE action_item_assignments (
  comment_id TEXT REFERENCES comments(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (comment_id, user_id)
);

CREATE TABLE action_item_status (
  comment_id TEXT PRIMARY KEY REFERENCES comments(id) ON DELETE CASCADE,
  status TEXT CHECK (status IN ('open', 'in_progress', 'completed', 'cancelled')) DEFAULT 'open',
  due_date DATETIME,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Team health check system
CREATE TABLE health_questions (
  id TEXT PRIMARY KEY,
  board_id TEXT REFERENCES boards(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  seq INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE health_responses (
  id TEXT PRIMARY KEY,
  question_id TEXT REFERENCES health_questions(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(question_id, user_id)
);

-- Real-time state
CREATE TABLE presence (
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  board_id TEXT REFERENCES boards(id) ON DELETE CASCADE,
  last_seen INTEGER NOT NULL,
  current_activity TEXT,
  PRIMARY KEY (user_id, board_id)
);

-- Timer state
CREATE TABLE board_timers (
  board_id TEXT PRIMARY KEY REFERENCES boards(id) ON DELETE CASCADE,
  duration_seconds INTEGER NOT NULL,
  started_at INTEGER NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE timer_extension_votes (
  board_id TEXT REFERENCES board_timers(board_id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  vote TEXT CHECK (vote IN ('done', 'more_time')) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (board_id, user_id)
);
```

## API Structure

### REST Endpoints
```
# Authentication
POST   /api/auth/login
POST   /api/auth/register
POST   /api/auth/logout
GET    /api/auth/me

# Board series management
GET    /api/series                    # List user's series
POST   /api/series                    # Create new series
GET    /api/series/[id]               # Get series details
PUT    /api/series/[id]               # Update series
POST   /api/series/[id]/members       # Add member
DELETE /api/series/[id]/members/[uid] # Remove member

# Board management
GET    /api/boards                    # List user's recent boards
POST   /api/boards                    # Create new board (standalone or in series)
GET    /api/boards/[id]               # Get complete board data
PUT    /api/boards/[id]               # Update board settings
POST   /api/boards/[id]/participants  # Add participant
DELETE /api/boards/[id]               # Delete board

# Board content
GET    /api/boards/[id]/cards         # Get all cards
POST   /api/boards/[id]/cards         # Create new card
PUT    /api/cards/[id]                # Update card
DELETE /api/cards/[id]                # Delete card
POST   /api/cards/[id]/group          # Group cards

# Voting and comments
POST   /api/cards/[id]/vote           # Toggle vote
POST   /api/cards/[id]/comments       # Add comment
PUT    /api/comments/[id]             # Update comment (including action items)
DELETE /api/comments/[id]             # Delete comment

# Scenes and workflow
PUT    /api/boards/[id]/scene         # Change current scene
POST   /api/boards/[id]/timer         # Start/modify timer
DELETE /api/boards/[id]/timer         # Stop timer

# Team health checks
GET    /api/boards/[id]/health        # Get health check questions and responses
POST   /api/boards/[id]/health        # Submit health check response

# Presence
PUT    /api/boards/[id]/presence      # Update user presence
```

### WebSocket Messages (Outbound Only)
```javascript
// Board state changes
{
  type: 'card_created',
  board_id: 'board123',
  card: { /* card data */ }
}

{
  type: 'vote_changed',
  board_id: 'board123',
  card_id: 'card456',
  vote_count: 5
}

{
  type: 'scene_changed',
  board_id: 'board123',
  scene_id: 'scene789'
}

{
  type: 'timer_update',
  board_id: 'board123',
  timer: { remaining_seconds: 120, extension_votes: {...} }
}

{
  type: 'presence_update',
  board_id: 'board123',
  user_id: 'user456',
  activity: 'editing_card_123'
}
```

## Authorization Rules

### Board Access
```javascript
const canAccessBoard = (user, board) => {
  // Public boards via invite link - anyone can view
  if (board.public_link && !requiresInteraction) return true;

  // Must be member of the board's series
  return isSeriesMember(user, board.series_id);
};

const canEditBoard = (user, board) => {
  if (!canAccessBoard(user, board)) return false;
  if (!user.id) return false; // Anonymous users cannot edit

  return isSeriesMember(user, board.series_id);
};

const canFacilitate = (user, board) => {
  const membership = getSeriesMembership(user, board.series_id);
  return membership && ['admin', 'facilitator'].includes(membership.role);
};
```

## Development Phases

### Phase 1: Foundation
- **Local authentication system** with session management
- **Board series creation and management**
- **Database setup with normalized schema**
- **API framework with validation**
- **WebSocket infrastructure**

### Phase 2: Core Content Management
- **Card CRUD with Drag and Drop between columns**
- **Scene management with controls for the facilitator**
- **Column management and scene-based visibility controls**
- **Manual card grouping functionality**
- **Basic scene management and transitions**

Some notes:
- When a new board is created, it should initially show a page that says the board is empty and scenes need to be created.
  - The options on this page include adding a preset set of scenes to the board, or manually adding scenes via the scene creation interface.
- The scene creation interface is quite complex, and allows the creation of scenes and columns for the board.
  - The scene creation interface slides down from the top of the screen.
  - There are reference images to some of the controls from the original interface in /screensamples/ConfigureBoard-*.png

- The column names in the configuration dialog need to be editable.
- When displaying the board name in the board header, it should use this template: `<Board Name> - <Date>`
  - Example: "Planning - 2023-09-15"
- The default board name should be the name of the series and should not include the date.
- When displaying the list of board in a series, the board name should be displayed with the creation date in small text underneath.
- The text in  "Add a card..." textarea on teh top of the columns should not be synced across all columns.

Let's define the status of boards with 'draft', 'active', 'completed', 'archived' as follows:
- Draft: The board is in the initial creation phase and is not yet ready for use.  Only admins can view and edit the board.
- Active: The board is currently being used and is actively being updated. Users can view and edit the board if they are part of the series.  Users can be invited to join the series and see the currect board using the share link for an active board.
- Completed: The board has been finalized and is no longer being updated.  Users can view the board but cannot edit it.
- Archived: The board has been completed and is no longer being used.  Users can view the board but cannot edit it, and it does not appear in the list of boards in a series.


### Phase 3: Drag-and-Drop Organization
- **Drag-and-drop card positioning**
- **Visual card grouping interface**
- **Real-time position synchronization**
- **Responsive drag behavior for multiple users**

### Phase 4: Voting & Presence System
- **Voting system with configurable rules per scene**
- **Comprehensive presence tracking**
- **Facilitator voting dashboard** showing:
  - Total votes remaining across all users
  - Count of users who haven't voted at all
  - Individual user voting status
- **Real-time vote count updates**

### Phase 5: Advanced Workflow
- **Timer system with extension voting**
- **Team health check system with visual results**
- **Action item tracking with assignments**
- **Resolution carryover between series boards**

### Phase 6: Polish & Performance
- **Performance optimization for 40+ users**
- **AI-powered card grouping** (when API keys available)
- **Enhanced error handling and recovery**
- **Mobile-responsive improvements**

## Success Criteria

### Functional Requirements
- [ ] Real-time collaboration supports 40+ concurrent users per board
- [ ] All authentication and authorization works reliably
- [ ] Board creation, editing, and management works smoothly
- [ ] **Facilitator voting dashboard shows specific metrics**:
  - Total votes remaining across all participants
  - Count of users who haven't voted at all yet
  - Real-time updates as voting progresses
- [ ] Drag-and-drop card organization is intuitive and responsive
- [ ] **Resolution carryover** between boards in a series functions correctly

### Performance Requirements
- [ ] Page load times under 300ms on reasonable connections
- [ ] WebSocket message latency under 100ms for local network
- [ ] Database queries under 50ms for typical board sizes
- [ ] No blocking operations during real-time collaboration

### Developer Experience
- [ ] `npm i && npm run dev` creates working environment instantly
- [ ] Code is readable and manually maintainable (**MUST-HAVE**)
- [ ] Tests exist only for critical functionality
- [ ] Tests run with single command and don't affect dev data

## Future Features

These features extend the core retrospective functionality:

- **AI-powered card grouping** using clustering algorithms (when API keys configured)
- **Action item suggestions** based on card content patterns
- **Real-time collaborative editing** within individual cards
- **Observer mode** for stakeholders and leadership

## Risk Assessment

The Risk Assessment section helps identify potential development bottlenecks and technical challenges that could derail the project:

### High Risk Items
- **Real-time synchronization complexity** - 40+ concurrent users with instant updates
- **Drag-and-drop performance** - Smooth interactions with large numbers of cards
- **Timer system complexity** - Extension voting and real-time coordination

### Medium Risk Items
- **Authentication security** - Session management and board access controls
- **WebSocket connection reliability** - Handling network interruptions gracefully
- **Database performance** - SQLite limitations with high concurrent load

These risks should inform development priorities - tackle high-risk items early when there's time to iterate on solutions.
