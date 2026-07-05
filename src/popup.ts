import { STORAGE_KEY, type ParkedTab, type ParkTabMessage } from './types';

function t(key: string): string {
  return chrome.i18n.getMessage(key) || key;
}

function applyI18n(): void {
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    const msg = t(el.dataset.i18n!);
    if (msg) el.textContent = msg;
  });
  document.querySelectorAll<HTMLInputElement>('[data-i18n-placeholder]').forEach((el) => {
    const msg = t(el.dataset.i18nPlaceholder!);
    if (msg) el.placeholder = msg;
  });
}

const GROUP_COLORS: Record<string, string> = {
  grey: '#5f6368',
  blue: '#1a73e8',
  red: '#d93025',
  yellow: '#f9ab00',
  green: '#1e8e3e',
  pink: '#d01884',
  purple: '#a142f4',
  cyan: '#007b83',
  orange: '#fa903e',
};

const FALLBACK_FAVICON =
  "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect width='16' height='16' rx='3' fill='%23444'/><text x='8' y='12' font-size='10' text-anchor='middle' fill='%23999'>?</text></svg>";

let allTabs: ParkedTab[] = [];
let dragSrcId: string | null = null;

const listEl = document.getElementById('tabList') as HTMLDivElement;
const countEl = document.getElementById('count') as HTMLSpanElement;
const searchEl = document.getElementById('search') as HTMLInputElement;

const idOf = (tab: ParkedTab): string => String(tab.id);
const findTab = (id: string): ParkedTab | undefined => allTabs.find((tab) => idOf(tab) === id);
const findIndex = (id: string): number => allTabs.findIndex((tab) => idOf(tab) === id);

// ── Load ──────────────────────────────────────────────────
async function loadTabs(): Promise<void> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  allTabs = Array.isArray(result[STORAGE_KEY]) ? result[STORAGE_KEY] : [];
  renderFiltered();
}

