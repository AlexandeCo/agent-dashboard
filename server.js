/**
 * Agent Dashboard Server
 * Port: 4242 | No npm install required — pure Node built-ins
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = 4242;
const SESSIONS_DIR = path.join(os.homedir(), '.openclaw', 'agents', 'main', 'sessions');
const SESSIONS_FILE = path.join(SESSIONS_DIR, 'sessions.json');

// SSE clients
const clients = new Set();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function readSessionsIndex() {
  try {
    return JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function readLastLines(filePath, maxLines = 60) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.trim().split('\n').filter(Boolean);
    return lines.slice(-maxLines);
  } catch {
    return [];
  }
}

function parseMessages(jsonlPath, limit = 20) {
  const lines = readLastLines(jsonlPath, 200);
  const messages = [];
  for (const line of lines) {
    try {
      const ev = JSON.parse(line);
      if (ev.type === 'message' && ev.message) {
        const { role, content } = ev.message;
        let text = '';
        if (Array.isArray(content)) {
          text = content
            .filter(c => c.type === 'text')
            .map(c => c.text || '')
            .join(' ')
            .trim();
        } else if (typeof content === 'string') {
          text = content;
        }
        if (text) {
          messages.push({ role, text, timestamp: ev.timestamp });
        }
      }
    } catch {}
  }
  return messages.slice(-limit);
}

function getLastActivity(jsonlPath) {
  const messages = parseMessages(jsonlPath, 30);
  let lastUser = null;
  let lastAssistant = null;
  let lastTimestamp = null;

  for (const m of messages) {
    if (m.role === 'user') lastUser = m;
    if (m.role === 'assistant') lastAssistant = m;
    if (m.timestamp) lastTimestamp = m.timestamp;
  }

  return {
    userMessage: lastUser ? lastUser.text.slice(0, 200) : null,
    assistantSnippet: lastAssistant ? lastAssistant.text.slice(0, 300) : null,
    timestamp: lastTimestamp,
  };
}

function inferType(key) {
  if (key.includes(':discord:')) return 'discord';
  if (key.includes(':isolated:')) return 'isolated';
  if (key.includes(':telegram:')) return 'telegram';
  if (key.includes(':whatsapp:')) return 'whatsapp';
  if (key.endsWith(':main')) return 'main';
  return 'other';
}

function inferParentKey(key, allKeys) {
  if (key.endsWith(':main')) return null;
  // Sub-agents → point to main
  return allKeys.find(k => k.endsWith(':main')) || null;
}

function getStatus(updatedAt) {
  const now = Date.now();
  const diff = now - updatedAt;
  if (diff < 90_000) return 'active';
  if (diff < 10 * 60_000) return 'recent';
  return 'idle';
}

function buildSessionData() {
  const index = readSessionsIndex();
  const keys = Object.keys(index);
  const sessions = [];

  for (const key of keys) {
    const s = index[key];
    const activity = s.sessionFile ? getLastActivity(s.sessionFile) : {};
    const status = s.abortedLastRun ? 'aborted' : getStatus(s.updatedAt || 0);

    sessions.push({
      key,
      sessionId: s.sessionId,
      displayName: s.displayName || s.groupChannel || s.chatType || key.split(':').pop(),
      type: inferType(key),
      status,
      model: s.model || 'unknown',
      modelProvider: s.modelProvider || 'anthropic',
      updatedAt: s.updatedAt || 0,
      tokens: {
        total: s.totalTokens || 0,
        input: s.inputTokens || 0,
        output: s.outputTokens || 0,
        context: s.contextTokens || 0,
      },
      lastActivity: activity,
      parentKey: inferParentKey(key, keys),
      aborted: s.abortedLastRun || false,
      channel: s.channel || s.lastChannel || null,
      chatType: s.chatType || null,
    });
  }

  return sessions;
}

// ─── SSE broadcast ───────────────────────────────────────────────────────────

function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) {
    try { res.write(payload); } catch {}
  }
}

// Watch sessions directory for changes
function watchSessions() {
  if (!fs.existsSync(SESSIONS_DIR)) return;
  let debounce;
  try {
    fs.watch(SESSIONS_DIR, { recursive: false }, () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        broadcast('session-update', buildSessionData());
      }, 300);
    });
  } catch {}
}

// ─── HTTP Server ──────────────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  // SSE endpoint
  if (pathname === '/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });
    res.write(`data: ${JSON.stringify({ connected: true })}\n\n`);
    res.write(`event: session-update\ndata: ${JSON.stringify(buildSessionData())}\n\n`);
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }

  // Sessions API
  if (pathname === '/api/sessions') {
    const data = buildSessionData();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(data));
  }

  // Session messages API
  const msgMatch = pathname.match(/^\/api\/sessions\/([^/]+)\/messages$/);
  if (msgMatch) {
    const sessionId = decodeURIComponent(msgMatch[1]);
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const index = readSessionsIndex();
    const session = Object.values(index).find(s => s.sessionId === sessionId);
    if (!session || !session.sessionFile) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Session not found' }));
    }
    const messages = parseMessages(session.sessionFile, limit);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(messages));
  }

  // Serve index.html
  if (pathname === '/' || pathname === '/index.html') {
    const htmlPath = path.join(__dirname, 'index.html');
    try {
      const html = fs.readFileSync(htmlPath, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end(html);
    } catch {
      res.writeHead(500);
      return res.end('index.html not found');
    }
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`\n🦉 Agent Dashboard running at http://localhost:${PORT}\n`);
  watchSessions();
});
