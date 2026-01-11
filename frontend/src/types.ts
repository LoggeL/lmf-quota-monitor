// Shared types for frontend

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
  geminiQuotaPercent: number | null;
  claudeResetTime: number | null;
  geminiResetTime: number | null;
}

export interface Account {
  email: string;
  projectId?: string;
  isActive: boolean;
  quota: AccountQuota | null;
}

export type WSMessageType = 'initial' | 'update' | 'error';

export interface WSMessage {
  type: WSMessageType;
  accounts?: Account[];
  error?: string;
  timestamp: number;
}
