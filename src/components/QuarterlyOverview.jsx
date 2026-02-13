import React from 'react';
import { theme } from '../styles/theme';
import { formatValue } from '../utils/timePeriodUtils';
import { useResponsive } from '../hooks/useResponsive';

export default function QuarterlyOverview({ quarters, selectedQuarter, setSelectedQuarter, primaryMetric }) {
  if (!quarters || quarters.length === 0) return null;
  const useDollars = primaryMetric === 'dollars';
  const { isMobile } = useResponsive();

  return (
    <div style={{ marginBottom: theme.spacing.lg }}>
      <h3 style={{
        fontFamily: theme.fonts.heading, fontSize: isMobile ? '0.9rem' : '1.1rem',
        fontWeight: 600, marginBottom: theme.spacing.md, color: theme.colors.text,
      }}>
        Quarter-over-Quarter Overview
      </h3>
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : `repeat(${Math.min(quarters.length, 4)}, 1fr)`,
        gap: theme.spacing.md,
      }}>
        {quarters.map(q => {
          const isSelected = q.quarter === selectedQuarter;
          return (
            <div
              key={q.quarter}
              onClick={() => setSelectedQuarter(q.quarter)}
              style={{
                background: theme.colors.cardBg,
                borderRadius: theme.borderRadius.lg,
                padding: isMobile ? theme.spacing.md : theme.spacing.lg,
                border: isSelected
                  ? `2px solid ${theme.colors.primary}`
                  : `1px solid ${theme.colors.border}`,
                boxShadow: isSelected ? theme.shadows.md : theme.shadows.sm,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginBottom: theme.spacing.sm,
              }}>
                <span style={{
                  fontFamily: theme.fonts.heading, fontWeight: 700,
                  fontSize: isMobile ? '0.9rem' : '1.1rem', color: theme.colors.text,
                }}>
                  {q.displayLabel || q.quarter}
                </span>
                <span style={{
                  fontSize: '0.7rem', color: theme.colors.textLight,
                  fontFamily: theme.fonts.body,
                }}>
                  {q.monthCount}
                </span>
              </div>

              {/* Current total */}
              <div style={{ fontSize: isMobile ? '1.1rem' : '1.4rem', fontWeight: 700, fontFamily: theme.fonts.heading, color: theme.colors.text }}>
                {formatValue(q.currentTotal, useDollars)}
              </div>

              {/* QEP for incomplete quarters */}
              {!q.isComplete && (
                <div style={{ fontSize: '0.8rem', color: theme.colors.primaryDark, fontFamily: theme.fonts.body, marginTop: '2px' }}>
                  QEP: {formatValue(q.qep, useDollars)}
                  <span style={{
                    display: 'inline-block', marginLeft: '6px',
                    background: '#fff3cd', color: '#856404', padding: '1px 6px',
                    borderRadius: '3px', fontSize: '0.65rem', fontWeight: 600,
                  }}>
                    Partial
                  </span>
                </div>
              )}

              {/* YoY % */}
              <div style={{ display: 'flex', gap: theme.spacing.sm, marginTop: theme.spacing.sm, flexWrap: 'wrap' }}>
                {q.yoyPct != null && (
                  <span style={{
                    fontSize: '0.78rem', fontWeight: 600, fontFamily: theme.fonts.body,
                    color: q.yoyPct >= 0 ? theme.colors.success : theme.colors.danger,
                  }}>
                    YoY: {q.yoyPct >= 0 ? '+' : ''}{q.yoyPct.toFixed(1)}%
                  </span>
                )}
                {q.pacePercent != null && (
                  <span style={{
                    fontSize: '0.78rem', fontFamily: theme.fonts.body,
                    color: q.pacePercent >= 0 ? theme.colors.primaryDark : theme.colors.danger,
                  }}>
                    Pace: {q.pacePercent >= 0 ? '+' : ''}{q.pacePercent.toFixed(1)}%
                  </span>
                )}
              </div>

              {/* Product count */}
              <div style={{
                fontSize: '0.72rem', color: theme.colors.textLight,
                fontFamily: theme.fonts.body, marginTop: theme.spacing.xs,
              }}>
                {q.productCount} products
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
