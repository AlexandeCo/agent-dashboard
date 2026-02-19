/* ═══════════════════════════════════════════════════════
   Wizard — Template Definitions
═══════════════════════════════════════════════════════ */

const WIZARD_TEMPLATES = {
  'solo-dev': {
    label: 'Solo Dev',
    nodes: [
      { id: 'cody', name: 'Cody', role: 'CEO', emoji: '👤', type: 'human', parentId: null },
      { id: 'ferdinand', name: 'Ferdinand', role: 'Chief of Staff', emoji: '🦉', type: 'agent',
        agentKey: 'agent:main:discord:channel:1473703468748505280', parentId: 'cody' },
      { id: 'arch', name: 'Arch', role: 'Solutions Architect', emoji: '🏗️', type: 'agent',
        parentId: 'ferdinand', specialty: 'Feasibility · Integration validation · Build gatekeeping' },
      { id: 'slate', name: 'Slate', role: 'Backend Lead', emoji: '🖥️', type: 'agent',
        parentId: 'arch', specialty: 'APIs · Data · Infrastructure' },
      { id: 'pixel', name: 'Pixel', role: 'Design Lead', emoji: '🎨', type: 'agent',
        parentId: 'arch', specialty: 'UI/UX · Frontend · Visual systems' },
    ]
  },
  'full-team': {
    label: 'Full Team',
    nodes: [
      { id: 'cody', name: 'Cody', role: 'CEO', emoji: '👤', type: 'human', parentId: null },
      { id: 'ferdinand', name: 'Ferdinand', role: 'Chief of Staff', emoji: '🦉', type: 'agent',
        agentKey: 'agent:main:discord:channel:1473703468748505280', parentId: 'cody' },
      { id: 'arch', name: 'Arch', role: 'Solutions Architect', emoji: '🏗️', type: 'agent',
        workspace: '/Users/ferdinand/.openclaw/workspace/agents/arch',
        parentId: 'ferdinand', specialty: 'Feasibility · Integration validation · Build gatekeeping' },
      { id: 'iris', name: 'Iris', role: 'CTO', emoji: '🔧', type: 'agent',
        workspace: '/Users/ferdinand/Projects/agents/iris',
        parentId: 'arch', specialty: 'Technical strategy · Engineering' },
      { id: 'sage', name: 'Sage', role: 'CPO', emoji: '📐', type: 'agent',
        workspace: '/Users/ferdinand/Projects/agents/sage',
        parentId: 'arch', specialty: 'Product · Design · UX' },
      { id: 'nova', name: 'Nova', role: 'COO', emoji: '⚙️', type: 'agent',
        workspace: '/Users/ferdinand/Projects/agents/nova',
        parentId: 'arch', specialty: 'Operations · Process · Execution' },
      { id: 'ledger', name: 'Ledger', role: 'CFO', emoji: '📊', type: 'agent',
        workspace: '/Users/ferdinand/Projects/agents/ledger',
        parentId: 'arch', specialty: 'Token costs · ROI · Budget' },
      { id: 'mara', name: 'Mara', role: 'CMO', emoji: '📣', type: 'agent',
        workspace: '/Users/ferdinand/Projects/agents/mara',
        parentId: 'arch', specialty: 'Positioning · Messaging · Growth' },
      { id: 'slate', name: 'Slate', role: 'Backend Lead', emoji: '🖥️', type: 'agent',
        workspace: '/Users/ferdinand/Projects/agents/slate',
        parentId: 'iris', specialty: 'APIs · Data · Infrastructure' },
      { id: 'quill', name: 'Quill', role: 'QA Lead', emoji: '🔬', type: 'agent',
        workspace: '/Users/ferdinand/Projects/agents/quill',
        parentId: 'iris', specialty: 'Testing · Quality · Bug hunting' },
      { id: 'vault', name: 'Vault', role: 'Security Lead', emoji: '🔐', type: 'agent',
        workspace: '/Users/ferdinand/Projects/agents/vault',
        parentId: 'iris', specialty: 'SecOps · Code audits · Threat modeling' },
      { id: 'pixel', name: 'Pixel', role: 'Design Lead', emoji: '🎨', type: 'agent',
        workspace: '/Users/ferdinand/Projects/agents/pixel',
        parentId: 'sage', specialty: 'UI/UX · Frontend · Visual systems' },
      { id: 'beacon', name: 'Beacon', role: 'SEO Lead', emoji: '🔍', type: 'agent',
        workspace: '/Users/ferdinand/Projects/agents/beacon',
        parentId: 'mara', specialty: 'Search · Content strategy · Technical SEO' },
    ]
  },
  'custom': {
    label: 'Custom',
    nodes: [
      { id: 'cody', name: 'Cody', role: 'CEO', emoji: '👤', type: 'human', parentId: null }
    ]
  }
};

/* ═══════════════════════════════════════════════════════
   Wizard State & Logic
═══════════════════════════════════════════════════════ */

const wizardState = { step: 1, keys: {}, validatedProviders: new Set(), template: null };

async function initApp() {
  try {
    const res  = await fetch('/api/setup/status');
    const data = await res.json();
    if (data.firstRun) {
      document.getElementById('wizard-overlay').style.display = 'flex';
    } else {
      showDashboard();
    }
  } catch (e) {
    // Network error — fall through to dashboard
    showDashboard();
  }
}

