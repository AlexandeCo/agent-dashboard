# Switchboard — Build Spec

## Overview
A real-time web dashboard for monitoring OpenClaw AI agents. Shows which agents are running, what they're working on, their activity/status, and an org chart view of agent hierarchy.

## Data Sources

### 1. Sessions Index
`~/.openclaw/agents/main/sessions/sessions.json`
A JSON object where keys are session keys like:
- `agent:main:main` — main web/TUI session
- `agent:main:discord:channel:XXXXXXX` — Discord channel sessions
- `agent:main:isolated:XXXX` — isolated sub-agents (spawned via sessions_spawn)

Each session entry has:
- `sessionId` (UUID) 
- `updatedAt` (timestamp ms)
- `sessionFile` (path to .jsonl)
- `model`, `modelProvider`
- `totalTokens`, `inputTokens`, `outputTokens`
- `chatType` (direct/channel)
- `displayName` or `groupChannel`
- `channel` (discord/webchat/etc)
- `abortedLastRun` (bool)

### 2. Session JSONL Files
Each session has a `.jsonl` file with event records:
- `{type: "session", id, timestamp, cwd}` — first line
- `{type: "message", id, parentId, timestamp, message: {role, content: [{type, text}]}}` — messages

Parse last N lines to get:
- Last user message (what was asked)
- Last assistant message (what it's working on / last response snippet)
- Is the session currently active (message within last 60s = "active", 5m = "recent")

## Architecture

### Backend: `server.js` (Node.js, no framework deps — use built-in `http` module)
Port: 4242

Endpoints:
- `GET /api/sessions` — return all sessions with parsed recent activity
- `GET /api/sessions/:sessionId/messages?limit=20` — last N messages from JSONL
- `GET /events` — SSE stream for real-time updates (watch sessions.json + JSONL files with fs.watch)

Session response shape:
```json
{
  "key": "agent:main:discord:channel:...",
  "sessionId": "uuid",
  "displayName": "discord:#vibe-code-with-ferdinand",
  "type": "main|isolated|discord|webchat",
  "status": "active|recent|idle",
  "model": "claude-sonnet-4-6",
  "updatedAt": 1234567890,
  "tokens": { "total": 22569, "input": 50, "output": 929 },
  "lastActivity": {
    "userMessage": "...",
    "assistantSnippet": "...",
    "timestamp": "..."
  },
  "parentKey": null,  // for org chart — infer from session key structure
  "aborted": false
}
```

For org chart parentKey inference:
- `agent:main:main` → root node (parentKey: null)
- `agent:main:discord:*` → parentKey: "agent:main:main"
- `agent:main:isolated:*` → parentKey from their spawner (store in a parentMap if available, else default to "agent:main:main")

### Frontend: `index.html` (single file, no build step — Vanilla JS + CSS)
Use ES modules, modern CSS. No frameworks needed.

#### Views (toggle via top nav):

**1. List View** (default)
- Grid of agent cards
- Each card shows:
  - Status indicator dot (green=active, yellow=recent, gray=idle)
  - Agent name/display name
  - Type badge (main/discord/isolated/webchat)
  - Model name
  - Token count
  - Last activity timestamp (relative: "2m ago")
  - Last user message (truncated to 80 chars)
  - Last assistant response snippet (truncated to 120 chars)
  - Click to expand → shows last 10 messages in a panel

**2. Org Chart View**
- Visual tree showing agent hierarchy
- Root: "Ferdinand (main)"
- Children: all sessions, grouped by type
- Use pure CSS for the tree lines (no external libs)
- Each node is a mini card: name, status dot, last activity
- Org chart style: top-down tree with connecting lines

#### Real-time updates
- Connect to `/events` SSE endpoint
- On `session-update` event: update the relevant card without full reload
- Show a "live" indicator in the header when SSE is connected

#### Design
- Dark theme, clean minimal UI
- CSS variables for theming
- Status colors: 
  - active: #22c55e (green)
  - recent: #f59e0b (amber)  
  - idle: #6b7280 (gray)
  - aborted: #ef4444 (red)
- Font: system-ui stack
- Header with "Switchboard" title, connection status, view toggle buttons

## File Structure
```
switchboard/
  server.js        ← Node.js backend
  index.html       ← Single-file frontend
  package.json     ← minimal (no deps if possible, or just nodemon for dev)
  README.md
```

## Key Requirements
- No npm install needed for the server (use Node built-ins only)
- `node server.js` starts everything on port 4242
- Auto-refreshes via SSE (no polling needed on client)
- Handles sessions.json being updated while running
- Gracefully shows "No agents found" if sessions dir doesn't exist
- Works with the actual data at: ~/.openclaw/agents/main/sessions/

## Startup notification
When completely done building and everything works, run:
openclaw system event --text "Done: Switchboard built at ~/Projects/switchboard — run 'node server.js' to start on port 4242" --mode now
