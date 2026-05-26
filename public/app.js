/**
 * Webhook Service — Frontend App
 * Vanilla JS, no framework, no build step
 * SSE for real-time feed, fetch for API calls
 */

'use strict';

// ── State ──────────────────────────────────────────────────────────────────
const state = {
  users:       [],
  sse:         null,
  feedCount:   0,
  firedTotal:  0,
  feedFilter:  '',
};

// ── DOM refs ───────────────────────────────────────────────────────────────
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

const dom = {
  // Nav
  navItems:       () => $$('.nav-item'),
  tabPanels:      () => $$('.tab-panel'),

  // Status
  sseStatus:      () => $('#sseStatus'),
  clientCount:    () => $('#clientCount'),
  firedCount:     () => $('#firedCount'),
  feedBadge:      () => $('#feedBadge'),

  // Create user
  createForm:     () => $('#createUserForm'),
  usernameInput:  () => $('#usernameInput'),
  createResult:   () => $('#createResult'),
  createTitle:    () => $('#createResultTitle'),
  createSub:      () => $('#createResultSub'),
  usersList:      () => $('#usersList'),

  // Generate
  generateForm:   () => $('#generateForm'),
  genUsername:    () => $('#genUsername'),
  genLabel:       () => $('#genLabel'),
  urlResult:      () => $('#urlResult'),
  generatedUrl:   () => $('#generatedUrl'),
  copyUrlBtn:     () => $('#copyUrlBtn'),
  urlLabel:       () => $('#urlLabel'),
  urlUsername:    () => $('#urlUsername'),
  curlExample:    () => $('#curlExample'),
  getExample:     () => $('#getExample'),
  userWebhooksSec:() => $('#userWebhooksSection'),
  userWebhooksLbl:() => $('#userWebhooksLabel'),
  userWebhooksList:()=> $('#userWebhooksList'),

  // Feed
  feed:           () => $('#feed'),
  feedEmpty:      () => $('#feedEmpty'),
  feedFilter:     () => $('#feedFilter'),
  clearFeedBtn:   () => $('#clearFeedBtn'),
};

// ── Tab navigation ─────────────────────────────────────────────────────────
function initTabs() {
  dom.navItems().forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      dom.navItems().forEach(b => b.classList.remove('active'));
      dom.tabPanels().forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      $(`#tab-${tab}`).classList.add('active');

      if (tab === 'feed') {
        state.feedCount = 0;
        dom.feedBadge().style.display = 'none';
        dom.feedBadge().textContent = '0';
      }
    });
  });
}

// ── API helpers ────────────────────────────────────────────────────────────
async function api(method, path, body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(path, opts);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// ── Users ──────────────────────────────────────────────────────────────────
async function loadUsers() {
  try {
    const { users } = await api('GET', '/api/users');
    state.users = users;
    renderUsersList(users);
    populateUserSelects(users);
  } catch {
    // silent
  }
}

function renderUsersList(users) {
  const el = dom.usersList();
  if (!users.length) {
    el.innerHTML = '<div class="empty-state">No users yet</div>';
    return;
  }
  el.innerHTML = users.map(u => `
    <button class="user-chip" data-username="${esc(u.username)}" title="Select ${esc(u.username)}">
      <span class="user-chip-avatar">${esc(u.username[0])}</span>
      @${esc(u.username)}
    </button>
  `).join('');

  el.querySelectorAll('.user-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      // Switch to generate tab and pre-select user
      $$('.nav-item').forEach(b => b.classList.remove('active'));
      $$('.tab-panel').forEach(p => p.classList.remove('active'));
      $('[data-tab="generate"]').classList.add('active');
      $('#tab-generate').classList.add('active');
      dom.genUsername().value = chip.dataset.username;
      loadUserWebhooks(chip.dataset.username);
    });
  });
}

function populateUserSelects(users) {
  const selects = [dom.genUsername(), dom.feedFilter()];
  selects.forEach(sel => {
    const current = sel.value;
    // Keep first placeholder option
    const placeholder = sel.options[0];
    sel.innerHTML = '';
    sel.appendChild(placeholder);
    users.forEach(u => {
      const opt = document.createElement('option');
      opt.value = u.username;
      opt.textContent = `@${u.username}`;
      sel.appendChild(opt);
    });
    if (current) sel.value = current;
  });
}

