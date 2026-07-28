import {
  OpenRouterBalancePayload,
  OpenRouterCredits,
  OpenRouterKeyLimit,
} from '@messages';
import { SecretStorageService } from '@secrets';
import { LoggingService } from '@logging';

const FETCH_TIMEOUT_MS = 8_000;

export class OpenRouterAccountClient {
  private readonly baseUrl = 'https://openrouter.ai/api/v1';

  constructor(
    private readonly secretStorage: SecretStorageService,
    private readonly logger: LoggingService
  ) {}

  async fetchBalance(): Promise<OpenRouterBalancePayload> {
    const apiKey = await this.secretStorage.getApiKey();
    if (!apiKey) return { status: 'no_key', fetchedAt: Date.now() };

    const [keyLimit, credits] = await Promise.all([
      this.fetchKeyLimit(apiKey),
      this.fetchCredits(apiKey),
    ]);

    if (!keyLimit && !credits) {
      return {
        status: 'unavailable',
        reason: 'OpenRouter account balance is unavailable.',
        fetchedAt: Date.now(),
      };
    }

    return {
      status: 'ok',
      keyLimit: keyLimit ?? undefined,
      credits: credits ?? undefined,
      fetchedAt: Date.now(),
    };
  }

  private async fetchKeyLimit(apiKey: string): Promise<OpenRouterKeyLimit | null> {
    try {
      const response = await fetch(`${this.baseUrl}/key`, {
        headers: this.headers(apiKey),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!response.ok) {
        this.logger.debug(`OpenRouter /key returned ${response.status}`);
        return null;
      }
      const body = await response.json() as { data?: Record<string, unknown> };
      const data = body.data ?? {};
      return {
        limit: this.numberOrNull(data.limit),
        limitRemaining: this.numberOrNull(data.limit_remaining),
        resetWindow: this.resetWindow(data.limit_reset),
      };
    } catch (error) {
      this.logger.warn('OpenRouter key-limit request failed', error);
      return null;
    }
  }

  private async fetchCredits(apiKey: string): Promise<OpenRouterCredits | null> {
    try {
      const response = await fetch(`${this.baseUrl}/credits`, {
        headers: this.headers(apiKey),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!response.ok) {
        this.logger.debug(`OpenRouter /credits returned ${response.status}`);
        return null;
      }
      const body = await response.json() as { data?: Record<string, unknown> };
      const data = body.data ?? {};
      if (typeof data.total_credits !== 'number' || !Number.isFinite(data.total_credits)) {
        return null;
      }
      const totalCredits = data.total_credits;
      const totalUsage =
        typeof data.total_usage === 'number' && Number.isFinite(data.total_usage)
          ? data.total_usage
          : 0;
      return { totalCredits, totalUsage, remaining: totalCredits - totalUsage };
    } catch (error) {
      this.logger.warn('OpenRouter credits request failed', error);
      return null;
    }
  }

  private headers(apiKey: string): Record<string, string> {
    return {
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://github.com/pixel-minion-vscode',
      'X-Title': 'Pixel Minion VS Code Extension',
    };
  }

  private numberOrNull(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }

  private resetWindow(value: unknown): OpenRouterKeyLimit['resetWindow'] {
    const raw = typeof value === 'string' ? value.toLowerCase() : '';
    if (raw.includes('day')) return 'daily';
    if (raw.includes('week')) return 'weekly';
    if (raw.includes('month')) return 'monthly';
    return 'unknown';
  }
}
