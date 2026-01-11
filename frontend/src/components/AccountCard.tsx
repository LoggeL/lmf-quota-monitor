import { QuotaBar } from './QuotaBar';
import type { Account } from '../types';

interface AccountCardProps {
  account: Account;
}

export function AccountCard({ account }: AccountCardProps) {
  const hasError = account.quota?.fetchError;

  return (
    <div
      className={`
        p-4 rounded-lg border transition-all
        ${account.isActive 
          ? 'border-green-500 bg-green-50' 
          : 'border-gray-200 bg-white'
        }
      `}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900">{account.email}</span>
          {account.isActive && (
            <span className="px-2 py-0.5 text-xs font-medium bg-green-500 text-white rounded-full">
              Active
            </span>
          )}
        </div>
      </div>

      {hasError ? (
        <div className="text-sm text-red-500">
          Error: {account.quota?.fetchError}
        </div>
      ) : (
        <div className="space-y-2">
          <QuotaBar
            label="Claude"
            percent={account.quota?.claudeQuotaPercent ?? null}
            resetTime={account.quota?.claudeResetTime ?? null}
            color="orange"
          />
          <QuotaBar
            label="Flash"
            percent={account.quota?.geminiFlashQuotaPercent ?? null}
            resetTime={account.quota?.geminiFlashResetTime ?? null}
            color="blue"
          />
          <QuotaBar
            label="Pro"
            percent={account.quota?.geminiProQuotaPercent ?? null}
            resetTime={account.quota?.geminiProResetTime ?? null}
            color="blue"
          />
        </div>
      )}

      {account.quota?.lastFetched && (
        <div className="mt-2 text-xs text-gray-400">
          Updated {formatRelativeTime(account.quota.lastFetched)}
        </div>
      )}
    </div>
  );
}

function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}
