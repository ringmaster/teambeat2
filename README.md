# TeamBeat - Collaborative Retrospectives

A modern, real-time collaborative retrospective tool built with SvelteKit 5 and SQLite.

## Features

### Core Retrospective Features
- [x] **Real-time Collaboration** - SSE-powered real-time synchronization for 40+ concurrent users
- [x] **Board Series Management** - Organize retrospectives in series with role-based access control
- [x] **Multi-phase Workflow** - Structured meeting phases with facilitator controls
- [x] **Card Management** - Create, edit, group, and vote on retrospective cards
- [x] **Smart Voting System** - Configurable vote allocation with facilitator dashboard
- [x] **Scene Management** - Control meeting phases with customizable permissions
- [x] **Comments & Agreements** - Add comments to cards with agreement tracking
- [x] **Presence Tracking** - See who's actively participating in real-time
- [x] **Timer System** - Meeting timers with extension voting capabilities
- [x] **Board Templates** - Pre-configured templates (KAFE, Sailboat, Mad Sad Glad, etc.)
- [x] **Action Item Tracking** - Track and rollover action items between boards

### Authentication & Security
- [x] **Password Authentication** - Email/password authentication with secure sessions
- [x] **WebAuthn/Passkey Support** - Passwordless authentication with biometrics or security keys
- [x] **Email Verification** - Email verification with token-based confirmation
- [x] **Password Reset** - Secure password reset via email
- [x] **Admin System** - Admin-only access controls for sensitive features
- [x] **Rate Limiting** - Server-side rate limiting for auth and resource endpoints

### Data Collection & Analysis
- [x] **Scorecard System** - Create reusable data collection templates with formulas
- [x] **RPN Formula Evaluation** - Advanced formula system for scorecard calculations
- [x] **Data Source Management** - Configure multiple data sources per scorecard
- [x] **Scene-based Scorecards** - Run scorecards during specific meeting phases
- [x] **Results Tracking** - Flag and track scorecard results over time
- [x] **Health Check Surveys** - Team health check questionnaires with preset templates
- [x] **Quadrant Positioning** - Visual positioning tool with consensus calculation

### Performance & Administration
- [x] **Performance Monitoring** - Real-time performance metrics and analytics dashboard
- [x] **Time Series Charts** - Visual performance data with historical tracking
- [x] **Slow Query Detection** - Automatic detection of database performance issues
- [x] **Health Checks** - System health monitoring endpoint

## Architecture

- **Frontend**: SvelteKit 5 with custom design system (LESS)
- **Backend**: SvelteKit API routes with TypeScript
- **Database**: SQLite or PostgreSQL with Drizzle ORM
- **Real-time**: Server-Side Events (same port as HTTP)
- **Authentication**: Session-based with secure cookies

## Quick Start

### SQLite (Default)

```bash
# Install dependencies
npm install

# Generate and apply SQLite schema
npm run db:push:sqlite

# Start development server
npm run dev
```

The application will be available at `http://localhost:5173`

### PostgreSQL

```bash
# Install dependencies
npm install

# Set DATABASE_URL for PostgreSQL
export DATABASE_URL="postgresql://user:password@localhost/teambeat"

# Generate and apply PostgreSQL schema
npm run db:push:postgres

# Start development server with PostgreSQL
npm run dev
```

The database type is automatically detected from `DATABASE_URL`:
- Starts with `postgres://` or `postgresql://` → PostgreSQL
- Otherwise → SQLite (default: `./teambeat.db`)

## Docker Deployment

### Quick Docker Start

Use the provided docker-compose.yml for easy deployment:

```bash
# Build and start the application
docker-compose up --build

# Run in background
docker-compose up -d --build
```

The application will be available at `http://localhost:3000` with the database persisted in `./db/teambeat.db`.

### Manual Docker Build

```bash
# Build the Docker image
docker build -t teambeat .

# Create database directory
mkdir -p ./db

# Run the container
docker run -d \
  --name teambeat \
  -p 3000:3000 \
  -v $(pwd)/db:/db \
  -e DATABASE_URL=/db/teambeat.db \
  teambeat
```

### Docker Configuration