// Create user form
function initCreateUser() {
  dom.createForm().addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = dom.usernameInput().value.trim();
    if (!username) return;

    const btn = dom.createForm().querySelector('.btn');
    setLoading(btn, true);

    try {
      const { user, created } = await api('POST', '/api/users', { username });
      showCreateResult(
        created ? `@${user.username} registered` : `@${user.username} already exists`,
        created ? 'Username is ready. Go to Generate URL to create webhooks.' : 'You can use this username to generate webhook URLs.',
      );
      dom.usernameInput().value = '';
      await loadUsers();
    } catch (err) {
      showCreateResult('Error', err.message, true);
    } finally {
      setLoading(btn, false);
    }
  });
}

function showCreateResult(title, sub, isError = false) {
  const box = dom.createResult();
  dom.createTitle().textContent = title;
  dom.createSub().textContent = sub;
  box.hidden = false;
  if (isError) {
    box.style.background = 'rgba(239,68,68,0.08)';
    box.style.borderColor = 'rgba(239,68,68,0.2)';
    box.querySelector('.result-icon').style.background = 'rgba(239,68,68,0.1)';
    box.querySelector('.result-icon').style.color = '#ef4444';
  } else {
    box.style.background = '';
    box.style.borderColor = '';
    box.querySelector('.result-icon').style.background = '';
    box.querySelector('.result-icon').style.color = '';
  }
}

// ── Generate webhook ───────────────────────────────────────────────────────
function initGenerate() {
  dom.generateForm().addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = dom.genUsername().value;
    const label    = dom.genLabel().value.trim() || 'default';
    if (!username) return;

    const btn = dom.generateForm().querySelector('.btn');
    setLoading(btn, true);

    try {
      const { webhook } = await api('POST', '/api/webhooks/generate', { username, label });
      showGeneratedUrl(webhook, username);
      dom.genLabel().value = '';
      await loadUserWebhooks(username);
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(btn, false);
    }
  });

  dom.genUsername().addEventListener('change', () => {
    const u = dom.genUsername().value;
    if (u) loadUserWebhooks(u);
    else {
      dom.userWebhooksSec().hidden = true;
      dom.urlResult().hidden = true;
    }
  });
}

function showGeneratedUrl(webhook, username) {
  const url = webhook.url;
  dom.generatedUrl().textContent = url;
  dom.urlLabel().textContent = webhook.label;
  dom.urlUsername().textContent = `@${username}`;
  dom.curlExample().textContent =
    `curl -X POST "${url}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"content": "Hello from anywhere!"}'`;
  dom.getExample().textContent =
    `curl "${url}?content=Hello+World"`;
  dom.urlResult().hidden = false;
}

dom.copyUrlBtn && dom.copyUrlBtn().addEventListener('click', async () => {
  const url = dom.generatedUrl().textContent;
  try {
    await navigator.clipboard.writeText(url);
    const btn = dom.copyUrlBtn();
    btn.classList.add('copied');
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`;
    setTimeout(() => {
      btn.classList.remove('copied');
      btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
    }, 2000);
  } catch { /* clipboard not available */ }
});

async function loadUserWebhooks(username) {
  try {
    const { webhooks } = await api('GET', `/api/users/${encodeURIComponent(username)}`);
    renderUserWebhooks(webhooks, username);
  } catch { /* silent */ }
}

function renderUserWebhooks(webhooks, username) {
  const sec = dom.userWebhooksSec();
  const lbl = dom.userWebhooksLbl();
  const list = dom.userWebhooksList();

  lbl.textContent = `@${username}'s Webhooks (${webhooks.length})`;

  if (!webhooks.length) {
    list.innerHTML = '<div class="empty-state">No webhooks yet — generate one above.</div>';
    sec.hidden = false;
    return;
  }

  list.innerHTML = webhooks.map(w => `
    <div class="webhook-item">
      <div class="webhook-item-icon">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
      </div>
      <div class="webhook-item-body">
        <div class="webhook-item-label">${esc(w.label)}</div>
        <div class="webhook-item-url">${esc(w.url || buildUrl(w.webhook_id))}</div>
      </div>
      <div class="webhook-item-count">${w.trigger_count}×</div>
      <button class="copy-btn webhook-item-copy" data-url="${esc(w.url || buildUrl(w.webhook_id))}" title="Copy URL">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
      </button>
    </div>
  `).join('');

  list.querySelectorAll('.webhook-item-copy').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(btn.dataset.url);
        btn.classList.add('copied');
        setTimeout(() => btn.classList.remove('copied'), 2000);
      } catch { /* silent */ }
    });
  });

  sec.hidden = false;
}

