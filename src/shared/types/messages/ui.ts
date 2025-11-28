import { MessageEnvelope } from './base';

export type TabId = 'helloWorld' | 'tab2' | 'settings';

export interface TabChangedPayload {
  tabId: TabId;
}

export type TabChangedMessage = MessageEnvelope<TabChangedPayload>;