The Dockerfile uses a multi-stage build:
- **Stage 1**: Install dependencies
- **Stage 2**: Build the application
- **Stage 3**: Create optimized runtime image with Node.js

Key features:
- SQLite database mounted at `/db` directory
- Non-root user for security
- Health checks for container monitoring
- Automatic database migration on startup
- Port 3000 exposed by default

### Environment Variables

- `DATABASE_URL`: Path to SQLite database file (default: `/db/teambeat.db`)
- `PORT`: Application port (default: `3000`)
- `NODE_ENV`: Environment mode (set to `production` in container)

### Volume Mounts

- `/db`: Database directory (required for data persistence)
- `/app/logs`: Application logs (optional)

## Database Commands

### SQLite

```bash
# Generate SQLite migration from schema changes
npm run db:generate:sqlite

# Apply SQLite schema to database
npm run db:push:sqlite

# Open database studio
npm run db:studio
```

### PostgreSQL

```bash
# Generate PostgreSQL migration from schema changes
DATABASE_URL="postgresql://localhost/teambeat" npm run db:generate:postgres

# Apply PostgreSQL schema to database
DATABASE_URL="postgresql://user:pass@host/db" npm run db:push:postgres

# Open database studio
DATABASE_URL="postgresql://user:pass@host/db" npm run db:studio
```

Both databases use the same schema with automatic type adaptation:
- **Booleans**: Native `boolean` in PostgreSQL, `integer` in SQLite
- **Timestamps**: ISO 8601 text strings in both databases
- **Transactions**: Async transactions work with both backends

## Project Structure

```
src/
├── lib/
│   ├── server/
│   │   ├── db/              # Database schema and connection
│   │   ├── repositories/    # Data access layer
│   │   ├── sse/             # Server-Side Events handling
│   │   ├── auth/            # Authentication, sessions & WebAuthn
│   │   ├── performance/     # Performance tracking & persistence
│   │   ├── middleware/      # Request middleware (presence, etc.)
│   │   └── utils/           # Shared server utilities
│   ├── components/          # Reusable UI components
│   │   └── ui/              # Base UI components
│   ├── stores/              # Client-side state management
│   ├── utils/               # Shared utilities (RPN, data parsing)
│   ├── styles/              # LESS styles and mixins
│   ├── data/                # Static data (column presets)
│   └── types/               # TypeScript type definitions
├── routes/
│   ├── api/                 # REST API endpoints
│   │   ├── auth/            # Authentication endpoints
│   │   ├── boards/          # Board management
│   │   ├── cards/           # Card operations
│   │   ├── comments/        # Comments & agreements
│   │   ├── series/          # Series management
│   │   ├── scenes/          # Scene configuration
│   │   ├── scorecards/      # Scorecard management
│   │   ├── admin/           # Admin-only endpoints
│   │   └── sse/             # Real-time events
│   ├── board/[id]/          # Board interface
│   ├── series/[id]/         # Series management pages
│   ├── admin/               # Admin pages
│   ├── login/               # Authentication pages
│   ├── register/
│   └── profile/
├── app.html                 # Root HTML template
└── hooks.server.ts          # Server-side hooks
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Sign in with password
- `POST /api/auth/logout` - Sign out
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/profile` - Update user profile
- `PUT /api/auth/change-password` - Change password
- `DELETE /api/auth/delete-account` - Delete user account
- `POST /api/auth/dev-login` - Development login (dev only)
- `POST /api/auth/verify-email` - Verify email with token
- `POST /api/auth/send-verification-email` - Send verification email
- `POST /api/auth/request-password-reset` - Request password reset email
- `POST /api/auth/reset-password` - Reset password with token
- `GET /api/auth/email-config` - Get email configuration status

### WebAuthn/Passkey Authentication
- `POST /api/auth/webauthn/register/begin` - Start passkey registration
- `POST /api/auth/webauthn/register/complete` - Complete passkey registration
- `POST /api/auth/webauthn/authenticate/begin` - Start passkey authentication
- `POST /api/auth/webauthn/authenticate/complete` - Complete passkey authentication
- `GET /api/auth/webauthn/passkeys` - List user's passkeys
- `DELETE /api/auth/webauthn/passkeys/[id]` - Delete a passkey

