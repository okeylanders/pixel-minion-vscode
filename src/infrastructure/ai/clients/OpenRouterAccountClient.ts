/**
 * OpenRouterAccountClient - reads OpenRouter account health (not generation).
 *
 * Two independent calls:
 * - GET /api/v1/key     -> the key's spend limit (limit / limit_remaining / limit_reset)
 * - GET /api/v1/credits -> the account balance (total_credits / total_usage)
 *
 * They are separate because a key can read its own limit while `/credits`
 * fails (e.g. 403), and the caller must keep whichever half succeeded. Each
 * method returns a discriminated result instead of throwing for transport,
 * HTTP or body failures. Keys and raw bodies never leave this class.
 */
import {
  OpenRouterAccountIssue,
  OpenRouterCredits,
  OpenRouterKeyLimit,
} from '@messages';
import { SecretStorageService } from '@secrets';
import { LoggingService } from '@logging';

const FETCH_TIMEOUT_MS = 8_000;

export type OpenRouterAccountCallResult<T> =
  | { status: 'ok'; data: T }
  | { status: 'no_key' }
  | { status: 'unavailable'; issue: OpenRouterAccountIssue };

export class OpenRouterAccountClient {
  private readonly baseUrl = 'https://openrouter.ai/api/v1';

  constructor(
    private readonly secretStorage: SecretStorageService,
    private readonly logger: LoggingService
  ) {}

  fetchKeyLimit(): Promise<OpenRouterAccountCallResult<OpenRouterKeyLimit>> {
    return this.get('/key', 'a data object', (data) => ({
      limit: numberOrNull(data.limit),
      limitRemaining: numberOrNull(data.limit_remaining),
      resetWindow: toResetWindow(data.limit_reset),
    }));
  }

  fetchCredits(): Promise<OpenRouterAccountCallResult<OpenRouterCredits>> {
    return this.get('/credits', 'a numeric total_credits', (data) => {
      // total_credits is the source of truth. Defaulting it would render a
      // made-up (often negative) balance, so a missing value is unusable.
      if (!isFiniteNumber(data.total_credits)) return undefined;
      const totalCredits = data.total_credits;
      const totalUsage = isFiniteNumber(data.total_usage) ? data.total_usage : 0;
      return { totalCredits, totalUsage, remaining: totalCredits - totalUsage };
    });
  }

  /**
   * Shared GET: key lookup, timeout, HTTP-status mapping, JSON parsing.
   * Secret-storage failures are not caught here; the caller reports them.
   */
  private async get<T>(
    path: '/key' | '/credits',
    expected: string,
    parse: (data: Record<string, unknown>) => T | undefined
  ): Promise<OpenRouterAccountCallResult<T>> {
    const apiKey = await this.secretStorage.getApiKey();
    if (!apiKey) return { status: 'no_key' };

    const label = `OpenRouter ${path}`;
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        headers: this.headers(apiKey),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
    } catch (error) {
      this.logger.warn(`${label} request failed`, error);
      return { status: 'unavailable', issue: { kind: 'network' } };
    }

    if (!response.ok) {
      // 4xx is a key or scope problem the user can see in the UI, so debug.
      // 5xx means OpenRouter is down, which is worth seeing without debug logs.
      if (response.status >= 500) {
        this.logger.warn(`${label} returned ${response.status}`);
      } else {
        this.logger.debug(`${label} returned ${response.status}`);
      }
      return { status: 'unavailable', issue: issueForHttpStatus(response.status) };
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch (error) {
      this.logger.warn(`${label} returned a non-JSON body`, error);
      return { status: 'unavailable', issue: { kind: 'malformed' } };
    }

    const data = isRecord(body) ? body.data : undefined;
    const parsed = isRecord(data) ? parse(data) : undefined;
    if (parsed === undefined) {
      this.logger.warn(`${label} response is missing ${expected}`);
      return { status: 'unavailable', issue: { kind: 'malformed' } };
    }
    return { status: 'ok', data: parsed };
  }

  private headers(apiKey: string): Record<string, string> {
    return {
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://github.com/pixel-minion-vscode',
      'X-Title': 'Pixel Minion VS Code Extension',
    };
  }
}

function issueForHttpStatus(status: number): OpenRouterAccountIssue {
  if (status === 401) return { kind: 'invalid_key', httpStatus: status };
  if (status === 403) return { kind: 'forbidden', httpStatus: status };
  if (status === 429) return { kind: 'rate_limited', httpStatus: status };
  if (status >= 500) return { kind: 'server_error', httpStatus: status };
  return { kind: 'http_error', httpStatus: status };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function numberOrNull(value: unknown): number | null {
  return isFiniteNumber(value) ? value : null;
}

function toResetWindow(value: unknown): OpenRouterKeyLimit['resetWindow'] {
  const raw = typeof value === 'string' ? value.toLowerCase() : '';
  // OpenRouter sends "daily" | "weekly" | "monthly" | null. Note "daily" does
  // not contain "day", so match it explicitly.
  if (raw === 'daily' || raw.includes('day')) return 'daily';
  if (raw.includes('week')) return 'weekly';
  if (raw.includes('month')) return 'monthly';
  return 'unknown';
}
