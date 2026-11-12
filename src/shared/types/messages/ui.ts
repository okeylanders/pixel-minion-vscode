import { MessageEnvelope } from './base';

/** The tabs the webview renders. Settings is an overlay, not a tab. */
export const TAB_IDS = ['image', 'svg'] as const;
export type TabId = typeof TAB_IDS[number];

/**
 * A persisted tab id the webview can still show, else the Image tab. Covers
 * the legacy `'settings'` tab (now the overlay), removed tabs and junk, any
 * of which would otherwise leave an empty panel.
 */
export function normalizeTabId(saved: unknown): TabId {
  return (TAB_IDS as readonly unknown[]).includes(saved) ? (saved as TabId) : 'image';
}

export interface TabChangedPayload {
  tabId: TabId;
}

export type TabChangedMessage = MessageEnvelope<TabChangedPayload>;