function buildUrl(webhookId) {
  return `https://saayem.qzz.io/hooks/${webhookId}`;
}

// ── SSE live feed ──────────────────────────────────────────────────────────
function initSSE() {
  const url = '/api/events';
  const es = new EventSource(url);
  state.sse = es;

  es.addEventListener('connected', () => {
    setSSEStatus(true);
  });

  es.addEventListener('webhook', (e) => {
    const data = JSON.parse(e.data);
    state.firedTotal++;
    dom.firedCount().textContent = state.firedTotal;

    // Badge if not on feed tab
    if (!$('[data-tab="feed"]').classList.contains('active')) {
      state.feedCount++;
      const badge = dom.feedBadge();
      badge.textContent = state.feedCount;
      badge.style.display = 'inline-flex';
    }

    appendFeedEvent(data);
  });

  es.onerror = () => {
    setSSEStatus(false);
    // Auto-reconnect is handled by EventSource natively
  };

  es.onopen = () => setSSEStatus(true);
}

function setSSEStatus(connected) {
  const pill = dom.sseStatus();
  const dot  = pill.querySelector('.status-dot');
  const lbl  = pill.querySelector('.status-label');
  if (connected) {
    pill.classList.add('connected');
    lbl.textContent = 'Live';
  } else {
    pill.classList.remove('connected');
    lbl.textContent = 'Reconnecting…';
  }
}

function appendFeedEvent(data) {
  const feed = dom.feed();
  const empty = dom.feedEmpty();

  // Apply filter
  const filter = dom.feedFilter().value;
  if (filter && data.username !== filter) return;

  if (empty) empty.remove();

  const time = new Date(data.timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });

  const card = document.createElement('div');
  card.className = 'feed-event';
  card.innerHTML = `
    <div class="feed-event-avatar">${esc(data.username[0])}</div>
    <div class="feed-event-body">
      <div class="feed-event-header">
        <span class="feed-event-username">@${esc(data.username)}</span>
        <span class="feed-event-label">${esc(data.label || 'default')}</span>
        <span class="feed-event-time">${time}</span>
      </div>
      <div class="feed-event-content">${esc(data.content)}</div>
      <div class="feed-event-meta">${esc(data.webhookId)} · ${esc(data.ip)}</div>
    </div>
  `;

  // Prepend so newest is on top
  feed.insertBefore(card, feed.firstChild);

  // Cap at 100 events to avoid memory bloat
  const events = feed.querySelectorAll('.feed-event');
  if (events.length > 100) events[events.length - 1].remove();
}

// Feed filter
function initFeedFilter() {
  dom.feedFilter().addEventListener('change', () => {
    state.feedFilter = dom.feedFilter().value;
  });

  dom.clearFeedBtn().addEventListener('click', () => {
    const feed = dom.feed();
    feed.innerHTML = `
      <div class="feed-empty" id="feedEmpty">
        <div class="feed-empty-icon">◎</div>
        <p>Waiting for webhooks…</p>
        <p class="feed-empty-sub">Trigger any webhook URL to see events here in real time.</p>
      </div>
    `;
    state.feedCount = 0;
    dom.feedBadge().style.display = 'none';
  });
}

// ── Utilities ──────────────────────────────────────────────────────────────
function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function setLoading(btn, loading) {
  const text   = btn.querySelector('.btn-text');
  const loader = btn.querySelector('.btn-loader');
  btn.disabled = loading;
  if (text)   text.hidden = loading;
  if (loader) loader.hidden = !loading;
}

// ── Init ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initCreateUser();
  initGenerate();
  initFeedFilter();
  initSSE();
  loadUsers();

  // Refresh users every 30s
  setInterval(loadUsers, 30_000);
});
