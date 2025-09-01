# TeamBeat - Collaborative Retrospectives

A modern, real-time collaborative retrospective tool built with SvelteKit 5 and SQLite.

## Features

✅ **Real-time Collaboration** - WebSocket-powered real-time synchronization for 40+ concurrent users  
✅ **Authentication System** - Local username/password authentication with session management  
✅ **Board Series Management** - Organize retrospectives in series with role-based access control  
✅ **Multi-phase Workflow** - Structured meeting phases with facilitator controls  
✅ **Card Management** - Create, edit, group, and vote on retrospective cards  
✅ **Smart Voting System** - Configurable vote allocation with facilitator dashboard  
✅ **Scene Management** - Control meeting phases with customizable permissions  
✅ **Presence Tracking** - See who's actively participating in real-time  
✅ **Timer System** - Meeting timers with extension voting capabilities

## Architecture

- **Frontend**: SvelteKit 5 with Tailwind CSS
- **Backend**: SvelteKit API routes with TypeScript
- **Database**: SQLite with Drizzle ORM
- **Real-time**: Native WebSockets (port 8080)
- **Authentication**: Session-based with secure cookies

## Quick Start

```bash
# Install dependencies
npm install

# Set up database
npm run db:migrate

# Start development server
npm run dev
```

The application will be available at `http://localhost:5173`

## Database Commands

```bash
# Generate migration from schema changes
npm run db:generate

# Apply migrations
npm run db:migrate

# Open database studio
npm run db:studio
```

## Project Structure

```
src/
├── lib/
│   ├── server/
│   │   ├── db/              # Database schema and connection
│   │   ├── repositories/    # Data access layer
│   │   ├── websockets/      # Real-time messaging
│   │   └── auth/            # Authentication & sessions
│   └── components/          # Reusable UI components
├── routes/
│   ├── api/                 # REST API endpoints
│   ├── board/[id]/          # Board interface
│   ├── login/               # Authentication pages
│   └── register/
└── app.css                  # Global styles
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Sign in
- `POST /api/auth/logout` - Sign out
- `GET /api/auth/me` - Get current user

### Board Series
- `GET /api/series` - List user's series
- `POST /api/series` - Create new series
- `GET /api/series/[id]` - Get series details

### Boards
- `GET /api/boards` - List user's recent boards
- `POST /api/boards` - Create new board
- `GET /api/boards/[id]` - Get board details
- `PUT /api/boards/[id]/scene` - Change current scene

### Cards & Voting
- `GET /api/boards/[id]/cards` - Get all cards for board
- `POST /api/boards/[id]/cards` - Create new card
- `PUT /api/cards/[id]` - Update card content
- `DELETE /api/cards/[id]` - Delete card
- `POST /api/cards/[id]/vote` - Toggle vote on card
- `GET /api/boards/[id]/voting-stats` - Facilitator voting dashboard

### Real-time Features
- `PUT /api/boards/[id]/presence` - Update user presence
- `POST /api/boards/[id]/timer` - Start/vote on timer
- `DELETE /api/boards/[id]/timer` - Stop timer

## WebSocket Events

The application uses WebSockets on port 8080 for real-time updates:

- `card_created` - New card added
- `card_updated` - Card content changed
- `card_deleted` - Card removed
- `vote_changed` - Vote count updated
- `scene_changed` - Meeting phase changed
- `timer_update` - Timer status changed
- `presence_update` - User activity changed

## Development Status

This is a functional MVP implementation covering all core retrospective features:

- ✅ Authentication and user management
- ✅ Board series organization with roles
- ✅ Real-time card creation, editing, and voting
- ✅ Multi-phase meeting workflow
- ✅ Facilitator controls and voting dashboard
- ✅ WebSocket-powered collaboration
- ✅ Timer system with extension voting
- ✅ Presence tracking

## Future Enhancements

- [ ] AI-powered card grouping
- [ ] Drag-and-drop card organization  
- [ ] Team health check system
- [ ] Action item tracking with assignments
- [ ] Resolution carryover between boards
- [ ] Enhanced rich text editing (replace textarea)
- [ ] Mobile-responsive improvements
- [ ] SSO/OAuth integration

Built according to CLAUDE.md development guidelines emphasizing explicit over implicit code, libraries over custom solutions, and human-maintainable architecture.
