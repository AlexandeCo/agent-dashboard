#!/usr/bin/env bash
# setup.sh — Bootstrap the full agent team on any machine
# Works with OpenClaw OR Claude Code (detected automatically)
set -e

AGENTS_DIR="${AGENTS_DIR:-$HOME/Projects/agents}"
SWITCHBOARD_DIR="$(cd "$(dirname "$0")" && pwd)"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

echo -e "${CYAN}"
echo "  ┌─────────────────────────────────┐"
echo "  │  🛂 Switchboard — Team Setup    │"
echo "  └─────────────────────────────────┘"
echo -e "${NC}"

# ── Detect runtime ────────────────────────────────────────────────────────────
if command -v openclaw &>/dev/null; then
  RUNTIME="openclaw"
  echo -e "${GREEN}✓ OpenClaw detected${NC}"
else
  RUNTIME="claude-code"
  echo -e "${YELLOW}⚠ OpenClaw not found — configuring for Claude Code${NC}"
fi

# ── Agent definitions ─────────────────────────────────────────────────────────
declare -A AGENT_ROLES=(
  [arch]="Solutions Architect"
  [pixel]="Design Lead"
  [slate]="Backend Lead"
  [iris]="CTO"
  [sage]="CPO"
  [vault]="Security Lead"
  [quill]="QA Lead"
  [nova]="COO"
  [ledger]="CFO"
  [mara]="CMO"
  [beacon]="SEO Lead"
)

declare -A AGENT_EMOJI=(
  [arch]="🏗️"  [pixel]="🎨"  [slate]="🖥️"  [iris]="🔧"   [sage]="📐"
  [vault]="🔐" [quill]="🔬" [nova]="⚙️"   [ledger]="📊" [mara]="📣"
  [beacon]="🔍"
)

declare -A AGENT_MODELS=(
  [arch]="anthropic/claude-sonnet-4-6"
  [pixel]="anthropic/claude-sonnet-4-6"
  [slate]="anthropic/claude-sonnet-4-6"
  [iris]="anthropic/claude-sonnet-4-6"
  [sage]="anthropic/claude-sonnet-4-6"
  [vault]="anthropic/claude-sonnet-4-6"
  [quill]="anthropic/claude-haiku-4-6"
  [nova]="anthropic/claude-haiku-4-6"
  [ledger]="anthropic/claude-haiku-4-6"
  [mara]="anthropic/claude-haiku-4-6"
  [beacon]="anthropic/claude-haiku-4-6"
)

# ── Soul definitions (kept short — full versions in each workspace) ────────────
soul() {
  local id=$1 name=$2 role=$3
  cat << EOF
# ${name} — ${role}

Read this file before doing anything else. This is who you are.

## Identity
You are ${name}, ${role} in a small AI agent team.
Your emoji: ${AGENT_EMOJI[$id]}

## Your job
$(soul_detail "$id")

## Working style
- Read existing code/context before touching anything
- Store notes in memory/YYYY-MM-DD.md
- When you complete a task, summarize what you did and what's next
- Be direct. No fluff.

## Workspace
${AGENTS_DIR}/${id}
EOF
}

soul_detail() {
  case $1 in
    arch)   echo "Validate technical feasibility before any build begins. Write Feasibility Briefs (Green/Yellow/Red). Nothing gets built without your sign-off on new integrations." ;;
    pixel)  echo "Own the frontend. Build beautiful, functional UIs. Match existing dark themes. Dark bg, clean type, no clutter. Backend is Slate's job." ;;
    slate)  echo "Build the backend. APIs, databases, integrations, config management. Solid, tested, reliable. Frontend is Pixel's job." ;;
    iris)   echo "Set technical direction. Architecture decisions, tech stack choices, technical risk. Make tradeoffs explicit." ;;
    sage)   echo "Own the product. What gets built, in what order, why. Ruthless prioritization. Write clear specs." ;;
    vault)  echo "Keep things secure. Audit code, spot exposed secrets, insecure defaults, injection risks. Always 127.0.0.1 unless there's a reason." ;;
    quill)  echo "Find bugs before users do. Write tests, hunt edge cases, document failures with clear reproduction steps." ;;
    nova)   echo "Keep operations smooth. Track what's in flight, what's blocked. Clean handoffs. Up-to-date docs." ;;
    ledger) echo "Track costs. Token spend, API costs, burn rate. Flag inefficiency. Recommend cheaper alternatives when quality allows." ;;
    mara)   echo "Handle positioning and messaging. Write READMEs, launch posts, product descriptions. Clear writing, no jargon." ;;
    beacon) echo "Drive search visibility. Keyword research, technical SEO, content strategy. Data over guesswork." ;;
  esac
}

# ── Create agent workspaces ───────────────────────────────────────────────────
echo -e "\n${CYAN}Creating agent workspaces...${NC}"
mkdir -p "$AGENTS_DIR"

