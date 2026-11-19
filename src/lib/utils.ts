import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTimeRemaining(seconds: number): string {
  const safe = typeof seconds === 'number' && !isNaN(seconds) ? Math.max(0, Math.floor(seconds)) : 1500;
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function formatRelativeDeadline(dueDateStr: string): string {
  try {
    const due = new Date(dueDateStr).getTime();
    const now = Date.now();
    const diffMs = due - now;

    if (diffMs < 0) {
      const pastDays = Math.floor(Math.abs(diffMs) / (1000 * 60 * 60 * 24));
      return pastDays === 0 ? 'Overdue today' : `${pastDays}d overdue`;
    }

    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (diffDays === 0) {
      return diffHours <= 1 ? 'Due very soon' : `Due in ${diffHours}h`;
    }
    return `In ${diffDays}d ${diffHours}h`;
  } catch {
    return 'Invalid date';
  }
}
