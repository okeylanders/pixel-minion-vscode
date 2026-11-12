/**
 * AccountBalanceHandler - routes OpenRouter balance requests to the shared
 * AccountBalanceService and posts the sanitized payload to the webview.
 *
 * Thin handler: no caching, timers or combining logic (the service owns
 * those). It never throws to the router: an unexpected failure re-posts the
 * service's last figures, or, when there are none, a usable `unavailable`
 * payload, so the header never sticks on "…".
 */
import {
  MessageEnvelope,
  MessageType,
  OpenRouterBalancePayload,
  OpenRouterBalanceResetPayload,
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
   * figures, tell the webview to stop showing them right away (the new key's
   * fetch can take up to the client's timeout), then push the new state (a
   * cleared key resolves to `no_key` without a network call).
   */
  async handleApiKeyChanged(): Promise<void> {
    this.service.invalidate();
    this.postMessage(createEnvelope<OpenRouterBalanceResetPayload>(
      MessageType.OPENROUTER_BALANCE_RESET,
      'extension.account',
      { accountEpoch: this.service.accountEpoch() }
    ));
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
    // The key this load is for. If the key changes before it fails, the
    // fallback below is labelled with the old epoch and the webview drops it.
    const accountEpoch = this.service.accountEpoch();
    let payload: OpenRouterBalancePayload;
    try {
      payload = await load();
    } catch (error) {
      this.logger.error('OpenRouter balance request failed', error);
      /* Prefer the last real figures, with their own fetchedAt. An error
         stamped "now" would hide them, and the webview's newest-wins check
         would then also reject the next (older) cached copy of them. */
      payload = this.service.lastKnownBalance()
        ?? { status: 'unavailable', creditsStatus: 'unavailable', accountEpoch, fetchedAt: Date.now() };
    }
    this.postBalance(payload, correlationId);
  }
}
