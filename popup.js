const STORAGE_KEY = 'parkedTabs';

const GROUP_COLORS = {
  grey:   '#5f6368',
  blue:   '#1a73e8',
  red:    '#d93025',
  yellow: '#f9ab00',
  green:  '#1e8e3e',
  pink:   '#d01884',
  purple: '#a142f4',
  cyan:   '#007b83',
  orange: '#fa903e'
};

const FALLBACK_FAVICON = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect width='16' height='16' rx='3' fill='%23444'/><text x='8' y='12' font-size='10' text-anchor='middle' fill='%23999'>?</text></svg>`;

let allTabs = [];
let dragSrcId = null;

// ── Load ──────────────────────────────────────────────────
async function loadTabs() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  allTabs = result[STORAGE_KEY] || [];
  renderFiltered();
}

// ── Render ────────────────────────────────────────────────
function renderList(tabs) {
  const list = document.getElementById('tabList');
  document.getElementById('count').textContent = allTabs.length;

  if (tabs.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📭</div>
        Нет сохранённых вкладок
        <strong>Нажмите «Сохранить текущую вкладку»<br>или правый клик на странице</strong>
      </div>`;
    return;
  }

  list.innerHTML = '';
  tabs.forEach(tab => list.appendChild(buildItem(tab)));
}

function buildItem(tab) {
  const wrap = document.createElement('div');
  wrap.className = 'tab-item' + (tab.starred ? ' is-starred' : '');
  wrap.dataset.id = tab.id;
  wrap.draggable = true;

  // Drag handle
  const handle = document.createElement('span');
  handle.className = 'drag-handle';
  handle.textContent = '⠿';
  wrap.appendChild(handle);

  // Star button
  const starBtn = document.createElement('button');
  starBtn.className = 'btn-star' + (tab.starred ? ' starred' : '');
  starBtn.title = tab.starred ? 'Убрать из избранного' : 'В избранное';
  starBtn.textContent = tab.starred ? '★' : '☆';
  starBtn.addEventListener('click', e => { e.stopPropagation(); toggleStar(tab.id); });
  wrap.appendChild(starBtn);

  // Favicon
  const img = document.createElement('img');
  img.className = 'tab-favicon';
  img.src = tab.favIconUrl || FALLBACK_FAVICON;
  img.onerror = () => { img.src = FALLBACK_FAVICON; };
  wrap.appendChild(img);

  // Group color as left border
  if (tab.groupColor) {
    wrap.classList.add('has-group');
    wrap.style.borderLeftColor = GROUP_COLORS[tab.groupColor] || '#5f6368';
    wrap.title = tab.groupName ? `Группа: ${tab.groupName}` : '';
  }

  // Text info
  const info = document.createElement('div');
  info.className = 'tab-info';

  const title = document.createElement('div');
  title.className = 'tab-title';
  title.textContent = tab.title;

  const url = document.createElement('div');
  url.className = 'tab-url';
  url.textContent = tab.url;

  info.appendChild(title);
  info.appendChild(url);
  wrap.appendChild(info);

  // Action buttons
  const actions = document.createElement('div');
  actions.className = 'tab-actions';

  const restoreBtn = document.createElement('button');
  restoreBtn.className = 'btn-icon';
  restoreBtn.title = 'Восстановить';
  restoreBtn.textContent = '↗';
  restoreBtn.addEventListener('click', e => { e.stopPropagation(); restoreTab(tab.id); });

  const delBtn = document.createElement('button');
  delBtn.className = 'btn-icon del';
  delBtn.title = 'Удалить из списка';
  delBtn.textContent = '×';
  delBtn.addEventListener('click', e => { e.stopPropagation(); removeTab(tab.id); });

  actions.appendChild(restoreBtn);
  actions.appendChild(delBtn);
  wrap.appendChild(actions);

  // Click on row = restore
  wrap.addEventListener('click', () => restoreTab(tab.id));

  // Drag events
  wrap.addEventListener('dragstart', onDragStart);
  wrap.addEventListener('dragover',  onDragOver);
  wrap.addEventListener('dragleave', onDragLeave);
  wrap.addEventListener('drop',      onDrop);
  wrap.addEventListener('dragend',   onDragEnd);

  return wrap;
}