function showDashboard() {
  document.getElementById('wizard-overlay').style.display = 'none';
  document.getElementById('settings-gear-btn').style.display = 'flex';
  fetchSessions();
  connectSSE();
}

function wizardNext(step) {
  document.querySelectorAll('.wizard-step').forEach(el => el.classList.remove('active'));
  document.getElementById(`wizard-step-${step}`).classList.add('active');
  wizardState.step = step;
}

// ── Multi-provider wizard (Step 2) ────────────────────────────────────────────

function onProviderKeyInput(provider) {
  const input = document.getElementById(`pkey-${provider}`);
  const btn   = document.getElementById(`pbtn-${provider}`);
  const val   = input?.value.trim() || '';
  if (btn) btn.disabled = val.length === 0;
  // If user edits a previously validated key, reset its state
  if (wizardState.validatedProviders.has(provider)) {
    wizardState.validatedProviders.delete(provider);
    delete wizardState.keys[provider];
    setProviderStatus(provider, 'idle', '—');
    const card = document.getElementById(`provider-card-${provider}`);
    if (card) { card.classList.remove('is-valid', 'is-invalid'); }
    if (input) { input.classList.remove('is-valid', 'is-invalid'); }
    updateProvidersNextBtn();
  }
}

function setProviderStatus(provider, state, text) {
  const el = document.getElementById(`pstatus-${provider}`);
  if (!el) return;
  el.dataset.state = state;
  el.textContent   = text;
}

function updateProvidersNextBtn() {
  const btn = document.getElementById('wizard-providers-next-btn');
  if (btn) btn.disabled = wizardState.validatedProviders.size === 0;
}

async function validateProviderKey(provider) {
  const input = document.getElementById(`pkey-${provider}`);
  const btn   = document.getElementById(`pbtn-${provider}`);
  const card  = document.getElementById(`provider-card-${provider}`);
  const key   = input?.value.trim() || '';
  if (!key) return;

  // UI: validating state
  if (btn) { btn.disabled = true; btn.textContent = '…'; }
  setProviderStatus(provider, 'validating', 'Validating…');
  if (input) input.classList.remove('is-valid', 'is-invalid');
  if (card)  card.classList.remove('is-valid', 'is-invalid');

  try {
    const res  = await fetch(`/api/validate-key?key=${encodeURIComponent(key)}&provider=${encodeURIComponent(provider)}`);
    const data = await res.json();

    if (data.ok) {
      wizardState.validatedProviders.add(provider);
      wizardState.keys[provider] = key;
      setProviderStatus(provider, 'valid', '✓ Connected');
      if (input) input.classList.add('is-valid');
      if (card)  card.classList.add('is-valid');
    } else {
      wizardState.validatedProviders.delete(provider);
      delete wizardState.keys[provider];
      const errText = data.error === 'invalid_key' ? '✗ Invalid key' : '✗ Unreachable';
      setProviderStatus(provider, 'invalid', errText);
      if (input) input.classList.add('is-invalid');
      if (card)  card.classList.add('is-invalid');
    }
  } catch {
    wizardState.validatedProviders.delete(provider);
    delete wizardState.keys[provider];
    setProviderStatus(provider, 'invalid', '✗ Network error');
    if (input) input.classList.add('is-invalid');
    if (card)  card.classList.add('is-invalid');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Validate'; }
    updateProvidersNextBtn();
  }
}

function selectTemplate(id) {
  wizardState.template = id;
  document.querySelectorAll('.wizard-template-card').forEach(el => el.classList.remove('selected'));
  document.getElementById(`tpl-${id}`).classList.add('selected');
  document.getElementById('wizard-template-btn').disabled = false;
}

async function wizardSetupTemplate() {
  if (!wizardState.template) return;

  const btn   = document.getElementById('wizard-template-btn');
  const nodes = WIZARD_TEMPLATES[wizardState.template].nodes;

  btn.textContent = 'Saving…';
  btn.disabled    = true;

  try {
    const res  = await fetch('/api/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keys: wizardState.keys,
                             template: wizardState.template, nodes }),
    });
    const data = await res.json();

    if (!data.ok) {
      showWizardToast("Couldn't save your config. Check that ~/.switchboard/ is writable.");
      btn.textContent = 'Set up my team →';
      btn.disabled    = false;
      return;
    }

    const doneTexts = {
      'solo-dev':  'Cody, Ferdinand, Arch, Slate, and Pixel are standing by.',
      'full-team': 'Your full org is loaded and ready to explore.',
      'custom':    'Cody is waiting. Add your team from the org chart view.',
    };
    document.getElementById('wizard-done-subtext').textContent =
      doneTexts[wizardState.template] || '';
    wizardNext(4);
  } catch {
    showWizardToast("Couldn't save your config. Check that ~/.switchboard/ is writable.");
    btn.textContent = 'Set up my team →';
    btn.disabled    = false;
  }
}

async function wizardFinish() {
  document.getElementById('wizard-overlay').style.display = 'none';
  showDashboard();
  if (wizardState.template === 'custom') setView('org');
}

function showWizardToast(msg) {
  const t = document.createElement('div');
  t.className   = 'wizard-toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 4500);
}

/* ═══════════════════════════════════════════════════════
   Settings Panel
═══════════════════════════════════════════════════════ */

