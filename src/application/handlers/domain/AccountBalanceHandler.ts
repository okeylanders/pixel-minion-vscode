import {
  MessageEnvelope,
  MessageType,
  OpenRouterBalancePayload,
  createEnvelope,
} from '@messages';
import { OpenRouterAccountClient } from '@ai';
import { LoggingService } from '@logging';

const POST_REQUEST_REFRESH_DELAY_MS = 10_000;

export class AccountBalanceHandler {
  private refreshTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private readonly postMessage: (message: MessageEnvelope) => void,
    private readonly client: OpenRouterAccountClient,
    private readonly logger: LoggingService
  ) {}

  async handleRequest(): Promise<void> {
    try {
      const balance = await this.client.fetchBalance();
      this.postMessage(createEnvelope<OpenRouterBalancePayload>(
        MessageType.OPENROUTER_BALANCE_DATA,
        'extension.account',
        balance
      ));
    } catch (error) {
      this.logger.error('OpenRouter balance request failed', error);
      this.postMessage(createEnvelope<OpenRouterBalancePayload>(
        MessageType.OPENROUTER_BALANCE_DATA,
        'extension.account',
        {
          status: 'unavailable',
          reason: 'OpenRouter balance request failed.',
          fetchedAt: Date.now(),
        }
      ));
    }
  }

  schedulePostRequestRefresh(): void {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = undefined;
      void this.handleRequest();
    }, POST_REQUEST_REFRESH_DELAY_MS);
    this.refreshTimer.unref?.();
  }
}