### Board Series
- `GET /api/series` - List user's series
- `POST /api/series` - Create new series
- `GET /api/series/[id]` - Get series details
- `PUT /api/series/[id]` - Update series
- `DELETE /api/series/[id]` - Delete series
- `GET /api/series/[id]/users` - Get series users
- `POST /api/series/[id]/users` - Add user to series
- `GET /api/series/[seriesId]/columns` - Get series column presets
- `GET /api/series/[seriesId]/scorecards` - List series scorecards
- `POST /api/series/[seriesId]/scorecards` - Create series scorecard
- `PUT /api/series/[seriesId]/scorecards/[id]` - Update scorecard
- `DELETE /api/series/[seriesId]/scorecards/[id]` - Delete scorecard

### Boards
- `GET /api/boards` - List user's recent boards
- `POST /api/boards` - Create new board
- `GET /api/boards/[id]` - Get board details
- `PUT /api/boards/[id]` - Update board
- `DELETE /api/boards/[id]` - Delete board
- `POST /api/boards/[id]/clone` - Clone board
- `GET /api/boards/[id]/clone-sources` - Get available boards to clone from
- `PUT /api/boards/[id]/scene` - Change current scene
- `PUT /api/boards/[id]/setup-template` - Setup board template
- `GET /api/boards/[id]/present-data` - Get present mode data
- `GET /api/boards/[id]/user-votes` - Get user's vote data
- `GET /api/boards/[id]/user-status` - Get voting status info
- `GET /api/boards/[id]/column-presets` - Get column presets for board

### Scenes & Columns
- `GET /api/boards/[id]/scenes` - Get board scenes
- `POST /api/boards/[id]/scenes` - Create scene
- `GET /api/boards/[id]/scenes/[sceneId]` - Get scene details
- `PUT /api/boards/[id]/scenes/[sceneId]` - Update scene
- `DELETE /api/boards/[id]/scenes/[sceneId]` - Delete scene
- `PUT /api/boards/[id]/scenes/reorder` - Reorder scenes
- `GET /api/boards/[id]/scenes/[sceneId]/columns` - Get scene columns
- `GET /api/scenes/[id]/select-card` - Select presentation card
- `GET /api/boards/[id]/columns` - Get board columns
- `POST /api/boards/[id]/columns` - Create column
- `PUT /api/boards/[id]/columns/[columnId]` - Update column
- `DELETE /api/boards/[id]/columns/[columnId]` - Delete column
- `PUT /api/boards/[id]/columns/reorder` - Reorder columns

### Cards & Voting
- `GET /api/boards/[id]/cards` - Get all cards for board
- `POST /api/boards/[id]/cards` - Create new card
- `POST /api/boards/[id]/cards/group` - Group multiple cards
- `GET /api/cards/[id]` - Get card details
- `PUT /api/cards/[id]` - Update card content
- `DELETE /api/cards/[id]` - Delete card
- `PUT /api/cards/[id]/move` - Move card between columns
- `PUT /api/cards/[id]/group` - Group cards together
- `PUT /api/cards/[id]/group-onto` - Group card onto another
- `POST /api/cards/[id]/vote` - Toggle vote on card
- `GET /api/boards/[id]/voting-stats` - Facilitator voting dashboard
- `POST /api/boards/[id]/votes/clear` - Clear all votes
- `POST /api/boards/[id]/votes/increase-allocation` - Increase vote allocation

### Comments & Agreements
- `GET /api/boards/[id]/comments` - Get board comments
- `POST /api/cards/[id]/comments` - Add comment to card
- `GET /api/comments/[id]` - Get comment details
- `PUT /api/comments/[id]` - Update comment
- `DELETE /api/comments/[id]` - Delete comment
- `POST /api/comments/[id]/toggle-agreement` - Toggle agreement on comment
- `POST /api/comments/[id]/complete` - Mark comment as complete
- `POST /api/comments/[id]/copy-to-card` - Convert comment to card
- `GET /api/boards/[id]/agreements` - Get board agreements
- `GET /api/agreements/[id]` - Get agreement details
- `PUT /api/agreements/[id]` - Update agreement
- `DELETE /api/agreements/[id]` - Delete agreement
- `POST /api/agreements/[id]/complete` - Mark agreement as complete
- `POST /api/agreements/[id]/copy-to-card` - Convert agreement to card

