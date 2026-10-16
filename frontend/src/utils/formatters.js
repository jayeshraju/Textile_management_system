/**
 * Formatting utilities for dates, numbers, units, and percentages.
 */

export const formatDate = (dateInput) => {
  if (!dateInput) return '—';

  // If string starts with YYYY-MM-DD
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateInput)) {
    if (dateInput.length === 10 || dateInput.includes('T00:00:00')) {
      const [year, month, day] = dateInput.slice(0, 10).split('-').map(Number);
      return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-US', {
        timeZone: 'UTC',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    }
  }

  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '—';

  // If time is midnight UTC, preserve the exact calendar date
  if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0) {
    return d.toLocaleDateString('en-US', {
      timeZone: 'UTC',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export const formatRelativeDays = (daysRemaining) => {
  if (daysRemaining === undefined || daysRemaining === null) return '—';
  if (daysRemaining < 0) return `${Math.abs(daysRemaining)}d overdue`;
  if (daysRemaining === 0) return 'Due today';
  if (daysRemaining === 1) return 'Due tomorrow';
  return `${daysRemaining}d left`;
};

export const formatNumber = (val) => {
  if (val === undefined || val === null) return '0';
  return Number(val).toLocaleString('en-US');
};

export const formatPercent = (val) => {
  if (val === undefined || val === null) return '0%';
  return `${Math.round(Number(val))}%`;
};