// ── Star ──────────────────────────────────────────────────
async function toggleStar(id) {
  const idx = allTabs.findIndex(t => t.id === id);
  if (idx === -1) return;

  const tab = allTabs[idx];
  tab.starred = !tab.starred;

  // Remove from current position, then re-insert at target position
  allTabs.splice(idx, 1);

  if (tab.starred) {
    // Starred → jump to position 0
    allTabs.unshift(tab);
  } else {
    // Unstarred → place after last starred item
    const lastStarredIdx = allTabs.reduce((last, t, i) => (t.starred ? i : last), -1);
    allTabs.splice(lastStarredIdx + 1, 0, tab);
  }

  await saveOrder();
  renderFiltered();
}

// ── Drag and Drop ─────────────────────────────────────────
function onDragStart(e) {
  dragSrcId = +this.dataset.id;
  this.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  // Required for Firefox
  e.dataTransfer.setData('text/plain', dragSrcId);
}

function onDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  clearDropIndicators();
  const rect = this.getBoundingClientRect();
  this.classList.add(e.clientY < rect.top + rect.height / 2 ? 'drag-above' : 'drag-below');
}

function onDragLeave() {
  this.classList.remove('drag-above', 'drag-below');
}

function onDrop(e) {
  e.preventDefault();
  clearDropIndicators();

  const targetId = +this.dataset.id;
  if (!dragSrcId || dragSrcId === targetId) return;

  const srcIndex = allTabs.findIndex(t => t.id === dragSrcId);
  const targetIndex = allTabs.findIndex(t => t.id === targetId);
  if (srcIndex === -1 || targetIndex === -1) return;

  const rect = this.getBoundingClientRect();
  const insertBefore = e.clientY < rect.top + rect.height / 2;

  const [srcTab] = allTabs.splice(srcIndex, 1);
  const newTargetIdx = allTabs.findIndex(t => t.id === targetId);
  allTabs.splice(insertBefore ? newTargetIdx : newTargetIdx + 1, 0, srcTab);

  saveOrder();
  renderFiltered();
}

function onDragEnd() {
  clearDropIndicators();
  document.querySelectorAll('.tab-item.dragging').forEach(el => el.classList.remove('dragging'));
  dragSrcId = null;
}

function clearDropIndicators() {
  document.querySelectorAll('.tab-item').forEach(el =>
    el.classList.remove('drag-above', 'drag-below')
  );
}

// ── Actions ───────────────────────────────────────────────
async function restoreTab(id) {
  const tab = allTabs.find(t => t.id === id);
  if (!tab) return;
  await chrome.tabs.create({ url: tab.url, active: true });
  await removeTab(id);
}

async function removeTab(id) {
  allTabs = allTabs.filter(t => t.id !== id);
  await saveOrder();
  renderFiltered();
}

async function restoreAll() {
  const visible = getFiltered();
  for (const tab of visible) {
    await chrome.tabs.create({ url: tab.url, active: false });
  }
  const ids = new Set(visible.map(t => t.id));
  allTabs = allTabs.filter(t => !ids.has(t.id));
  await saveOrder();
  renderFiltered();
}

async function saveOrder() {
  await chrome.storage.local.set({ [STORAGE_KEY]: allTabs });
}

// ── Search ────────────────────────────────────────────────
function getFiltered() {
  const q = document.getElementById('search').value.toLowerCase().trim();
  if (!q) return allTabs;
  return allTabs.filter(t =>
    t.title.toLowerCase().includes(q) || t.url.toLowerCase().includes(q)
  );
}

function renderFiltered() {
  renderList(getFiltered());
  document.getElementById('count').textContent = allTabs.length;
}

// ── Event listeners ───────────────────────────────────────
document.getElementById('parkCurrent').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  await chrome.runtime.sendMessage({ action: 'parkTab', tab });
  setTimeout(loadTabs, 300);
});

document.getElementById('search').addEventListener('input', renderFiltered);

document.getElementById('restoreAll').addEventListener('click', restoreAll);

document.getElementById('clearAll').addEventListener('click', async () => {
  if (!confirm('Удалить все сохранённые вкладки? Это действие нельзя отменить.')) return;
  allTabs = [];
  await chrome.storage.local.set({ [STORAGE_KEY]: [] });
  renderList([]);
});

loadTabs();
