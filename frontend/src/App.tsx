import { useState, useEffect, useCallback } from 'react';
import { useStore } from './store';
import { fetchAccounts, refreshQuotas } from './lib/api';
import { AccountCard } from './components/AccountCard';
import { ProgressBar } from './components/ProgressBar';

const POLL_INTERVAL = 120000; // 2 minutes

export default function App() {
  const { accounts, loading, error, setAccounts, setError, setLoading } = useStore();
  const [refreshing, setRefreshing] = useState(false);
  const [pollKey, setPollKey] = useState(0);
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('darkMode');
      if (saved !== null) return saved === 'true';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  // Apply dark mode class to html element
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('darkMode', String(darkMode));
  }, [darkMode]);

  const loadData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      const data = isRefresh ? await refreshQuotas() : await fetchAccounts();
      setAccounts(data);
      setError(null);
    } catch (err) {
      console.error('Load failed:', err);
      setError('Failed to load data');
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [setAccounts, setError, setLoading]);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleManualRefresh = async () => {
    await loadData(true);
    setPollKey(prev => prev + 1);
  };

  const handlePollComplete = useCallback(() => {
    loadData();
    setPollKey(prev => prev + 1);
  }, [loadData]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-8 transition-colors">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 transition-colors">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
              LMF Quota Monitor
            </h1>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Dark Mode Toggle */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {darkMode ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>

            <button
              onClick={handleManualRefresh}
              disabled={refreshing}
              className="
                px-4 py-2 text-sm font-medium rounded-lg
                bg-gray-900 dark:bg-white text-white dark:text-gray-900 
                hover:bg-gray-800 dark:hover:bg-gray-100
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-colors
              "
            >
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto p-6">
        {loading && accounts.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            Loading accounts...
          </div>
        ) : error ? (
          <div className="text-center py-12 text-red-500 dark:text-red-400">
            Error: {error}
          </div>
        ) : accounts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400 mb-2">No accounts found</p>
            <p className="text-sm text-gray-400 dark:text-gray-500">
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
      <footer className="text-center py-4 text-xs text-gray-400 dark:text-gray-500 flex flex-col gap-2 items-center">
        <p>{accounts.length} account{accounts.length !== 1 ? 's' : ''} • 5-hour rolling quotas</p>
        <a 
          href="https://github.com/LoggeL/lmf-quota-monitor" 
          target="_blank" 
          rel="noopener noreferrer" 
          className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors flex items-center gap-1"
        >
          <span>View source on GitHub</span>
          <svg height="12" width="12" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
        </a>
      </footer>

      <ProgressBar 
        key={pollKey}
        durationMs={POLL_INTERVAL} 
        onComplete={handlePollComplete} 
        isPaused={refreshing}
      />
    </div>
  );
}
