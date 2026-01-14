// Shared types for Antigravity Lite

export interface ModelQuota {
  modelName: string;
  displayName: string;
  remainingPercent: number;
  resetTime: string | null;
  resetTimeMs: number | null;
}

export interface AccountQuota {
  email: string;
  projectId?: string;
  lastFetched: number;
  fetchError?: string;
  models: ModelQuota[];
  claudeQuotaPercent: number | null;
  geminiFlashQuotaPercent: number | null;
  geminiProQuotaPercent: number | null;
  claudeResetTime: number | null;
  geminiFlashResetTime: number | null;
  geminiProResetTime: number | null;
}

export interface Account {
  email: string;
  projectId?: string;
  isActive: boolean;
  quota: AccountQuota | null;
}

export interface RawAccountData {
  email: string;
  refreshToken: string;
  projectId?: string;
  addedAt?: number;
  lastUsed?: number;
  rateLimitResetTimes?: Record<string, number>;
}

export interface RawAccountsFile {
  version: number;
  accounts: RawAccountData[];
  activeIndex: number;
  activeIndexByFamily?: {
    claude?: number;
    gemini?: number;
  };
}

// WebSocket message types
export type WSMessageType = 'initial' | 'update' | 'error';

export interface WSMessage {
  type: WSMessageType;
  accounts?: Account[];
  error?: string;
  timestamp: number;
}
