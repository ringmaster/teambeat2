# TeamBeat - Collaborative Retrospectives

A modern, real-time collaborative retrospective tool built with SvelteKit 5 and SQLite.

## Features

- [x] **Real-time Collaboration** - SSE-powered real-time synchronization for 40+ concurrent users
- [x] **Authentication System** - Local username/password authentication with session management
- [x] **Board Series Management** - Organize retrospectives in series with role-based access control
- [x] **Multi-phase Workflow** - Structured meeting phases with facilitator controls
- [x] **Card Management** - Create, edit, group, and vote on retrospective cards
- [x] **Smart Voting System** - Configurable vote allocation with facilitator dashboard
- [x] **Scene Management** - Control meeting phases with customizable permissions
- [x] **Presence Tracking** - See who's actively participating in real-time
- [x] **Timer System** - Meeting timers with extension voting capabilities

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
│   │   └── auth/            # Authentication & sessions
│   ├── components/          # Reusable UI components
│   │   └── ui/              # Base UI components
│   ├── stores/              # Client-side state management
│   ├── utils/               # Shared utilities
│   └── assets/              # Static assets
├── routes/
│   ├── api/                 # REST API endpoints
│   ├── board/[id]/          # Board interface
│   ├── login/               # Authentication pages
│   └── register/
├── app.html                 # Root HTML template
└── app.less                 # Global styles
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Sign in
- `POST /api/auth/logout` - Sign out
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/profile` - Update user profile
- `PUT /api/auth/change-password` - Change password
- `DELETE /api/auth/delete-account` - Delete user account

### Board Series
- `GET /api/series` - List user's series
- `POST /api/series` - Create new series
- `GET /api/series/[id]` - Get series details
- `PUT /api/series/[id]` - Update series
- `DELETE /api/series/[id]` - Delete series
- `GET /api/series/[id]/users` - Get series users
- `POST /api/series/[id]/users` - Add user to series

### Boards
- `GET /api/boards` - List user's recent boards
- `POST /api/boards` - Create new board
- `GET /api/boards/[id]` - Get board details
- `PUT /api/boards/[id]` - Update board
- `DELETE /api/boards/[id]` - Delete board
- `POST /api/boards/[id]/clone` - Clone board
- `PUT /api/boards/[id]/scene` - Change current scene
- `PUT /api/boards/[id]/setup-template` - Setup board template

### Scenes & Columns
- `GET /api/boards/[id]/scenes` - Get board scenes
- `POST /api/boards/[id]/scenes` - Create scene
- `PUT /api/boards/[id]/scenes/[sceneId]` - Update scene
- `DELETE /api/boards/[id]/scenes/[sceneId]` - Delete scene
- `PUT /api/boards/[id]/scenes/reorder` - Reorder scenes
- `GET /api/boards/[id]/columns` - Get board columns
- `POST /api/boards/[id]/columns` - Create column
- `PUT /api/boards/[id]/columns/[columnId]` - Update column
- `DELETE /api/boards/[id]/columns/[columnId]` - Delete column
- `PUT /api/boards/[id]/columns/reorder` - Reorder columns

### Cards & Voting
- `GET /api/boards/[id]/cards` - Get all cards for board
- `POST /api/boards/[id]/cards` - Create new card
- `PUT /api/cards/[id]` - Update card content
- `DELETE /api/cards/[id]` - Delete card
- `PUT /api/cards/[id]/move` - Move card between columns
- `PUT /api/cards/[id]/group` - Group cards together
- `PUT /api/cards/[id]/group-onto` - Group card onto another
- `POST /api/cards/[id]/vote` - Toggle vote on card
- `GET /api/boards/[id]/voting-stats` - Facilitator voting dashboard

### Real-time Features
- `GET /api/sse` - Server-Side Events endpoint
- `PUT /api/boards/[id]/presence` - Update user presence
- `POST /api/boards/[id]/timer` - Start/vote on timer
- `DELETE /api/boards/[id]/timer` - Stop timer

### Templates
- `GET /api/templates` - Get available board templates

## SSE Events

The application uses Server-Side Events streamed on the same port as the web application for real-time updates:

- `card_created` - New card added
- `card_updated` - Card content changed
- `card_deleted` - Card removed
- `vote_changed` - Vote count updated
- `scene_changed` - Meeting phase changed
- `timer_update` - Timer status changed
- `presence_update` - User activity changed
- `board_updated` - Board settings changed
- `columns_updated` - Column configuration changed
- `comment_added` - New comment added
- `user_joined` - User joined board
- `user_left` - User left board

## Development Status

This is a functional MVP implementation covering all core retrospective features:

- [x] Authentication and user management
- [x] Board series organization with roles
- [x] Real-time card creation, editing, and voting
- [x] Multi-phase meeting workflow
- [x] Drag-and-drop card organization
- [x] Facilitator controls and voting dashboard
- [x] SSE-powered sync collaboration
- [x] Timer system with extension voting
- [x] Presence tracking
- [x] Action item tracking
- [x] Rollover of action items between boards

## Bug Fixes

- [ ] Templates to include scene option values
- [ ] Column property editing for default_appearance values
- [ ] Automated Postgres migrations that work properly
- [ ] Go directly to linked board after registration

## Future Enhancements

- [ ] Scene-based tutorial popups
- [ ] Session security improvements (CSRF protection)
- [ ] Anonymous user join support
- [ ] In-column ordering of cards
- [ ] AI-powered card grouping
- [ ] Team health check system
- [ ] Action item assignments
- [ ] Enhanced rich text editing (replace textarea)
- [ ] Responsive CSS improvements
- [ ] SSO/OAuth integration

Built according to CLAUDE.md development guidelines emphasizing explicit over implicit code, libraries over custom solutions, and human-maintainable architecture.

## License

MIT License. See `LICENSE` file for details.

The DiceBear avatar style [Adventurer](https://www.dicebear.com/styles/adventurer/) is a remix of: [Adventurer](https://www.figma.com/community/file/1184595184137881796) by [Lisa Wischofsky](https://www.instagram.com/lischi_art/), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
