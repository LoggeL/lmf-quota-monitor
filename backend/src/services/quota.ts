import { EventEmitter } from 'events';
import type { AccountQuota, ModelQuota } from '../types.js';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '77185425430.apps.googleusercontent.com';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'OTJgUOQcT7lO7GsGZq2G4IlT';
const POLL_INTERVAL = parseInt(process.env.QUOTA_POLL_INTERVAL || '120000', 10);

const CLOUDCODE_ENDPOINTS = [
  'https://cloudcode-pa.googleapis.com',
  'https://daily-cloudcode-pa.sandbox.googleapis.com',
];

const CLOUDCODE_HEADERS = {
  'User-Agent': 'antigravity/1.11.5 windows/amd64',
  'X-Goog-Api-Client': 'google-cloud-sdk vscode_cloudshelleditor/0.1',
  'Client-Metadata': '{"ideType":"IDE_UNSPECIFIED","platform":"PLATFORM_UNSPECIFIED","pluginType":"GEMINI"}',
};

interface TokenCache {
  accessToken: string;
  expiresAt: number;
}

interface FetchModelsResponse {
  models?: Record<string, {
    displayName?: string;
    quotaInfo?: {
      remainingFraction?: number;
      resetTime?: string;
    };
  }>;
}

export class QuotaService extends EventEmitter {
  private quotaCache = new Map<string, AccountQuota>();
  private tokenCache = new Map<string, TokenCache>();
  private pollingInterval: NodeJS.Timeout | null = null;
  private lastFetch = 0;

