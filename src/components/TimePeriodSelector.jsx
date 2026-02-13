import React from 'react';
import { theme } from '../styles/theme';
import { Calendar } from 'lucide-react';

const BASE_OPTIONS = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'ytd', label: 'YTD' },
];

const WEEKLY_OPTION = { value: 'weekly', label: 'Weekly' };

export default function TimePeriodSelector({ timePeriod, setTimePeriod, hasWeekly }) {
  const OPTIONS = hasWeekly ? [WEEKLY_OPTION, ...BASE_OPTIONS] : BASE_OPTIONS;
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: theme.spacing.xs,
        background: theme.colors.backgroundAlt,
        borderRadius: theme.borderRadius.md,
        padding: '3px',
      }}
    >
      <Calendar size={14} style={{ color: theme.colors.textLight, marginLeft: 6 }} />
      {OPTIONS.map(opt => {
        const isActive = timePeriod === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => setTimePeriod(opt.value)}
            style={{
              padding: `${theme.spacing.xs} ${theme.spacing.md}`,
              border: 'none',
              borderRadius: theme.borderRadius.sm,
              background: isActive ? theme.colors.primary : 'transparent',
              color: isActive ? '#ffffff' : theme.colors.textLight,
              fontFamily: theme.fonts.body,
              fontSize: '0.8rem',
              fontWeight: isActive ? 600 : 400,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