// ── Render ────────────────────────────────────────────────
function renderList(tabs: ParkedTab[]): void {
  countEl.textContent = String(allTabs.length);

  if (tabs.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📭</div>
        ${t('emptyState')}
        <strong>${t('emptyHint')}</strong>
      </div>`;
    return;
  }

  // Build off-DOM, then swap in one shot to minimise reflows.
  const frag = document.createDocumentFragment();
  tabs.forEach((tab) => frag.appendChild(buildItem(tab)));
  listEl.replaceChildren(frag);
}

function buildItem(tab: ParkedTab): HTMLDivElement {
  const wrap = document.createElement('div');
  wrap.className = 'tab-item' + (tab.starred ? ' is-starred' : '');
  wrap.dataset.id = idOf(tab);
  wrap.draggable = true;

  const handle = document.createElement('span');
  handle.className = 'drag-handle';
  handle.textContent = '⠿';
  wrap.appendChild(handle);

  const starBtn = document.createElement('button');
  starBtn.className = 'btn-star' + (tab.starred ? ' starred' : '');
  starBtn.title = tab.starred ? t('starRemove') : t('starAdd');
  starBtn.textContent = tab.starred ? '★' : '☆';
  wrap.appendChild(starBtn);

  const img = document.createElement('img');
  img.className = 'tab-favicon';
  img.src = tab.favIconUrl || FALLBACK_FAVICON;
  img.onerror = () => {
    img.src = FALLBACK_FAVICON;
  };
  wrap.appendChild(img);

  if (tab.groupColor) {
    wrap.classList.add('has-group');
    wrap.style.borderLeftColor = GROUP_COLORS[tab.groupColor] || '#5f6368';
    wrap.title = tab.groupName ? `${t('groupPrefix')} ${tab.groupName}` : '';
  }

  const info = document.createElement('div');
  info.className = 'tab-info';

  const title = document.createElement('div');
  title.className = 'tab-title';
  title.textContent = tab.title;

  const url = document.createElement('div');
  url.className = 'tab-url';
  url.textContent = tab.url;

  info.append(title, url);
  wrap.appendChild(info);

  const actions = document.createElement('div');
  actions.className = 'tab-actions';

  const restoreBtn = document.createElement('button');
  restoreBtn.className = 'btn-icon';
  restoreBtn.title = t('restore');
  restoreBtn.textContent = '↗';

  const delBtn = document.createElement('button');
  delBtn.className = 'btn-icon del';
  delBtn.title = t('deleteTab');
  delBtn.textContent = '×';

  actions.append(restoreBtn, delBtn);
  wrap.appendChild(actions);

  return wrap;
}

// ── Star ──────────────────────────────────────────────────
async function toggleStar(id: string): Promise<void> {
  const idx = findIndex(id);
  if (idx === -1) return;

  const [tab] = allTabs.splice(idx, 1);
  tab.starred = !tab.starred;

  if (tab.starred) {
    // Starred → jump to the top.
    allTabs.unshift(tab);
  } else {
    // Unstarred → place after the last starred item.
    const lastStarredIdx = allTabs.reduce((last, t2, i) => (t2.starred ? i : last), -1);
    allTabs.splice(lastStarredIdx + 1, 0, tab);
  }

  await saveOrder();
  renderFiltered();
}

// ── Actions ───────────────────────────────────────────────
async function restoreTab(id: string): Promise<void> {
  const tab = findTab(id);
  if (!tab) return;
  await chrome.tabs.create({ url: tab.url, active: true });
  await removeTab(id);
}

async function removeTab(id: string): Promise<void> {
  allTabs = allTabs.filter((tab) => idOf(tab) !== id);
  await saveOrder();
  renderFiltered();
}

async function restoreAll(): Promise<void> {
  const visible = getFiltered();
  // Open all tabs at once instead of one-by-one.
  await Promise.all(visible.map((tab) => chrome.tabs.create({ url: tab.url, active: false })));
  const ids = new Set(visible.map(idOf));
  allTabs = allTabs.filter((tab) => !ids.has(idOf(tab)));
  await saveOrder();
  renderFiltered();
}

async function saveOrder(): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: allTabs });
}

// ── Search ────────────────────────────────────────────────
function getFiltered(): ParkedTab[] {
  const q = searchEl.value.toLowerCase().trim();
  if (!q) return allTabs;
  return allTabs.filter(
    (tab) => tab.title.toLowerCase().includes(q) || tab.url.toLowerCase().includes(q)
  );
}

function renderFiltered(): void {
  renderList(getFiltered());
}

// ── Drag and drop (event-delegated on the list) ───────────
function clearDropIndicators(): void {
  listEl
    .querySelectorAll('.tab-item.drag-above, .tab-item.drag-below')
    .forEach((el) => el.classList.remove('drag-above', 'drag-below'));
}

listEl.addEventListener('dragstart', (e) => {
  const item = (e.target as HTMLElement).closest<HTMLElement>('.tab-item');
  if (!item) return;
  dragSrcId = item.dataset.id!;
  item.classList.add('dragging');
  e.dataTransfer!.effectAllowed = 'move';
  e.dataTransfer!.setData('text/plain', dragSrcId); // required for Firefox
});

listEl.addEventListener('dragover', (e) => {
  const item = (e.target as HTMLElement).closest<HTMLElement>('.tab-item');
  if (!item || dragSrcId == null) return;
  e.preventDefault();
  e.dataTransfer!.dropEffect = 'move';
  clearDropIndicators();
  const rect = item.getBoundingClientRect();
  item.classList.add(e.clientY < rect.top + rect.height / 2 ? 'drag-above' : 'drag-below');
});

listEl.addEventListener('dragleave', (e) => {
  (e.target as HTMLElement)
    .closest<HTMLElement>('.tab-item')
    ?.classList.remove('drag-above', 'drag-below');
});

listEl.addEventListener('drop', (e) => {
  const item = (e.target as HTMLElement).closest<HTMLElement>('.tab-item');
  e.preventDefault();
  clearDropIndicators();
  if (!item || dragSrcId == null) return;

  const targetId = item.dataset.id!;
  if (dragSrcId === targetId) return;

  const srcIndex = findIndex(dragSrcId);
  const targetIndex = findIndex(targetId);
  if (srcIndex === -1 || targetIndex === -1) return;

  const rect = item.getBoundingClientRect();
  const insertBefore = e.clientY < rect.top + rect.height / 2;

  const [srcTab] = allTabs.splice(srcIndex, 1);
  const newTargetIdx = findIndex(targetId);
  allTabs.splice(insertBefore ? newTargetIdx : newTargetIdx + 1, 0, srcTab);

  void saveOrder();
  renderFiltered();
});

listEl.addEventListener('dragend', () => {
  clearDropIndicators();
  listEl.querySelector('.tab-item.dragging')?.classList.remove('dragging');
  dragSrcId = null;
});

// ── Click delegation (star / restore / delete / row) ──────
listEl.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  const item = target.closest<HTMLElement>('.tab-item');
  if (!item) return;
  const id = item.dataset.id!;

  if (target.closest('.btn-star')) {
    void toggleStar(id);
  } else if (target.closest('.btn-icon.del')) {
    void removeTab(id);
  } else {
    // Restore button or a click anywhere else on the row.
    void restoreTab(id);
  }
});

// ── Top-level controls ────────────────────────────────────
document.getElementById('parkCurrent')!.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  const msg: ParkTabMessage = { action: 'parkTab', tab };
  await chrome.runtime.sendMessage(msg);
  await loadTabs(); // reload as soon as the worker confirms — no artificial delay
});

let searchTimer: number | undefined;
searchEl.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = window.setTimeout(renderFiltered, 80);
});

document.getElementById('restoreAll')!.addEventListener('click', () => void restoreAll());

document.getElementById('clearAll')!.addEventListener('click', async () => {
  if (!confirm(t('clearConfirm'))) return;
  allTabs = [];
  await chrome.storage.local.set({ [STORAGE_KEY]: [] });
  renderFiltered();
});

applyI18n();
void loadTabs();