  async refreshAccessToken(refreshToken: string): Promise<string | null> {
    const cached = this.tokenCache.get(refreshToken);
    if (cached && cached.expiresAt > Date.now() + 60000) {
      return cached.accessToken;
    }

    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
      });

      if (!response.ok) {
        console.error('[Quota] Token refresh failed:', await response.text());
        return null;
      }

      const data = await response.json() as { access_token: string; expires_in?: number };
      const expiresIn = data.expires_in || 3600;

      this.tokenCache.set(refreshToken, {
        accessToken: data.access_token,
        expiresAt: Date.now() + expiresIn * 1000,
      });

      return data.access_token;
    } catch (error) {
      console.error('[Quota] Token refresh error:', error);
      return null;
    }
  }

  private async fetchModels(accessToken: string, projectId?: string): Promise<FetchModelsResponse | null> {
    const body = projectId ? { project: projectId } : {};

    for (const endpoint of CLOUDCODE_ENDPOINTS) {
      try {
        const response = await fetch(`${endpoint}/v1internal:fetchAvailableModels`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            ...CLOUDCODE_HEADERS,
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(15000),
        });

        if (response.status === 429) {
          console.warn(`[Quota] Rate limited on ${endpoint}`);
          continue;
        }

        if (!response.ok) {
          console.warn(`[Quota] ${endpoint} returned ${response.status}`);
          continue;
        }

        return await response.json() as FetchModelsResponse;
      } catch (error) {
        console.warn(`[Quota] ${endpoint} failed:`, error);
      }
    }

    return null;
  }

  private parseModels(data: FetchModelsResponse): ModelQuota[] {
    if (!data?.models) return [];

    return Object.entries(data.models).map(([modelName, modelData]) => {
      const quotaInfo = modelData.quotaInfo;
      const remainingFraction = quotaInfo?.remainingFraction ?? 1.0;
      const resetTime = quotaInfo?.resetTime || null;

      return {
        modelName,
        displayName: modelData.displayName || modelName,
        remainingPercent: Math.round(remainingFraction * 100),
        resetTime,
        resetTimeMs: resetTime ? new Date(resetTime).getTime() : null,
      };
    });
  }

  async fetchQuotaForAccount(
    email: string,
    refreshToken: string,
    projectId?: string
  ): Promise<AccountQuota> {
    const result: AccountQuota = {
      email,
      projectId,
      lastFetched: Date.now(),
      models: [],
      claudeQuotaPercent: null,
      geminiFlashQuotaPercent: null,
      geminiProQuotaPercent: null,
      claudeResetTime: null,
      geminiFlashResetTime: null,
      geminiProResetTime: null,
    };

    const accessToken = await this.refreshAccessToken(refreshToken);
    if (!accessToken) {
      result.fetchError = 'Failed to refresh token';
      return result;
    }

    const data = await this.fetchModels(accessToken, projectId);
    if (!data) {
      result.fetchError = 'Failed to fetch models';
      return result;
    }

    result.models = this.parseModels(data);

    // Calculate Claude quota (min of all claude models)
    const claudeModels = result.models.filter(m =>
      m.modelName.toLowerCase().includes('claude') ||
      m.modelName.toLowerCase().includes('anthropic')
    );
    if (claudeModels.length > 0) {
      const minClaude = claudeModels.reduce((min, m) =>
        m.remainingPercent < min.remainingPercent ? m : min
      );
      result.claudeQuotaPercent = minClaude.remainingPercent;
      result.claudeResetTime = minClaude.resetTimeMs;
    }

    // Calculate Gemini Flash quota
    const geminiFlashModels = result.models.filter(m =>
      m.modelName.toLowerCase().includes('gemini') &&
      m.modelName.toLowerCase().includes('flash')
    );
    if (geminiFlashModels.length > 0) {
      const minFlash = geminiFlashModels.reduce((min, m) =>
        m.remainingPercent < min.remainingPercent ? m : min
      );
      result.geminiFlashQuotaPercent = minFlash.remainingPercent;
      result.geminiFlashResetTime = minFlash.resetTimeMs;
    }

    // Calculate Gemini Pro quota
    const geminiProModels = result.models.filter(m =>
      m.modelName.toLowerCase().includes('gemini') &&
      m.modelName.toLowerCase().includes('pro')
    );
    if (geminiProModels.length > 0) {
      const minPro = geminiProModels.reduce((min, m) =>
        m.remainingPercent < min.remainingPercent ? m : min
      );
      result.geminiProQuotaPercent = minPro.remainingPercent;
      result.geminiProResetTime = minPro.resetTimeMs;
    }

    this.quotaCache.set(email, result);
    return result;
  }

  async fetchAllQuotas(accounts: Array<{
    email: string;
    refreshToken: string;
    projectId?: string;
  }>): Promise<AccountQuota[]> {
    console.log(`[Quota] Fetching quotas for ${accounts.length} accounts...`);
    const start = Date.now();

    const results = await Promise.allSettled(
      accounts.map(acc =>
        this.fetchQuotaForAccount(acc.email, acc.refreshToken, acc.projectId)
      )
    );

    const quotas: AccountQuota[] = results.map((result, i) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }
      const acc = accounts[i];
      return {
        email: acc.email,
        projectId: acc.projectId,
        lastFetched: Date.now(),
        fetchError: result.reason?.message || 'Unknown error',
        models: [],
        claudeQuotaPercent: null,
        geminiFlashQuotaPercent: null,
        geminiProQuotaPercent: null,
        claudeResetTime: null,
        geminiFlashResetTime: null,
        geminiProResetTime: null,
      };
    });

    this.lastFetch = Date.now();
    const success = quotas.filter(q => !q.fetchError).length;
    console.log(`[Quota] Fetched ${success}/${quotas.length} in ${Date.now() - start}ms`);

    this.emit('quotas_updated', quotas);
    return quotas;
  }

  getCachedQuotas(): AccountQuota[] {
    return Array.from(this.quotaCache.values());
  }

  getCachedQuota(email: string): AccountQuota | null {
    return this.quotaCache.get(email) || null;
  }

  startPolling(getAccounts: () => Array<{
    email: string;
    refreshToken: string;
    projectId?: string;
  }>): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }

    // Initial fetch
    this.fetchAllQuotas(getAccounts());

    // Start polling
    this.pollingInterval = setInterval(() => {
      const accounts = getAccounts();
      if (accounts.length > 0) {
        this.fetchAllQuotas(accounts);
      }
    }, POLL_INTERVAL);

    console.log(`[Quota] Polling every ${POLL_INTERVAL / 1000}s`);
  }

  stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }
}

let instance: QuotaService | null = null;

export function getQuotaService(): QuotaService {
  if (!instance) {
    instance = new QuotaService();
  }
  return instance;
}
