import { useState, useCallback } from 'react';
import { useStore } from './store';
import { useWebSocket, refreshQuotas } from './lib/api';
import { AccountCard } from './components/AccountCard';

export default function App() {
  const { accounts, connected, loading, error, setAccounts } = useStore();
  const [refreshing, setRefreshing] = useState(false);

  useWebSocket();

  const handleRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const updated = await refreshQuotas();
      setAccounts(updated);
    } catch (err) {
      console.error('Refresh failed:', err);
    } finally {
      setRefreshing(false);
    }
  }, [refreshing, setAccounts]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-gray-900">
              LMF Quota Monitor
            </h1>
            <span
              className={`
                w-2 h-2 rounded-full
                ${connected ? 'bg-green-500' : 'bg-red-500'}
              `}
              title={connected ? 'Connected' : 'Disconnected'}
            />
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="
              px-4 py-2 text-sm font-medium rounded-lg
              bg-gray-900 text-white hover:bg-gray-800
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors
            "
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto p-6">
        {loading && accounts.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            Loading accounts...
          </div>
        ) : error ? (
          <div className="text-center py-12 text-red-500">
            Error: {error}
          </div>
        ) : accounts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-2">No accounts found</p>
            <p className="text-sm text-gray-400">
              Add accounts to ~/.config/opencode/antigravity-accounts.json
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {accounts.map((account) => (
              <AccountCard key={account.email} account={account} />
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="text-center py-4 text-xs text-gray-400">
        {accounts.length} account{accounts.length !== 1 ? 's' : ''} • 5-hour rolling quotas
      </footer>
    </div>
  );
}
