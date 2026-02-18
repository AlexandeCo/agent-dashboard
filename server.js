const express = require('express');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const chokidar = require('chokidar');
const os = require('os');

// Read agent name from IDENTITY.md
function readAgentName() {
  try {
    const identity = fs.readFileSync(
      path.join(os.homedir(), '.openclaw', 'workspace', 'IDENTITY.md'), 'utf8'
    );
    const match = identity.match(/\*\*Name:\*\*\s*(.+)/);
    return match ? match[1].trim() : 'Agent';
  } catch { return 'Agent'; }
}

// Generate human-friendly display name for a session
function friendlyName(key, meta, sessionType) {
  const agentName = readAgentName();

  // Subagents: use label if set, else fallback
  if (sessionType === 'subagent') {
    if (meta.label) return meta.label;
    const id = (meta.sessionId || key).slice(0, 6);
    return `Sub-agent #${id}`;
  }

  // Channel sessions: "Ferdinand • Discord #channel-name"
  if (sessionType === 'channel') {
    const ch = meta.channel || '';
    const chLabel = ch.charAt(0).toUpperCase() + ch.slice(1); // "Discord"
    const group = meta.groupChannel || meta.chatType || '';
    return `${agentName} • ${chLabel}${group ? ' ' + group : ''}`;
  }

  // Main session
  if (sessionType === 'main') {
    return `${agentName} • Main`;
  }

  return meta.displayName || key;
}

const app = express();
const PORT = 4242;

const SESSIONS_DIR = path.join(os.homedir(), '.openclaw', 'agents', 'main', 'sessions');
const SESSIONS_JSON = path.join(SESSIONS_DIR, 'sessions.json');

// SSE clients
const sseClients = new Set();

function broadcast(data) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) {
    try { res.write(payload); } catch (_) {}
  }
}

// Read last N lines of a JSONL file
async function readLastLines(filePath, n = 40) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.trim().split('\n').filter(Boolean);
    return lines.slice(-n).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  } catch {
    return [];
  }
}

// Read all lines of a JSONL file (for full analysis — first line for createdAt, early lines for role)
async function readAllLines(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.trim().split('\n').filter(Boolean);
    return lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  } catch {
    return [];
  }
}

// Extract agent role/name from system prompt or early messages
function extractAgentRole(allLines) {
  // 1) Look for a type="message" with role="system"
  for (const entry of allLines.slice(0, 20)) {
    if (entry.type !== 'message') continue;
    const msg = entry.message;
    if (!msg) continue;
    if (msg.role === 'system') {
      const text = Array.isArray(msg.content)
        ? msg.content.find(c => c.type === 'text')?.text
        : (typeof msg.content === 'string' ? msg.content : null);
      if (text) {
        // Look for "You are X" or "You are **X**" patterns
        const m = text.match(/You are\s+\*{0,2}([A-Z][a-zA-Z0-9 _-]{1,40})\*{0,2}[,.\s]/);
        if (m) return m[1].trim();
        // "Your role is X"
        const m2 = text.match(/Your role is\s+\*{0,2}([A-Z][a-zA-Z0-9 _-]{1,40})\*{0,2}/);
        if (m2) return m2[1].trim();
      }
    }
  }

  // 2) Look in early user messages for subagent task context
  //    The subagent task often starts with "You are **Name**,"
  for (const entry of allLines.slice(0, 10)) {
    if (entry.type !== 'message') continue;
    const msg = entry.message;
    if (!msg || msg.role !== 'user') continue;
    const text = Array.isArray(msg.content)
      ? msg.content.find(c => c.type === 'text')?.text
      : (typeof msg.content === 'string' ? msg.content : null);
    if (!text) continue;
    // Look for "You are **Name**" at the start of a message
    const m = text.match(/You are\s+\*\*([A-Z][a-zA-Z0-9 _-]{1,40})\*\*/);
    if (m) return m[1].trim();
    // Look for "[Subagent Task]: You are **Name**"
    const m2 = text.match(/\[Subagent Task\].*?You are\s+\*\*([A-Z][a-zA-Z0-9 _-]{1,40})\*\*/s);
    if (m2) return m2[1].trim();
  }

  return null;
}

