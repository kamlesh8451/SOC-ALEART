import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDuration, intervalToDuration } from 'date-fns';

export const SLACountdown: React.FC<{ deadline: number, className?: string }> = ({ deadline, className }) => {
  const [timeLeft, setTimeLeft] = useState<number>(deadline - Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      const remaining = deadline - Date.now();
      setTimeLeft(remaining);
      if (remaining <= 0) clearInterval(timer);
    }, 1000);

    return () => clearInterval(timer);
  }, [deadline]);

  if (timeLeft <= 0) {
    return (
      <div className={cn("flex items-center gap-1.5 text-error font-black animate-pulse uppercase tracking-widest", className)}>
        <Clock size={12} />
        EXPIRED
      </div>
    );
  }

  const duration = intervalToDuration({ start: 0, end: timeLeft });
  
  // Custom short format
  const parts = [];
  if (duration.days) parts.push(`${duration.days}d`);
  if (duration.hours) parts.push(`${duration.hours}h`);
  if (duration.minutes) parts.push(`${duration.minutes}m`);
  if (duration.seconds !== undefined && !duration.days) parts.push(`${duration.seconds}s`);

  const formatted = parts.slice(0, 2).join(' ');
  const isUrgent = timeLeft < 1000 * 60 * 60; // 1 hour

  return (
    <div className={cn(
      "flex items-center gap-1.5 font-mono font-bold tracking-tighter",
      isUrgent ? "text-error animate-pulse" : "text-primary",
      className
    )}>
      <Clock size={12} className={isUrgent ? "animate-spin" : ""} />
      {formatted}
    </div>
  );
};
