import { useEffect, useState } from 'react';

interface ProgressBarProps {
  durationMs: number;
  onComplete: () => void;
  isPaused?: boolean;
}

export function ProgressBar({ durationMs, onComplete, isPaused }: ProgressBarProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (isPaused) return;

    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const newProgress = Math.min((elapsed / durationMs) * 100, 100);
      
      setProgress(newProgress);

      if (elapsed >= durationMs) {
        clearInterval(interval);
        onComplete();
        setProgress(0); // Reset immediately for next cycle
      }
    }, 100);

    return () => clearInterval(interval);
  }, [durationMs, onComplete, isPaused]); // Re-run when these change, effectively resetting on onComplete if parent triggers re-render or logic

  return (
    <div className="fixed bottom-0 left-0 w-full h-1 bg-gray-200">
      <div 
        className="h-full bg-blue-500 transition-all duration-100 ease-linear"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
