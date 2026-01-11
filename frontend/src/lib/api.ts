import type { Account } from '../types';

const API_BASE = '';

export async function fetchAccounts(): Promise<Account[]> {
  const response = await fetch(`${API_BASE}/api/accounts`);
  if (!response.ok) {
    throw new Error('Failed to fetch accounts');
  }
  return response.json();
}

export async function refreshQuotas(): Promise<Account[]> {
  const response = await fetch(`${API_BASE}/api/accounts/refresh`, {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error('Failed to refresh quotas');
  }
  return response.json();
}
