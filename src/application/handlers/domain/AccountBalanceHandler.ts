/**
 * AccountBalanceHandler - routes OpenRouter balance requests to the shared
 * AccountBalanceService and posts the sanitized payload to the webview.
 *
 * Thin handler: no caching, timers or combining logic (the service owns
 * those). It never throws to the router; an unexpected failure still posts a
 * usable `unavailable` payload so the header never sticks on "…".
 */
import {
  MessageEnvelope,
  MessageType,
  OpenRouterBalancePayload,
  RequestOpenRouterBalancePayload,
  createEnvelope,
} from '@messages';
import { LoggingService } from '@logging';
import { AccountBalanceService } from '../../../infrastructure/account';

export class AccountBalanceHandler {
  constructor(
    private readonly postMessage: (message: MessageEnvelope) => void,
    private readonly service: AccountBalanceService,
    private readonly logger: LoggingService
  ) {}

  async handleRequest(
    message: MessageEnvelope<RequestOpenRouterBalancePayload | undefined>
  ): Promise<void> {
    const forceRefresh = message.payload?.forceRefresh === true;
    this.logger.debug(`OpenRouter balance requested (forceRefresh=${forceRefresh})`);
    await this.respond(() => this.service.getBalance(forceRefresh), message.correlationId);
  }

  /**
   * The stored key was saved, replaced or cleared. Drop the previous key's
   * figures and push the new state (a cleared key resolves to `no_key`
   * without a network call).
   */
  async handleApiKeyChanged(): Promise<void> {
    this.service.invalidate();
    await this.respond(() => this.service.getBalance(true));
  }

  postBalance(payload: OpenRouterBalancePayload, correlationId?: string): void {
    this.postMessage(createEnvelope<OpenRouterBalancePayload>(
      MessageType.OPENROUTER_BALANCE_DATA,
      'extension.account',
      payload,
      correlationId
    ));
  }

  private async respond(
    load: () => Promise<OpenRouterBalancePayload>,
    correlationId?: string
  ): Promise<void> {
    let payload: OpenRouterBalancePayload;
    try {
      payload = await load();
    } catch (error) {
      this.logger.error('OpenRouter balance request failed', error);
      payload = { status: 'unavailable', creditsStatus: 'unavailable', fetchedAt: Date.now() };
    }
    this.postBalance(payload, correlationId);
  }
}
