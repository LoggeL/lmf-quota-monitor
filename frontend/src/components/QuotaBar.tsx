interface QuotaBarProps {
  label: string;
  percent: number | null;
  resetTime: number | null;
  color: 'orange' | 'blue';
}

function formatTimeUntil(resetTimeMs: number): string {
  const now = Date.now();
  const diff = resetTimeMs - now;
  if (diff <= 0) return 'now';
  
  const hours = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export function QuotaBar({ label, percent, resetTime, color }: QuotaBarProps) {
  if (percent === null) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        <span className="w-16">{label}:</span>
        <span className="text-gray-400 dark:text-gray-500">No data</span>
      </div>
    );
  }

  const bgColor = color === 'orange' ? 'bg-orange-500' : 'bg-blue-500';
  const trackColor = color === 'orange' ? 'bg-orange-100 dark:bg-orange-900/30' : 'bg-blue-100 dark:bg-blue-900/30';

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-16 text-gray-600 dark:text-gray-300">{label}:</span>
      <div className={`flex-1 h-3 rounded-full ${trackColor} overflow-hidden`}>
        <div
          className={`h-full ${bgColor} transition-all duration-300`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="w-12 text-right font-mono text-gray-700 dark:text-gray-200">{percent}%</span>
      {resetTime && percent < 100 && (
        <span className="text-xs text-gray-400 dark:text-gray-500">
          ({formatTimeUntil(resetTime)})
        </span>
      )}
    </div>
  );
}
