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

  return accounts.map(acc => {
    const quota = quotaMap.get(acc.email);
    return {
      email: anonymizeEmail(acc.email),
      projectId: acc.projectId,
      isActive: acc.isActive,
      quota: quota ? {
        ...quota,
        email: anonymizeEmail(quota.email),
      } : null,
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