// Extract useful info from JSONL messages
function extractSessionActivity(lines, allLines) {
  let lastUserMsg = null;
  let lastAssistantMsg = null;
  let lastToolCall = null;
  let currentTask = null;
  const recentTools = [];
  let isThinking = false;

  for (const entry of lines) {
    if (entry.type !== 'message') continue;
    const msg = entry.message;
    if (!msg) continue;

    if (msg.role === 'user') {
      // Find text content
      let text = Array.isArray(msg.content)
        ? msg.content.find(c => c.type === 'text')?.text
        : msg.content;
      if (text && typeof text === 'string') {
        // Strip Discord/channel metadata wrapper — extract actual human text
        if (text.startsWith('Conversation info (untrusted metadata)')) {
          // The real message appears after the last ``` block (after sender/reply metadata)
          // and often starts with <@mention> or directly with the message
          const parts = text.split('```');
          const afterBlocks = parts[parts.length - 1] || '';
          // Strip leading <@mention> tags
          const stripped = afterBlocks.replace(/^[\s\n]*(<@\d+>[\s]*)*/m, '').trim();
          text = stripped || text;
        }

        // For [Subagent Context] messages, extract actual task after the header
        if (text.startsWith('[') && text.includes('[Subagent Context]')) {
          const afterCtx = text.replace(/^\[.*?\[Subagent Context\][^\n]*\n/m, '').trim();
          text = afterCtx || text;
        }

        // Filter timestamps like "[Wed 2026-02-18 10:39 EST] ..."
        let cleanText = text.replace(/^\[\w{3} \d{4}-\d{2}-\d{2} \d{2}:\d{2} \w+\]\s*/, '');

        const isSystemNoise = cleanText.startsWith('[System') || cleanText.startsWith('System:')
          || cleanText.startsWith('{') || cleanText.startsWith('[Subagent');
        if (!isSystemNoise && cleanText.length > 2) {
          lastUserMsg = { text: cleanText.slice(0, 300), timestamp: entry.timestamp };
          currentTask = { text: cleanText.slice(0, 400), timestamp: entry.timestamp };
        }
      }
    }

    if (msg.role === 'assistant') {
      const content = Array.isArray(msg.content) ? msg.content : [];
      const textBlock = content.find(c => c.type === 'text');
      const toolBlocks = content.filter(c => c.type === 'tool_use');

      if (textBlock?.text) {
        lastAssistantMsg = { text: textBlock.text.slice(0, 300), timestamp: entry.timestamp };
      }

      // Collect all tool calls from this assistant turn
      for (const toolBlock of toolBlocks) {
        if (toolBlock.name) {
          recentTools.push({ name: toolBlock.name, timestamp: entry.timestamp });
          // Keep lastToolCall pointing to the very last tool used
          lastToolCall = { name: toolBlock.name, timestamp: entry.timestamp };
        }
      }
    }
  }

  // Trim recentTools to last 3, most-recent first
  const recentToolsTrimmed = recentTools.slice(-3).reverse();

  // Determine if session is actively running a turn
  // If last entry in the window is a user message or tool result, agent is mid-turn
  const lastEntry = lines[lines.length - 1];
  if (lastEntry?.message?.role === 'user' || lastEntry?.message?.role === 'toolResult') {
    isThinking = true;
  }

  // createdAt: timestamp from first line of full JSONL
  let createdAt = null;
  if (allLines && allLines.length > 0) {
    createdAt = allLines[0].timestamp || null;
  }

  return { lastUserMsg, lastAssistantMsg, lastToolCall, currentTask, recentTools: recentToolsTrimmed, isThinking, createdAt };
}

// Load all session data
async function loadSessions() {
  let sessionsJson = {};
  try {
    sessionsJson = JSON.parse(fs.readFileSync(SESSIONS_JSON, 'utf8'));
  } catch {
    return [];
  }

  const sessions = [];
  for (const [key, meta] of Object.entries(sessionsJson)) {
    // sessionFile may be missing for channel/subagent sessions — derive from sessionId
    const sessionFile = meta.sessionFile ||
      (meta.sessionId ? path.join(SESSIONS_DIR, `${meta.sessionId}.jsonl`) : null);

    // Read last 60 lines for activity extraction
    const lines = sessionFile ? await readLastLines(sessionFile, 60) : [];

    // Read all lines for role extraction and createdAt (cheap: just need first + first few)
    // We do a targeted read: first line for createdAt, first 20 lines for role
    let allLines = [];
    if (sessionFile) {
      try {
        const content = fs.readFileSync(sessionFile, 'utf8');
        const rawLines = content.trim().split('\n').filter(Boolean);
        // Parse only what we need: first 20 for role + createdAt, we already have last 60
        allLines = rawLines.slice(0, 20).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
      } catch {}
    }

    const activity = extractSessionActivity(lines, allLines);
    const role = extractAgentRole(allLines);

    // Determine if "recently active" (modified in last 30 seconds) OR mid-turn
    let isActive = false;
    let fileModified = null;
    if (sessionFile) {
      try {
        const stat = fs.statSync(sessionFile);
        fileModified = stat.mtime.toISOString();
        isActive = (Date.now() - stat.mtimeMs) < 30000 || activity.isThinking;
      } catch {}
    }

    // Parse session key to derive type
    const parts = key.split(':');
    // agent:main:discord:channel:ID  or  agent:main:main  or  agent:main:subagent:ID
    let sessionType = 'main';
    let parentKey = null;
    let channel = meta.channel || null;

    if (parts[2] === 'discord' || parts[2] === 'telegram' || parts[2] === 'signal' || parts[2] === 'whatsapp') {
      sessionType = 'channel';
    } else if (parts[2] === 'isolated' || parts[2] === 'subagent') {
      sessionType = 'subagent';
      parentKey = meta.spawnedBy || meta.parentSessionKey || null;
    } else if (parts[2] === 'main') {
      sessionType = 'main';
    }

    const displayName = friendlyName(key, meta, sessionType);

    sessions.push({
      key,
      sessionId: meta.sessionId,
      sessionType,
      displayName,
      channel,
      label: meta.label || null,
      spawnedBy: meta.spawnedBy || null,
      spawnDepth: meta.spawnDepth || 0,
      chatType: meta.chatType,
      model: meta.model,
      modelProvider: meta.modelProvider,
      totalTokens: meta.totalTokens || 0,
      inputTokens: meta.inputTokens || 0,
      outputTokens: meta.outputTokens || 0,
      updatedAt: meta.updatedAt,
      fileModified,
      isActive,
      isThinking: activity.isThinking,
      createdAt: activity.createdAt,
      role,
      parentKey,
      activity,
    });
  }

  // Sort: active first, then by updatedAt desc
  sessions.sort((a, b) => {
    if (a.isActive && !b.isActive) return -1;
    if (!a.isActive && b.isActive) return 1;
    return (b.updatedAt || 0) - (a.updatedAt || 0);
  });

  return sessions;
}

// Load background exec processes (sub-agents / shell sessions)
function loadExecProcesses() {
  // Check the openclaw exec session store
  const execDir = path.join(os.homedir(), '.openclaw', 'exec-sessions');
  const processes = [];
  try {
    if (fs.existsSync(execDir)) {
      const files = fs.readdirSync(execDir);
      for (const f of files) {
        if (!f.endsWith('.json')) continue;
        try {
          const data = JSON.parse(fs.readFileSync(path.join(execDir, f), 'utf8'));
          processes.push(data);
        } catch {}
      }
    }
  } catch {}
  return processes;
}

// Routes
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/sessions', async (req, res) => {
  res.json(await loadSessions());
});

app.get('/api/processes', (req, res) => {
  res.json(loadExecProcesses());
});

// SSE endpoint for real-time updates
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  res.write('data: {"type":"connected"}\n\n');
  sseClients.add(res);

  req.on('close', () => {
    sseClients.delete(res);
  });
});

// Watch session files for changes
const watcher = chokidar.watch(SESSIONS_DIR, {
  persistent: true,
  ignoreInitial: true,
  depth: 1,
});

let debounceTimer = null;
async function onSessionChange() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(async () => {
    const sessions = await loadSessions();
    broadcast({ type: 'sessions', data: sessions });
  }, 300);
}

watcher.on('change', onSessionChange);
watcher.on('add', onSessionChange);

app.listen(PORT, () => {
  console.log(`🦞 Agent Dashboard running at http://localhost:${PORT}`);
});