async function toggleSettings() {
  const panel = document.getElementById('settings-panel');
  if (panel.style.display === 'block') {
    closeSettings();
    return;
  }
  // Populate
  try {
    const data = await fetch('/api/setup/status').then(r => r.json());
    document.getElementById('settings-key-display').textContent =
      data.maskedKey || (data.firstRun ? 'Not configured' : '•••• set');
    const tplLabels = { 'solo-dev': 'Solo Dev', 'full-team': 'Full Team', 'custom': 'Custom' };
    document.getElementById('settings-template-display').textContent =
      (data.template && tplLabels[data.template]) || '—';
  } catch {}
  panel.style.display = 'block';
}

function closeSettings() {
  document.getElementById('settings-panel').style.display = 'none';
}

async function rerunSetup() {
  closeSettings();
  try { await fetch('/api/settings/reset', { method: 'PATCH' }); } catch {}
  window.location.reload();
}

/* ═══════════════════════════════════════════════════════
   State
═══════════════════════════════════════════════════════ */
let allSessions  = [];
let orgData      = null;   // { nodes: [...] } from /api/org
let selectedKey  = null;
let currentView  = 'list';

/* ═══════════════════════════════════════════════════════
   View toggle
═══════════════════════════════════════════════════════ */
function setView(view) {
  currentView = view;
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(`view-${view}`).classList.add('active');
  document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`btn-${view}`).classList.add('active');
  if (view === 'org') renderOrgChart(orgData);
}

/* ═══════════════════════════════════════════════════════
   Utilities
═══════════════════════════════════════════════════════ */
function timeAgo(ts) {
  if (!ts) return '—';
  const diff = Date.now() - (typeof ts === 'string' ? new Date(ts).getTime() : ts);
  const s = Math.floor(diff / 1000);
  if (s < 5)  return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function fmtNum(n) {
  if (!n) return '0';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000)    return (n / 1000).toFixed(1) + 'K';
  return String(n);
}

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getStatus(s) {
  if (s.isActive) return 'active';
  const ago = Date.now() - (s.updatedAt || 0);
  if (ago < 5 * 60 * 1000) return 'recent';
  return 'idle';
}

function getStatusLabel(s) {
  const st = getStatus(s);
  if (st === 'active') return 'Running';
  if (st === 'recent') return 'Recent';
  return 'Idle';
}

function getAvatar(s) {
  if (s.sessionType === 'channel') {
    const ch = s.channel || '';
    if (ch.includes('discord'))  return '💬';
    if (ch.includes('telegram')) return '✈️';
    if (ch.includes('signal'))   return '🔒';
    return '📡';
  }
  if (s.sessionType === 'subagent') return '🤖';
  return '🦞';
}

function getDisplayName(s) {
  if (s.label) return s.label;
  if (s.displayName) return s.displayName;
  if (s.sessionType === 'channel') return s.channel || 'Channel';
  if (s.sessionType === 'subagent') {
    const id = s.key ? s.key.split(':').pop()?.slice(0, 8) : '?';
    return `Sub-agent ${id}`;
  }
  return 'Main Session';
}

function getModelShort(s) {
  if (!s.model) return null;
  return s.model.split('/').pop();
}

/** Returns { text, kind } — kind: 'tool' | 'thinking' | 'assistant' | 'user' | 'empty' */
function getActivity(s) {
  const a = s.activity;
  if (!a) return { kind: 'empty', text: 'No recent activity' };

  if (s.isActive && a.isThinking) {
    return { kind: 'thinking', text: 'Thinking…' };
  }
  if (s.isActive && a.lastToolCall?.name) {
    return { kind: 'tool', text: a.lastToolCall.name, ts: a.lastToolCall.timestamp };
  }
  if (a.lastAssistantMsg?.text) {
    return { kind: 'assistant', text: a.lastAssistantMsg.text };
  }
  if (a.lastUserMsg?.text) {
    return { kind: 'user', text: a.lastUserMsg.text };
  }
  return { kind: 'empty', text: 'No recent activity' };
}

function truncate(str, max = 80) {
  if (!str) return '';
  str = String(str);
  return str.length > max ? str.slice(0, max) + '…' : str;
}

/* ═══════════════════════════════════════════════════════
   Provider helpers (Feature 1 + 3)
═══════════════════════════════════════════════════════ */
function getProvider(model) {
  if (!model) return null;
  const m = model.toLowerCase();
  if (m.startsWith('anthropic/') || m.includes('claude')) return 'anthropic';
  if (m.startsWith('openai/')    || m.startsWith('gpt')   || m.startsWith('o3') || m.startsWith('o1')) return 'openai';
  if (m.startsWith('google/')    || m.includes('gemini'))  return 'google';
  return 'unknown';
}

function providerBadgeHtml(model) {
  const provider = getProvider(model);
  if (!provider || provider === 'unknown') return '';
  const labels = { anthropic: 'Anthropic', openai: 'OpenAI', google: 'Google' };
  return `<span class="provider-badge provider-badge-${provider}">${labels[provider]}</span>`;
}