### Card Notes
- `GET /api/cards/[id]/notes` - Get card notes
- `PUT /api/cards/[id]/notes` - Update card notes
- `POST /api/cards/[id]/notes/lock` - Lock/unlock notes editing

### Scorecards
- `GET /api/scorecards/[scorecardId]/datasources` - List scorecard data sources
- `POST /api/scorecards/[scorecardId]/datasources` - Create data source
- `PUT /api/scorecards/[scorecardId]/datasources/[id]` - Update data source
- `DELETE /api/scorecards/[scorecardId]/datasources/[id]` - Delete data source
- `PUT /api/scorecards/[scorecardId]/datasources/reorder` - Reorder data sources

### Scene Scorecards
- `GET /api/scenes/[sceneId]/scorecards` - List scene scorecards
- `POST /api/scenes/[sceneId]/scorecards` - Add scorecard to scene
- `GET /api/scene-scorecards/[id]` - Get scene scorecard details
- `PUT /api/scene-scorecards/[id]` - Update scene scorecard
- `DELETE /api/scene-scorecards/[id]` - Remove scorecard from scene
- `POST /api/scene-scorecards/[id]/collect-data` - Trigger data collection
- `GET /api/scene-scorecards/[id]/results` - Get scorecard results
- `POST /api/scene-scorecard-results/[resultId]/flag` - Flag a result

### Health Check Surveys
- `GET /api/health-question-presets` - Get available health question presets
- `GET /api/health-questions/[id]` - Get health question details
- `POST /api/health-questions/[id]/copy-to-card` - Convert health question to card
- `GET /api/health-responses` - List health responses
- `GET /api/scenes/[sceneId]/health-questions` - Get health questions for scene
- `PUT /api/scenes/[sceneId]/health-questions/reorder` - Reorder health questions
- `GET /api/scenes/[sceneId]/health-responses` - Get responses for scene
- `GET /api/scenes/[sceneId]/health-results` - Get aggregated health results
- `POST /api/scenes/[sceneId]/apply-health-preset` - Apply health question preset

### Quadrant Positioning
- `GET /api/quadrant-positions/[id]` - Get quadrant position details
- `POST /api/cards/[cardId]/quadrant-position` - Create/update card quadrant position
- `GET /api/scenes/[sceneId]/quadrant/positions` - Get all quadrant positions for scene
- `POST /api/scenes/[sceneId]/quadrant/start-input` - Start quadrant input phase
- `POST /api/scenes/[sceneId]/quadrant/calculate-consensus` - Calculate consensus positions
- `POST /api/scenes/[sceneId]/quadrant/facilitator-position` - Update facilitator position
- `POST /api/scenes/[sceneId]/quadrant/reset-all-positions` - Reset all quadrant positions

### Real-time Features
- `GET /api/sse` - Server-Side Events endpoint
- `PUT /api/boards/[id]/presence` - Update user presence
- `POST /api/boards/[id]/timer` - Start/vote on timer
- `DELETE /api/boards/[id]/timer` - Stop timer
- `POST /api/timer/vote` - Vote on timer extension

### Administration
- `GET /api/admin/performance` - Get performance metrics (admin only)
- `POST /api/admin/performance` - Reset performance metrics (admin only)
- `GET /api/admin/performance/history` - Get historical performance data (admin only)
- `GET /api/admin/performance/timeseries` - Get time series data (admin only)
- `GET /api/admin/users/[userId]` - Get user details (admin only)
- `POST /api/admin/users/[userId]/verify` - Verify user email (admin only)
- `POST /api/admin/users/generate-reset-token` - Generate password reset token (admin only)
- `POST /api/admin/analytics/snapshot` - Create analytics snapshot (admin only)
- `GET /api/admin/schema` - Get database schema introspection (admin only)

### System
- `GET /api/health` - Health check endpoint
- `GET /api/templates` - Get available board templates

## SSE Events

The application uses Server-Side Events streamed on the same port as the web application for real-time updates:

### Card Events
- `card_created` - New card added to board
- `card_updated` - Card content or properties changed
- `card_deleted` - Card removed from board

