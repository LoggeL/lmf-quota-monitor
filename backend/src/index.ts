import 'dotenv/config';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { createNodeWebSocket } from '@hono/node-ws';
import { serveStatic } from '@hono/node-server/serve-static';
import { cors } from 'hono/cors';
import { getAccountsService } from './services/accounts.js';
import { getQuotaService } from './services/quota.js';
import type { WSContext } from 'hono/ws';
import type { Account, WSMessage } from './types.js';

const PORT = parseInt(process.env.PORT || '3456', 10);

const app = new Hono();
const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

// Middleware
app.use('*', cors());

// Anonymize email: show only first 2 chars
function anonymizeEmail(email: string): string {
  const [local, domain] = email.split('@');
  const prefix = local.slice(0, 2);
  return `${prefix}***@${domain}`;
}

// Store connected WebSocket clients
const wsClients = new Set<WSContext>();

// Broadcast to all connected clients
function broadcast(message: WSMessage) {
  const data = JSON.stringify(message);
  for (const ws of wsClients) {
    try {
      ws.send(data);
    } catch {
      wsClients.delete(ws);
    }
  }
}

// Get enriched accounts with quota data (anonymized for API response)
function getEnrichedAccounts(): Account[] {
  const accountsService = getAccountsService();
  const quotaService = getQuotaService();
  const accounts = accountsService.getAccounts();
  const quotas = quotaService.getCachedQuotas();
  const quotaMap = new Map(quotas.map(q => [q.email, q]));
  const now = Date.now();

  return accounts.map(acc => {
    const quota = quotaMap.get(acc.email);
    const rateLimits = acc.rateLimitResetTimes || {};
    
    // Find active rate limits
    const claudeResetTime = rateLimits['claude'];
    const isClaudeRateLimited = claudeResetTime && claudeResetTime > now;
    
    // Find Gemini Flash rate limit (check keys containing 'flash')
    const flashKey = Object.keys(rateLimits).find(k => k.toLowerCase().includes('flash'));
    const flashResetTime = flashKey ? rateLimits[flashKey] : undefined;
    const isFlashRateLimited = flashResetTime && flashResetTime > now;
    
    // Find Gemini Pro rate limit (check keys containing 'pro')
    const proKey = Object.keys(rateLimits).find(k => k.toLowerCase().includes('pro'));
    const proResetTime = proKey ? rateLimits[proKey] : undefined;
    const isProRateLimited = proResetTime && proResetTime > now;
    
    // Build quota with rate limit overrides
    let enrichedQuota = quota ? {
      ...quota,
      email: anonymizeEmail(quota.email),
    } : null;
    
    // If rate limited, override quota to 0% and set reset time
    if (enrichedQuota) {
      // Check for explicit rate limits from config
      if (isClaudeRateLimited) {
        enrichedQuota.claudeQuotaPercent = 0;
        enrichedQuota.claudeResetTime = claudeResetTime;
      }
      if (isFlashRateLimited) {
        enrichedQuota.geminiFlashQuotaPercent = 0;
        enrichedQuota.geminiFlashResetTime = flashResetTime;
      }
      if (isProRateLimited) {
        enrichedQuota.geminiProQuotaPercent = 0;
        enrichedQuota.geminiProResetTime = proResetTime;
      }
      
      // If API returns 100% but no reset time, it's likely rate-limited (show 0%)
      if (enrichedQuota.claudeQuotaPercent === 100 && !enrichedQuota.claudeResetTime) {
        enrichedQuota.claudeQuotaPercent = 0;
      }
      if (enrichedQuota.geminiFlashQuotaPercent === 100 && !enrichedQuota.geminiFlashResetTime) {
        enrichedQuota.geminiFlashQuotaPercent = 0;
      }
      if (enrichedQuota.geminiProQuotaPercent === 100 && !enrichedQuota.geminiProResetTime) {
        enrichedQuota.geminiProQuotaPercent = 0;
      }
    } else {
      // Create a quota object if API didn't return one but we have rate limits
      if (isClaudeRateLimited || isFlashRateLimited || isProRateLimited) {
        enrichedQuota = {
          email: anonymizeEmail(acc.email),
          projectId: acc.projectId,
          lastFetched: now,
          models: [],
          claudeQuotaPercent: isClaudeRateLimited ? 0 : null,
          geminiFlashQuotaPercent: isFlashRateLimited ? 0 : null,
          geminiProQuotaPercent: isProRateLimited ? 0 : null,
          claudeResetTime: isClaudeRateLimited ? claudeResetTime : null,
          geminiFlashResetTime: isFlashRateLimited ? flashResetTime : null,
          geminiProResetTime: isProRateLimited ? proResetTime : null,
        };
      }
    }
    
    return {
      email: anonymizeEmail(acc.email),
      projectId: acc.projectId,
      isActive: acc.isActive,
      quota: enrichedQuota,
    };
  });
}

// Subscribe to quota updates and broadcast
const quotaService = getQuotaService();
quotaService.on('quotas_updated', () => {
  broadcast({
    type: 'update',
    accounts: getEnrichedAccounts(),
    timestamp: Date.now(),
  });
});

// Health check
app.get('/api/health', (c) => {
  const accountsService = getAccountsService();
  return c.json({
    status: 'ok',
    accounts: accountsService.getAccounts().length,
    timestamp: Date.now(),
  });
});

// Get all accounts with quotas
app.get('/api/accounts', (c) => {
  return c.json(getEnrichedAccounts());
});

// Force refresh all quotas
app.post('/api/accounts/refresh', async (c) => {
  const accountsService = getAccountsService();
  const quotaService = getQuotaService();
  const rawAccounts = accountsService.getRawAccounts();
  
  await quotaService.fetchAllQuotas(rawAccounts);
  return c.json(getEnrichedAccounts());
});

// WebSocket endpoint
app.get('/ws', upgradeWebSocket(() => ({
  onOpen(_event, ws) {
    wsClients.add(ws);
    ws.send(JSON.stringify({
      type: 'initial',
      accounts: getEnrichedAccounts(),
      timestamp: Date.now(),
    } satisfies WSMessage));
  },
  onClose(_event, ws) {
    wsClients.delete(ws);
  },
  onError(_event, ws) {
    wsClients.delete(ws);
  },
})));

// Serve static frontend files in production
app.use('/*', serveStatic({ root: '../frontend/dist' }));
app.get('*', serveStatic({ path: '../frontend/dist/index.html' }));

// Start server
const server = serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`[Server] LMF Quota Monitor running on http://localhost:${info.port}`);
  
  const accountsService = getAccountsService();
  const quotaService = getQuotaService();
  
  // Start quota polling
  quotaService.startPolling(() => accountsService.getRawAccounts());
  
  // Subscribe to account file changes
  accountsService.on('accounts_changed', () => {
    broadcast({
      type: 'update',
      accounts: getEnrichedAccounts(),
      timestamp: Date.now(),
    });
  });
});

injectWebSocket(server);
