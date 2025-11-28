import { MessageEnvelope } from './base';

export type TabId = 'image' | 'svg' | 'settings';

export interface TabChangedPayload {
  tabId: TabId;
}

export type TabChangedMessage = MessageEnvelope<TabChangedPayload>;