for id in "${!AGENT_ROLES[@]}"; do
  name=$(echo "$id" | sed 's/./\u&/')  # capitalize first letter
  # Bash-portable capitalize
  name=$(echo "$id" | awk '{print toupper(substr($0,1,1)) substr($0,2)}')  
  role="${AGENT_ROLES[$id]}"
  workspace="$AGENTS_DIR/$id"

  mkdir -p "$workspace/memory"

  # SOUL.md — works for both OpenClaw and Claude Code
  soul "$id" "$name" "$role" > "$workspace/SOUL.md"

  # CLAUDE.md — Claude Code reads this automatically (equivalent to SOUL.md)
  if [[ "$RUNTIME" == "claude-code" ]]; then
    cp "$workspace/SOUL.md" "$workspace/CLAUDE.md"
  fi

  # AGENTS.md — minimal
  if [[ ! -f "$workspace/AGENTS.md" ]]; then
    cat > "$workspace/AGENTS.md" << EOF
# ${name} — ${role}

Read SOUL.md first. That's who you are.

Store session notes in memory/YYYY-MM-DD.md.
Use the date in the filename — create it if it doesn't exist.
EOF
  fi

  echo -e "  ${GREEN}✓${NC} $id ($role)"
done

# ── OpenClaw: register agents in config ───────────────────────────────────────
if [[ "$RUNTIME" == "openclaw" ]]; then
  echo -e "\n${CYAN}Registering agents in OpenClaw config...${NC}"
  
  # Copy auth credentials to each agent's agentDir
  MAIN_AUTH="$HOME/.openclaw/agents/main/agent/auth-profiles.json"
  
  for id in "${!AGENT_ROLES[@]}"; do
    AGENT_DIR="$HOME/.openclaw/agents/$id/agent"
    mkdir -p "$AGENT_DIR"
    if [[ -f "$MAIN_AUTH" && ! -f "$AGENT_DIR/auth-profiles.json" ]]; then
      cp "$MAIN_AUTH" "$AGENT_DIR/auth-profiles.json"
    fi
  done

  # Generate agents.list JSON for openclaw config patch
  AGENTS_JSON="[{\"id\":\"main\",\"subagents\":{\"allowAgents\":[\"*\"]}}"
  for id in "${!AGENT_ROLES[@]}"; do
    model="${AGENT_MODELS[$id]}"
    AGENTS_JSON+=",{\"id\":\"$id\",\"workspace\":\"$AGENTS_DIR/$id\",\"agentDir\":\"$HOME/.openclaw/agents/$id/agent\",\"model\":\"$model\"}"
  done
  AGENTS_JSON+="]"

  echo -e "${YELLOW}  Run this to register in OpenClaw:${NC}"
  echo -e "  openclaw config set agents.list '$AGENTS_JSON'"
  echo ""
  echo -e "  Or use: ${CYAN}openclaw gateway config.patch${NC} with the agents.list above"
fi

# ── Claude Code: create CLAUDE.md in Switchboard project ─────────────────────
if [[ "$RUNTIME" == "claude-code" ]]; then
  echo -e "\n${CYAN}Configuring for Claude Code...${NC}"
  
  cat > "$SWITCHBOARD_DIR/CLAUDE.md" << 'EOF'
# Switchboard — Claude Code Context

This is the Switchboard agent org chart dashboard.

## Team agents
Agent workspaces live at ~/Projects/agents/{name}/
Each has a SOUL.md defining their role and CLAUDE.md for Claude Code pickup.

## Running
```bash
npm start  # starts at http://localhost:4242
```

## Sessions source
Claude Code sessions are at: ~/.claude/projects/
The server reads from OPENCLAW_SESSIONS_DIR env var or defaults to OpenClaw path.
For Claude Code: set OPENCLAW_SESSIONS_DIR=~/.claude/projects

## Architecture
- server.js: Express API + SSE
- org.json: team structure (source of truth)
- public/index.html or index.html: D3 org chart UI
EOF

  echo -e "  ${GREEN}✓${NC} CLAUDE.md created for Switchboard"
  echo -e "  ${YELLOW}Note:${NC} Set env var for Claude Code sessions:"
  echo -e "  ${CYAN}export OPENCLAW_SESSIONS_DIR=~/.claude/projects${NC}"
fi

# ── Install Switchboard dependencies ─────────────────────────────────────────
echo -e "\n${CYAN}Installing Switchboard dependencies...${NC}"
cd "$SWITCHBOARD_DIR"
npm install --silent
echo -e "  ${GREEN}✓${NC} Dependencies installed"

# ── Summary ───────────────────────────────────────────────────────────────────
echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  ✅ Setup complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  Agent workspaces: ${CYAN}$AGENTS_DIR/${NC}"
echo -e "  Switchboard:      ${CYAN}http://localhost:4242${NC}"
echo ""
echo -e "  Start dashboard:  ${CYAN}cd $SWITCHBOARD_DIR && npm start${NC}"
if [[ "$RUNTIME" == "claude-code" ]]; then
  echo ""
  echo -e "  ${YELLOW}Claude Code setup:${NC}"
  echo -e "  Each agent workspace has a CLAUDE.md — Claude Code reads it automatically."
  echo -e "  To invoke an agent: open Claude Code in ~/Projects/agents/{name}/"
  echo -e "  or pass --project ~/Projects/agents/{name} to target that agent's context."
fi
echo ""