/* Model list */
const MODEL_GROUPS = [
  { label: 'Anthropic', provider: 'anthropic', models: [
    'anthropic/claude-opus-4-6',
    'anthropic/claude-sonnet-4-6',
    'anthropic/claude-haiku-4-6',
  ]},
  { label: 'OpenAI', provider: 'openai', models: [
    'openai/gpt-4o',
    'openai/gpt-4o-mini',
    'openai/o3-mini',
  ]},
  { label: 'Google', provider: 'google', models: [
    'google/gemini-2.0-flash',
    'google/gemini-2.5-pro',
  ]},
];

/* ═══════════════════════════════════════════════════════
   Model picker + API key actions
═══════════════════════════════════════════════════════ */
function toggleModelPicker() {
  document.querySelector('.model-picker')?.classList.toggle('is-open');
}

// Close picker when clicking outside
document.addEventListener('click', (e) => {
  const picker = document.querySelector('.model-picker');
  if (picker && !picker.contains(e.target)) picker.classList.remove('is-open');
});

async function selectModel(agentId, model) {
  // Close dropdown
  document.querySelector('.model-picker')?.classList.remove('is-open');

  // Update trigger label + provider badge immediately (optimistic)
  const trigger = document.querySelector('.model-picker-current');
  if (trigger) trigger.textContent = model.split('/').pop();

  // Update badge in trigger
  const triggerBadge = document.querySelector('.model-picker-trigger-inner .provider-badge');
  if (triggerBadge) {
    const provider = getProvider(model);
    triggerBadge.className = `provider-badge provider-badge-${provider}`;
    const labels = { anthropic: 'Anthropic', openai: 'OpenAI', google: 'Google', unknown: '?' };
    triggerBadge.textContent = labels[provider] || '?';
  }

  // Mark selected option
  document.querySelectorAll('.model-option').forEach(el => {
    el.classList.toggle('is-selected', el.dataset.model === model);
  });

  // Update local state
  const s = allSessions.find(s => s.key === agentId);
  if (s) s.model = model;
  renderGrid(allSessions);
  renderSidebar(allSessions);

  // Persist via API
  try {
    const r = await fetch(`/api/agents/${encodeURIComponent(agentId)}/model`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model }),
    });
    const feedback = document.getElementById('model-save-feedback');
    if (feedback) {
      feedback.textContent = '✓ Model saved';
      feedback.classList.add('is-visible');
      setTimeout(() => feedback.classList.remove('is-visible'), 2000);
    }
    // Flash card
    const card = document.querySelector(`.agent-card[data-key="${CSS.escape(agentId)}"]`);
    if (card) {
      card.classList.add('card-success');
      card.addEventListener('animationend', () => card.classList.remove('card-success'), { once: true });
    }
  } catch (e) {
    console.error('Model save failed:', e);
  }
}

async function saveApiKey(agentId) {
  const input = document.getElementById('apikey-input');
  const btn   = document.getElementById('apikey-save-btn');
  const fb    = document.getElementById('apikey-feedback');
  if (!input || !btn || !fb) return;

  const key = input.value.trim();
  if (!key) return;

  btn.disabled = true;
  btn.textContent = 'Saving…';

  const s = allSessions.find(s => s.key === agentId);
  const provider = getProvider(s?.model) || 'unknown';

  try {
    await fetch(`/api/agents/${encodeURIComponent(agentId)}/apikey`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, key }),
    });
    // Mask the input after save
    input.value = key.slice(0, 8) + '•'.repeat(Math.max(0, key.length - 8));
    input.dataset.saved = '1';
    fb.textContent = '✓ Key saved';
    fb.className = 'apikey-feedback is-visible is-success';
    setTimeout(() => fb.classList.remove('is-visible'), 2500);
  } catch (e) {
    fb.textContent = '✕ Save failed';
    fb.className = 'apikey-feedback is-visible is-error';
    setTimeout(() => fb.classList.remove('is-visible'), 2500);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save';
  }
}

/* ═══════════════════════════════════════════════════════
   Sidebar
═══════════════════════════════════════════════════════ */
function renderSidebar(sessions) {
  const el = document.getElementById('agent-list');
  document.getElementById('agent-count').textContent = sessions.length;

  // Update live dot
  const hasActive = sessions.some(s => s.isActive);
  const dot = document.getElementById('live-dot');
  dot.classList.toggle('is-live', hasActive);

  if (!sessions.length) {
    el.innerHTML = '<div style="padding:20px 10px;font-size:12px;color:var(--text-dim);text-align:center">No agents running</div>';
    return;
  }

  el.innerHTML = sessions.map(s => {
    const status   = getStatus(s);
    const name     = getDisplayName(s);
    const typeLabel = s.sessionType;
    const activity = getActivity(s);
    const isSelected = s.key === selectedKey;

    let subText = '';
    if (status === 'active' && activity.kind === 'tool') {
      subText = `⚡ ${truncate(activity.text, 28)}`;
    } else if (status === 'active') {
      subText = 'Running…';
    } else {
      subText = timeAgo(s.updatedAt);
    }

    const canDismiss = s.sessionType === 'subagent' && !s.isActive;
    return `
      <div class="agent-row${isSelected ? ' selected' : ''}" onclick="selectAgent('${escHtml(s.key)}')">
        <div class="agent-row-dot dot-${status}"></div>
        <div class="agent-row-info">
          <div class="agent-row-name">${escHtml(name)}</div>
          <div class="agent-row-sub">${escHtml(subText)}</div>
        </div>
        <div class="agent-row-badge badge-${s.sessionType}">${typeLabel}</div>
        ${canDismiss ? `<button class="agent-row-dismiss" title="Dismiss" onclick="event.stopPropagation(); dismissAgent('${escHtml(s.key)}')">✕</button>` : ''}
      </div>
    `;
  }).join('');
}

