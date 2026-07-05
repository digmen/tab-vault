import { STORAGE_KEY, type ParkedTab, type ParkTabMessage } from './types';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'parkTab',
    title: chrome.i18n.getMessage('parkTabMenu'),
    contexts: ['page'],
  });
  chrome.contextMenus.create({
    id: 'parkWindow',
    title: chrome.i18n.getMessage('parkWindowMenu'),
    contexts: ['page'],
  });
});

chrome.runtime.onMessage.addListener((msg: ParkTabMessage, _sender, sendResponse) => {
  if (msg?.action === 'parkTab') {
    parkTabs([msg.tab]).then(() => sendResponse({ ok: true }));
    return true; // keep the message channel open for the async response
  }
  return undefined;
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab) return;
  if (info.menuItemId === 'parkTab') {
    await parkTabs([tab]);
  } else if (info.menuItemId === 'parkWindow') {
    const tabs = await chrome.tabs.query({ windowId: tab.windowId });
    await parkTabs(tabs);
  }
});

interface GroupInfo {
  name: string;
  color: string;
}

function isRealGroup(groupId: number | undefined): groupId is number {
  return groupId != null && groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE;
}

async function getGroupInfo(groupId: number): Promise<GroupInfo | null> {
  try {
    const group = await chrome.tabGroups.get(groupId);
    return { name: group.title ?? '', color: group.color };
  } catch {
    return null;
  }
}

type ParkableTab = chrome.tabs.Tab & { url: string; id: number };

async function parkTabs(tabs: chrome.tabs.Tab[]): Promise<void> {
  const parkable = tabs.filter(
    (t): t is ParkableTab =>
      t.url != null &&
      t.id != null &&
      !t.url.startsWith('chrome://') &&
      !t.url.startsWith('chrome-extension://')
  );
  if (parkable.length === 0) return;

  // Collect unique real group ids and fetch their info once, in parallel.
  const groupIds = [...new Set(parkable.map((t) => t.groupId).filter(isRealGroup))];
  const groupMap = new Map<number, GroupInfo | null>();
  await Promise.all(
    groupIds.map(async (gid) => {
      groupMap.set(gid, await getGroupInfo(gid));
    })
  );

  const now = Date.now();
  const newParked: ParkedTab[] = parkable.map((tab) => {
    const group = isRealGroup(tab.groupId) ? groupMap.get(tab.groupId) : null;
    return {
      id: crypto.randomUUID(),
      url: tab.url,
      title: tab.title || tab.url,
      favIconUrl: tab.favIconUrl || '',
      groupName: group?.name ?? null,
      groupColor: group?.color ?? null,
      savedAt: now,
    };
  });

  const result = await chrome.storage.local.get(STORAGE_KEY);
  const existing: ParkedTab[] = Array.isArray(result[STORAGE_KEY]) ? result[STORAGE_KEY] : [];

  // Insert new (unstarred) tabs after all starred items.
  const firstUnstarred = existing.findIndex((t) => !t.starred);
  const insertAt = firstUnstarred === -1 ? existing.length : firstUnstarred;
  const updated = [
    ...existing.slice(0, insertAt),
    ...newParked,
    ...existing.slice(insertAt),
  ];
  await chrome.storage.local.set({ [STORAGE_KEY]: updated });

  await chrome.tabs.remove(parkable.map((t) => t.id));
}
