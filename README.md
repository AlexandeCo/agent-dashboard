# 🦉 Switchboard

> *Live monitoring and org chart for your AI agent team. See what every agent is doing, right now.*

![Switchboard](https://github.com/AlexandeCo/switchboard/raw/main/docs/preview.png)

*(screenshot coming soon)*

---

## What It Does

If you're running multiple AI agents — whether they're doing research, writing code, or managing workflows — you've probably wondered: **what are they actually doing right now?**

Switchboard gives you:

- **Live agent status** — which agents are active, what they're working on, when they last did something
- **Org chart view** — see the full hierarchy of who reports to whom, with live status dots
- **Session detail** — click any agent to see their recent conversation, last tool call, token usage
- **Real-time updates** — everything updates via SSE the moment an agent's state changes
- **Dismiss completed agents** — clean up finished one-off tasks without cluttering the view

Built for [OpenClaw](https://openclaw.ai) multi-agent setups, but the concepts apply to any agent orchestration system.

---

## Quickstart

```bash
git clone https://github.com/AlexandeCo/switchboard.git
cd switchboard
npm install
node server.js
```

Open **http://localhost:4242** 🦉

---

## Requirements

- Node.js 18+
- [OpenClaw](https://openclaw.ai) running locally (reads session data from `~/.openclaw/agents/main/sessions/`)

---

## Views

### List View
Agent cards showing:
- Status (🟢 Active / 🟡 Recent / ⚫ Idle)
- What they're currently working on
- Last tool call
- Token usage + cost estimate
- Time since last activity

### Org Chart View
D3.js tree visualization of your agent hierarchy. Click any node to open the detail panel. Zoom and pan. Nodes color-code by status in real-time.

---

## Org Configuration

Edit `org.json` to define your permanent agent hierarchy:

```json
{
  "nodes": [
    { "id": "ceo", "name": "You", "role": "CEO", "emoji": "👤", "type": "human", "parentId": null },
    { "id": "chief", "name": "Ferdinand", "role": "Chief of Staff", "emoji": "🦉", "type": "agent", "parentId": "ceo" },
    { "id": "cto", "name": "Iris", "role": "CTO", "emoji": "🔧", "type": "agent", "parentId": "chief" }
  ]
}
```

Named agents are always visible in the org chart. Ad-hoc sub-agents appear automatically while running and can be dismissed when done.

---

## Configuration

| Env var | Default | Description |
|---------|---------|-------------|
| `OPENCLAW_SESSIONS_DIR` | `~/.openclaw/agents/main/sessions` | Path to OpenClaw session data |
| `PORT` | `4242` | Dashboard port |

---

## Tech Stack

- **Backend:** Node.js + Express, chokidar file watcher, SSE
- **Frontend:** Vanilla JS + D3.js (no build step)
- **Data source:** OpenClaw session files (`.jsonl` + `sessions.json`)

---

## Contributing

PRs welcome. Keep it simple — no frameworks, no build pipelines.

## License

MIT © [AlexandeCo](https://github.com/AlexandeCo)