/* ═══════════════════════════════════════════════════════
   Main Grid
═══════════════════════════════════════════════════════ */
function renderGrid(sessions) {
  const el = document.getElementById('agent-grid');

  // Update header pill
  const activeCount = sessions.filter(s => s.isActive).length;
  const pill = document.getElementById('header-active-count');
  pill.textContent = activeCount > 0 ? `${activeCount} active` : '';
  pill.className   = activeCount > 0 ? 'header-pill' : 'header-pill header-pill-neutral';

  // Update last-updated
  document.getElementById('last-updated').textContent = `Updated ${timeAgo(Date.now())}`;

  // Empty state
  if (!sessions.length) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🦞</div>
        <h2 class="empty-title">No agents running</h2>
        <p class="empty-desc">
          OpenClaw agents will show up here in real time when active.
          Start a conversation in Discord or kick off a session to see them appear.
        </p>
        <div class="empty-tip">
          <code>openclaw chat</code>
          <code>openclaw system event</code>
        </div>
      </div>
    `;
    return;
  }

  el.innerHTML = sessions.map(s => renderCard(s)).join('');
}

function renderCard(s) {
  const status   = getStatus(s);
  const name     = getDisplayName(s);
  const avatar   = getAvatar(s);
  const model    = getModelShort(s);
  const activity = getActivity(s);

  // Activity section markup
  let activityHtml = '';
  if (activity.kind === 'thinking') {
    activityHtml = `
      <div class="activity-header">
        <span class="activity-label">Thinking</span>
        <span class="thinking-indicator">
          <span class="thinking-dot"></span>
          <span class="thinking-dot"></span>
          <span class="thinking-dot"></span>
        </span>
      </div>
      <div class="activity-text" style="font-style:italic;color:var(--text-dim)">Processing…</div>
    `;
  } else if (activity.kind === 'tool') {
    activityHtml = `
      <div class="activity-header">
        <span class="activity-label">Tool call</span>
      </div>
      <div class="activity-tool">⚡ ${escHtml(activity.text)}</div>
    `;
  } else if (activity.kind === 'assistant') {
    activityHtml = `
      <div class="activity-header">
        <span class="activity-label">Assistant</span>
      </div>
      <div class="activity-text">${escHtml(truncate(activity.text, 120))}</div>
    `;
  } else if (activity.kind === 'user') {
    activityHtml = `
      <div class="activity-header">
        <span class="activity-label">Last message</span>
      </div>
      <div class="activity-text">${escHtml(truncate(activity.text, 120))}</div>
    `;
  } else {
    activityHtml = `
      <div class="activity-header">
        <span class="activity-label">Activity</span>
      </div>
      <div class="activity-text" style="color:var(--text-dim);font-style:italic">No recent activity</div>
    `;
  }

  // Type subtitle
  let typeStr = s.sessionType;
  if (s.spawnDepth > 0) typeStr += ` · depth ${s.spawnDepth}`;

  const canDismiss = s.sessionType === 'subagent' && !s.isActive;
  const badge = providerBadgeHtml(s.model);
  const modelShortName = model ? model : null;

  return `
    <div class="agent-card" data-key="${escHtml(s.key)}" onclick="selectAgent('${escHtml(s.key)}')">
      <div class="card-status-bar ${status}-bar"></div>
      ${canDismiss ? `
        <button class="card-dismiss" title="Dismiss agent" onclick="event.stopPropagation(); dismissAgent('${escHtml(s.key)}')">✕</button>
      ` : ''}
      <div class="card-body">
        <div class="card-header">
          <div class="card-avatar avatar-${s.sessionType}">${avatar}</div>
          <div class="card-meta">
            <div class="card-name">${escHtml(name)}</div>
            <div class="card-type">${escHtml(typeStr)}</div>
            ${(badge || modelShortName) ? `
              <div class="card-model-row">
                ${badge}
                ${modelShortName ? `<span class="card-model-name">${escHtml(modelShortName)}</span>` : ''}
              </div>
            ` : ''}
          </div>
          <div class="card-status-badge status-badge-${status}">
            <div class="badge-dot"></div>
            ${getStatusLabel(s)}
          </div>
        </div>

        <div class="card-activity">${activityHtml}</div>

        <div class="card-stats">
          <div class="stat">
            <div class="stat-value">${fmtNum(s.totalTokens)}</div>
            <div class="stat-label">Tokens</div>
          </div>
          <div class="stat">
            <div class="stat-value">${timeAgo(s.updatedAt)}</div>
            <div class="stat-label">Updated</div>
          </div>
          ${s.sessionType !== 'main' && s.parentKey ? `
            <div class="stat">
              <div class="stat-value" style="font-size:11px">${escHtml(truncate(s.parentKey.split(':').pop() || '', 10))}</div>
              <div class="stat-label">Parent</div>
            </div>
          ` : ''}
        </div>
      </div>
    </div>
  `;
}

/* ═══════════════════════════════════════════════════════
   Org Chart (uses /api/org with pre-enriched nodes)
═══════════════════════════════════════════════════════ */
function renderOrgChart(org) {
  const svg = d3.select('#org-svg');
  svg.selectAll('*').remove();

  const nodes = org?.nodes || [];
  if (!nodes.length) {
    svg.append('text')
      .attr('x', '50%').attr('y', '50%')
      .attr('text-anchor', 'middle')
      .attr('fill', '#52525b')
      .attr('font-size', 14)
      .text('No org data available');
    return;
  }

  const container = document.querySelector('.org-chart-container');
  const W = container.clientWidth || 800;
  const H = container.clientHeight || 600;

  // Build D3 hierarchy from parentId links
  const nodeMap = {};
  for (const n of nodes) nodeMap[n.id] = { ...n, children: [] };

  let root = null;
  for (const n of nodes) {
    if (n.parentId && nodeMap[n.parentId]) {
      nodeMap[n.parentId].children.push(nodeMap[n.id]);
    } else {
      root = nodeMap[n.id];
    }
  }
  if (!root) return;

  const NODE_W = 220;
  const NODE_H = 90;

  const g = svg.append('g').attr('transform', `translate(${W / 2}, 60)`);

  const defs = svg.append('defs');
  [
    { id: 'go-active', c1: '#22c55e', c2: 'transparent' },
    { id: 'go-recent', c1: '#f59e0b', c2: 'transparent' },
    { id: 'go-idle',   c1: '#3f3f46', c2: 'transparent' },
    { id: 'go-human',  c1: '#6366f1', c2: 'transparent' },
  ].forEach(({ id, c1, c2 }) => {
    const grad = defs.append('linearGradient').attr('id', id)
      .attr('x1','0%').attr('y1','0%').attr('x2','100%').attr('y2','0%');
    grad.append('stop').attr('offset','0%').attr('stop-color', c1);
    grad.append('stop').attr('offset','100%').attr('stop-color', c2);
  });

  const treeLayout = d3.tree().nodeSize([NODE_W + 40, NODE_H + 60]);
  const hierarchy  = d3.hierarchy(root, d => d.children);
  treeLayout(hierarchy);

  // Links
  g.selectAll('.org-link')
    .data(hierarchy.links())
    .join('path')
    .attr('class', 'org-link')
    .attr('d', d3.linkVertical().x(d => d.x).y(d => d.y))
    .attr('stroke', '#27272a')
    .attr('stroke-width', 1.5)
    .attr('fill', 'none');

  // Nodes
  const nodeG = g.selectAll('.org-node')
    .data(hierarchy.descendants())
    .join('g')
    .attr('class', 'org-node')
    .attr('transform', d => `translate(${d.x}, ${d.y})`)
    .style('cursor', d => d.data.sessionKey ? 'pointer' : 'default')
    .on('click', (e, d) => { if (d.data.sessionKey) selectAgent(d.data.sessionKey); });

  const statusColor = d => {
    if (d.data.type === 'human') return '#6366f1';
    if (d.data.isActive) return '#22c55e';
    if (d.data.updatedAt && Date.now() - d.data.updatedAt < 300000) return '#f59e0b';
    return '#52525b';
  };

  const gradId = d => {
    if (d.data.type === 'human') return 'url(#go-human)';
    if (d.data.isActive) return 'url(#go-active)';
    if (d.data.updatedAt && Date.now() - d.data.updatedAt < 300000) return 'url(#go-recent)';
    return 'url(#go-idle)';
  };

  // Card bg
  nodeG.append('rect')
    .attr('x', -NODE_W/2).attr('y', -NODE_H/2)
    .attr('width', NODE_W).attr('height', NODE_H)
    .attr('rx', 10)
    .attr('fill', d => d.data.isActive ? 'rgba(34,197,94,0.05)' : '#111114')
    .attr('stroke', d => {
      if (d.data.type === 'human') return 'rgba(99,102,241,0.5)';
      if (d.data.isActive) return 'rgba(34,197,94,0.35)';
      return '#27272a';
    })
    .attr('stroke-width', 1.5);

  // Top accent bar
  nodeG.append('rect')
    .attr('x', -NODE_W/2).attr('y', -NODE_H/2)
    .attr('width', NODE_W).attr('height', 2)
    .attr('rx', 1)
    .attr('fill', d => gradId(d));

  // Status dot (agents only)
  nodeG.filter(d => d.data.type !== 'human').append('circle')
    .attr('cx', NODE_W/2 - 14).attr('cy', -NODE_H/2 + 14)
    .attr('r', 4.5)
    .attr('fill', d => statusColor(d));

  // Emoji avatar
  nodeG.append('text')
    .attr('x', -NODE_W/2 + 20).attr('y', 6)
    .attr('font-size', 22).attr('text-anchor', 'middle')
    .text(d => d.data.emoji || '🤖');

  // Name
  nodeG.append('text')
    .attr('x', -NODE_W/2 + 40).attr('y', -NODE_H/2 + 22)
    .attr('fill', '#fafafa')
    .attr('font-family', 'Inter, sans-serif')
    .attr('font-size', 13).attr('font-weight', 600)
    .attr('letter-spacing', '-0.3px')
    .text(d => d.data.name || d.data.id);

  // Role
  nodeG.append('text')
    .attr('x', -NODE_W/2 + 40).attr('y', -NODE_H/2 + 36)
    .attr('fill', '#71717a')
    .attr('font-family', 'Inter, sans-serif')
    .attr('font-size', 10.5)
    .text(d => d.data.role || d.data.specialty || '');

  // Activity / status line
  nodeG.append('text')
    .attr('x', -NODE_W/2 + 12).attr('y', NODE_H/2 - 26)
    .attr('fill', '#52525b')
    .attr('font-family', 'Inter, sans-serif')
    .attr('font-size', 10).attr('font-style', 'italic')
    .text(d => {
      if (d.data.type === 'human') return 'Human · CEO';
      if (d.data.isActive && d.data.lastToolCall) return `⚡ ${d.data.lastToolCall}`;
      if (d.data.currentTask) return truncate(d.data.currentTask, 28);
      if (d.data.specialty) return d.data.specialty;
      return d.data.sessionKey ? 'Idle' : 'Not running';
    });

  // Token count
  nodeG.filter(d => d.data.totalTokens > 0).append('text')
    .attr('x', NODE_W/2 - 12).attr('y', NODE_H/2 - 10)
    .attr('fill', '#3f3f46')
    .attr('font-family', 'JetBrains Mono, monospace')
    .attr('font-size', 9.5).attr('text-anchor', 'end')
    .text(d => `${fmtNum(d.data.totalTokens)} tok`);

  // Zoom + pan
  const zoom = d3.zoom().scaleExtent([0.2, 2.5])
    .on('zoom', (event) => {
      g.attr('transform', `translate(${W/2 + event.transform.x}, ${60 + event.transform.y}) scale(${event.transform.k})`);
    });
  svg.call(zoom);
}

/* ═══════════════════════════════════════════════════════
   Detail Panel
═══════════════════════════════════════════════════════ */
function selectAgent(key) {
  selectedKey = key;
  const s = allSessions.find(s => s.key === key);

  // Update sidebar highlights
  document.querySelectorAll('.agent-row').forEach(el => {
    const onclick = el.getAttribute('onclick') || '';
    el.classList.toggle('selected', onclick.includes(`'${key}'`));
  });

  if (!s) { closeDetail(); return; }

  const status   = getStatus(s);
  const avatar   = getAvatar(s);
  const name     = getDisplayName(s);
  const model    = getModelShort(s);
  const a        = s.activity;

  // Conversation messages
  const messages = [];
  if (a?.lastUserMsg?.text)      messages.push({ role: 'user',      ...a.lastUserMsg });
  if (a?.lastAssistantMsg?.text) messages.push({ role: 'assistant', ...a.lastAssistantMsg });

  const toolSection = a?.lastToolCall ? `
    <div class="detail-section">
      <div class="detail-section-label">Last Tool Call</div>
      <div class="detail-tool-call">
        <span class="tool-call-icon">⚡</span>
        <div class="tool-call-body">
          <div class="tool-call-name">${escHtml(a.lastToolCall.name)}</div>
          <div class="tool-call-time">${timeAgo(a.lastToolCall.timestamp)}</div>
        </div>
      </div>
    </div>
  ` : '';

  // Build model picker dropdown HTML
  const currentModel = s.model || null;
  const modelOptionsHtml = MODEL_GROUPS.map((group, gi) => `
    ${gi > 0 ? '<div class="model-picker-divider"></div>' : ''}
    <div class="model-group-label">${group.label}</div>
    ${group.models.map(m => `
      <div class="model-option${currentModel === m ? ' is-selected' : ''}"
           data-model="${escHtml(m)}"
           onclick="selectModel('${escHtml(s.key)}', '${escHtml(m)}')">
        ${escHtml(m.split('/').pop())}
      </div>
    `).join('')}
  `).join('');

  const providerLabel = currentModel
    ? { anthropic: 'Anthropic', openai: 'OpenAI', google: 'Google', unknown: 'Unknown' }[getProvider(currentModel)] || 'Unknown'
    : 'None';
  const providerClass = currentModel ? `provider-badge-${getProvider(currentModel)}` : 'provider-badge-unknown';

  const html = `
    <div class="detail-header">
      <button class="detail-close-btn" onclick="closeDetail()" title="Close">✕</button>
      <div class="detail-agent-avatar">${avatar}</div>
      <div class="detail-name">${escHtml(name)}</div>
      <div class="detail-key mono">${escHtml(s.key)}</div>
      <div class="detail-badges">
        <span class="detail-badge badge-status-${status}">${getStatusLabel(s)}</span>
        ${model ? `<span class="detail-badge badge-model">${escHtml(model)}</span>` : ''}
        ${s.spawnDepth > 0 ? `<span class="detail-badge" style="background:var(--surface2);color:var(--text-dim);border:1px solid var(--border)">depth ${s.spawnDepth}</span>` : ''}
      </div>
    </div>

    <div class="detail-section">
      <div class="detail-section-label">Stats</div>
      <div class="detail-stats-grid">
        <div class="detail-stat">
          <div class="detail-stat-value">${fmtNum(s.totalTokens)}</div>
          <div class="detail-stat-label">Total tokens</div>
        </div>
        <div class="detail-stat">
          <div class="detail-stat-value">${timeAgo(s.updatedAt)}</div>
          <div class="detail-stat-label">Last active</div>
        </div>
        <div class="detail-stat">
          <div class="detail-stat-value">${fmtNum(s.inputTokens)}</div>
          <div class="detail-stat-label">Input tokens</div>
        </div>
        <div class="detail-stat">
          <div class="detail-stat-value">${fmtNum(s.outputTokens)}</div>
          <div class="detail-stat-label">Output tokens</div>
        </div>
      </div>
    </div>

    <!-- Feature 1 + 3: Model picker -->
    <div class="detail-section">
      <div class="detail-section-label">Model</div>
      <div class="model-picker" id="model-picker">
        <button class="model-picker-trigger" onclick="toggleModelPicker()" type="button">
          <span class="model-picker-trigger-inner">
            <span class="provider-badge ${providerClass}">${providerLabel}</span>
            <span class="model-picker-current">${currentModel ? escHtml(currentModel.split('/').pop()) : 'Not set'}</span>
          </span>
          <svg class="model-picker-chevron" width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 4l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <div class="model-picker-dropdown">
          ${modelOptionsHtml}
        </div>
      </div>
      <div class="model-save-feedback" id="model-save-feedback"></div>
    </div>

    <!-- Feature 2: API key input -->
    <div class="detail-section">
      <div class="detail-section-label">API Key</div>
      <div class="apikey-row">
        <input
          id="apikey-input"
          class="apikey-input"
          type="password"
          placeholder="Using default"
          autocomplete="off"
          spellcheck="false"
          oninput="this.dataset.saved=''"
        />
        <button id="apikey-save-btn" class="apikey-save-btn" onclick="saveApiKey('${escHtml(s.key)}')">Save</button>
      </div>
      <div class="apikey-helper">Never stored in plaintext · masked after save</div>
      <div class="apikey-feedback" id="apikey-feedback"></div>
    </div>

    ${toolSection}

    <div class="detail-section">
      <div class="detail-section-label">Conversation</div>
      <div class="detail-messages">
        ${messages.length === 0
          ? '<p class="no-messages">No messages captured yet</p>'
          : messages.map(m => `
            <div class="msg-bubble">
              <div class="bubble-role role-${m.role}">
                ${m.role === 'user' ? '↑ User' : '↓ Assistant'}
              </div>
              <div class="bubble-body">${escHtml(m.text)}</div>
              <div class="bubble-time">${timeAgo(m.timestamp)}</div>
            </div>
          `).join('')
        }
      </div>
    </div>
  `;

  document.getElementById('detail-content').innerHTML = html;
}

function closeDetail() {
  selectedKey = null;
  document.querySelectorAll('.agent-row').forEach(el => el.classList.remove('selected'));
  document.getElementById('detail-content').innerHTML = `
    <div class="detail-empty">
      <div class="detail-empty-icon">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <rect x="4" y="8" width="24" height="18" rx="3" stroke="currentColor" stroke-width="1.5"/>
          <path d="M4 13h24" stroke="currentColor" stroke-width="1.5"/>
          <circle cx="8.5" cy="10.5" r="1" fill="currentColor"/>
          <circle cx="12" cy="10.5" r="1" fill="currentColor"/>
        </svg>
      </div>
      <p>Select an agent to inspect</p>
    </div>
  `;
}

/* ═══════════════════════════════════════════════════════
   Dismiss Agent
═══════════════════════════════════════════════════════ */
async function dismissAgent(key) {
  try {
    await fetch(`/api/dismiss/${encodeURIComponent(key)}`, { method: 'POST' });
    if (selectedKey === key) closeDetail();
    // Optimistic UI: remove from local state immediately
    allSessions = allSessions.filter(s => s.key !== key);
    if (orgData) orgData.nodes = orgData.nodes.filter(n => n.sessionKey !== key && n.id !== key);
    renderSidebar(allSessions);
    renderGrid(allSessions);
    if (currentView === 'org') renderOrgChart(orgData);
  } catch (e) {
    console.error('Dismiss failed:', e);
  }
}

/* ═══════════════════════════════════════════════════════
   Data Fetching
═══════════════════════════════════════════════════════ */
async function fetchSessions() {
  try {
    const [sessRes, orgRes] = await Promise.all([
      fetch('/api/sessions'),
      fetch('/api/org'),
    ]);
    allSessions = await sessRes.json();
    orgData     = await orgRes.json();
    renderSidebar(allSessions);
    renderGrid(allSessions);
    if (currentView === 'org') renderOrgChart(orgData);
    if (selectedKey) selectAgent(selectedKey);
  } catch (e) {
    console.error('Failed to fetch data:', e);
  }
}

function connectSSE() {
  const src = new EventSource('/api/events');

  src.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.type === 'sessions') {
        allSessions = msg.data;
        renderSidebar(allSessions);
        renderGrid(allSessions);
      }
      if (msg.type === 'org') {
        orgData = msg.data;
        if (currentView === 'org') renderOrgChart(orgData);
      }
      if (selectedKey) selectAgent(selectedKey);
    } catch {}
  };

  src.onerror = () => {
    src.close();
    setTimeout(connectSSE, 3000);
  };
}

/* ═══════════════════════════════════════════════════════
   Init
═══════════════════════════════════════════════════════ */
initApp();

// Refresh time-ago labels every 30s
setInterval(() => {
  renderSidebar(allSessions);
  renderGrid(allSessions);
}, 30000);
