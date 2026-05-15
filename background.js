const STORAGE_KEY = 'parkedTabs';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'parkTab',
    title: 'Сохранить эту вкладку',
    contexts: ['page']
  });
  chrome.contextMenus.create({
    id: 'parkWindow',
    title: 'Сохранить все вкладки окна',
    contexts: ['page']
  });
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === 'parkTab') {
    parkTabs([msg.tab]).then(() => sendResponse({ ok: true }));
    return true; // async response
  }
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'parkTab') {
    await parkTabs([tab]);
  } else if (info.menuItemId === 'parkWindow') {
    const tabs = await chrome.tabs.query({ windowId: tab.windowId });
    await parkTabs(tabs);
  }
});

async function getGroupInfo(groupId) {
  if (!groupId || groupId === chrome.tabGroups.TAB_GROUP_ID_NONE) return null;
  try {
    const group = await chrome.tabGroups.get(groupId);
    return { name: group.title || '', color: group.color };
  } catch {
    return null;
  }
}

async function parkTabs(tabs) {
  const parkable = tabs.filter(t =>
    t.url &&
    !t.url.startsWith('chrome://') &&
    !t.url.startsWith('chrome-extension://')
  );

  if (parkable.length === 0) return;

  // Collect unique group IDs and fetch their info once
  const groupIds = [...new Set(parkable.map(t => t.groupId).filter(Boolean))];
  const groupMap = {};
  for (const gid of groupIds) {
    groupMap[gid] = await getGroupInfo(gid);
  }

  const now = Date.now();
  const newParked = parkable.map((tab, i) => ({
    id: now + i,
    url: tab.url,
    title: tab.title || tab.url,
    favIconUrl: tab.favIconUrl || '',
    groupName: groupMap[tab.groupId]?.name ?? null,
    groupColor: groupMap[tab.groupId]?.color ?? null,
    savedAt: now
  }));

  const result = await chrome.storage.local.get(STORAGE_KEY);
  const existing = result[STORAGE_KEY] || [];
  await chrome.storage.local.set({ [STORAGE_KEY]: [...newParked, ...existing] });

  await chrome.tabs.remove(parkable.map(t => t.id));
}