### Voting & Comments
- `vote_changed` - Vote count updated on card
- `all_votes_updated` - All vote data revealed (facilitator action)
- `comment_added` - New comment added to card
- `agreements_updated` - Agreements list updated on board

### Scene & Board State
- `scene_changed` - Meeting phase changed
- `scene_created` - New scene added to board
- `scene_updated` - Scene configuration changed
- `board_updated` - Board settings or metadata changed
- `columns_updated` - Column configuration changed
- `update_presentation` - Present mode display updated
- `present_filter_changed` - Present mode filter changed

### User Presence
- `user_joined` - User joined board
- `user_left` - User left board
- `presence_update` - User activity changed (includes presence_data)
- `presence_ping` - Server ping to maintain presence

### Timer
- `timer_update` - Timer status changed (includes start/stop/vote data)

### Scorecard Events
- `scorecard_data_collected` - Scorecard data collection completed
- `scorecard_attached` - Scorecard attached to scene
- `scorecard_detached` - Scorecard removed from scene
- `scorecard_result_flagged` - Scorecard result flagged

### Quadrant Events
- `quadrant_phase_changed` - Quadrant input/consensus phase changed
- `quadrant_results_calculated` - Consensus positions calculated
- `card_quadrant_adjusted` - Card quadrant position adjusted
- `quadrant_facilitator_position_updated` - Facilitator adjusted card position

## Development Status

### Production-Ready Features

**Core Retrospective:**
- [x] Authentication (password + WebAuthn/passkey + email verification + password reset)
- [x] Board series organization with role-based access
- [x] Real-time card creation, editing, and voting
- [x] Multi-phase meeting workflow with scene management
- [x] Card grouping and organization
- [x] Comments and agreements on cards
- [x] Facilitator controls and voting dashboard
- [x] SSE-powered real-time collaboration
- [x] Timer system with extension voting
- [x] Presence tracking with ping/pong
- [x] Action item tracking with rollover
- [x] Board cloning and templates
- [x] Card notes with locking

**Data Collection & Analysis:**
- [x] Scorecard system with RPN formula evaluation
- [x] Scene-based scorecard execution
- [x] Multi-source data collection
- [x] Results tracking and flagging
- [x] Time series visualization
- [x] Health check surveys with preset templates
- [x] Quadrant positioning with consensus calculation

**Administration:**
- [x] Performance monitoring dashboard
- [x] Real-time metrics tracking
- [x] Slow query detection
- [x] Historical data retention (7 days)
- [x] Rate limiting for auth/resource endpoints
- [x] Admin user management and verification

**Infrastructure:**
- [x] SQLite and PostgreSQL support
- [x] Database migration system
- [x] Docker deployment
- [x] Digital Ocean App Platform support
- [x] Health check endpoints

### Known Issues

- [ ] Automated PostgreSQL migrations via drizzle-kit push (use generate + migrate instead)
- [ ] Template scene option values not fully populated
- [ ] Direct navigation to linked board after registration

### Future Enhancements

**User Experience:**
- [ ] Scene-based tutorial popups
- [ ] Enhanced responsive design for mobile
- [ ] Rich text editor for card content
- [ ] Drag-and-drop card reordering within columns
- [ ] Keyboard shortcuts

**Features:**
- [ ] Anonymous/guest user board access
- [ ] AI-powered card grouping suggestions
- [ ] Action item assignment to specific users
- [ ] Export board data (PDF, CSV, JSON)
- [ ] Board archiving and search

**Security & Integration:**
- [ ] CSRF protection
- [ ] SSO/OAuth integration
- [ ] Two-factor authentication (TOTP)
- [ ] Audit logging
- [ ] API rate limiting per user

**Performance:**
- [ ] Redis for session storage (horizontal scaling)
- [ ] CDN integration for static assets
- [ ] Database query optimization
- [ ] Connection pooling for PostgreSQL

## License

MIT License. See `LICENSE` file for details.

The DiceBear avatar style [Adventurer](https://www.dicebear.com/styles/adventurer/) is a remix of: [Adventurer](https://www.figma.com/community/file/1184595184137881796) by [Lisa Wischofsky](https://www.instagram.com/lischi_art/), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
