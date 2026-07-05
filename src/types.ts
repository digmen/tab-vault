export const STORAGE_KEY = 'parkedTabs';

/** A tab that has been parked and persisted to chrome.storage.local. */
export interface ParkedTab {
  /** Stable unique id. New tabs use crypto.randomUUID(); legacy data may hold a number. */
  id: string | number;
  url: string;
  title: string;
  favIconUrl: string;
  groupName: string | null;
  groupColor: string | null;
  savedAt: number;
  starred?: boolean;
}

/** Message sent from the popup to the service worker. */
export interface ParkTabMessage {
  action: 'parkTab';
  tab: chrome.tabs.Tab;
}
