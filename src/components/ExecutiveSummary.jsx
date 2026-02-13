import React, { useMemo } from 'react';
import { theme } from '../styles/theme';
import { sumPeriod, formatValue } from '../utils/timePeriodUtils';
import { DollarSign, ShoppingCart, TrendingUp, Package, Target } from 'lucide-react';
import { useResponsive } from '../hooks/useResponsive';

function ChangeBadge({ value, suffix = '%' }) {
  if (value == null || isNaN(value)) return null;
  const isPositive = value >= 0;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '2px',
      padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem',
      fontWeight: 600, fontFamily: theme.fonts.body,
      background: isPositive ? '#e8f5e9' : '#fce4ec',
      color: isPositive ? '#2e7d32' : '#c62828',
    }}>
      {isPositive ? '+' : ''}{value.toFixed(1)}{suffix}
    </span>
  );
}

export default function ExecutiveSummary({
  posData, currentData, comparisonData, periodLabel, timePeriod,
  primaryMetric, fullPrevYearData, comparableMonths,
  qepDollars, qepUnits, yepDollars, yepUnits,
  paceDollarsPct, paceUnitsPct, isComplete, monthsWithData,
}) {
  const kpis = useMemo(() => {
    if (!currentData) return null;
    const useDollars = primaryMetric === 'dollars';
    const current = sumPeriod(currentData);
    const comparison = comparisonData ? sumPeriod(comparisonData) : null;

    const curVal = useDollars ? current.dollars : current.units;
    const compVal = comparison ? (useDollars ? comparison.dollars : comparison.units) : 0;
    const yoyPct = compVal > 0 ? ((curVal - compVal) / compVal) * 100 : null;

    // Projection
    let projection = null;
    let paceLabel = null;
    let pacePct = null;
    if (timePeriod === 'quarterly' && !isComplete) {
      projection = useDollars ? qepDollars : qepUnits;
      paceLabel = 'QEP';
      const fullPrev = sumPeriod(fullPrevYearData);
      const prevVal = useDollars ? fullPrev.dollars : fullPrev.units;
      pacePct = prevVal > 0 ? ((projection - prevVal) / prevVal) * 100 : null;
    } else if (timePeriod === 'ytd') {
      projection = useDollars ? yepDollars : yepUnits;
      paceLabel = 'YEP';
      pacePct = useDollars ? paceDollarsPct : paceUnitsPct;
    }

    return {
      totalRevenue: current.dollars,
      totalUnits: current.units,
      yoyPct,
      activeProducts: current.productCount,
      useDollars,
      projection,
      paceLabel,
      pacePct,
    };
  }, [currentData, comparisonData, primaryMetric, timePeriod, isComplete,
      qepDollars, qepUnits, yepDollars, yepUnits, paceDollarsPct, paceUnitsPct, fullPrevYearData]);

  const { isMobile } = useResponsive();

  if (!kpis) {
    return (
      <div style={{ padding: theme.spacing.xl, textAlign: 'center', color: theme.colors.textLight }}>
        No data available for Executive Summary.
      </div>
    );
  }

  const cards = [
    ...(kpis.useDollars ? [{
      title: 'Total Revenue',
      subtitle: periodLabel,
      value: formatValue(kpis.totalRevenue, true),
      icon: DollarSign,
      color: theme.colors.primary,
    }] : []),
    {
      title: 'Total Units',
      subtitle: periodLabel,
      value: formatValue(kpis.totalUnits, false),
      icon: ShoppingCart,
      color: kpis.useDollars ? theme.colors.chartColors[1] : theme.colors.primary,
    },
    {
      title: 'YoY Growth',
      subtitle: kpis.useDollars ? 'Dollar Year-over-Year' : 'Units Year-over-Year',
      value: kpis.yoyPct != null ? `${kpis.yoyPct >= 0 ? '+' : ''}${kpis.yoyPct.toFixed(1)}%` : 'N/A',
      icon: TrendingUp,
      color: kpis.yoyPct != null && kpis.yoyPct >= 0 ? theme.colors.success : theme.colors.danger,
    },
    {
      title: 'Active Products',
      subtitle: `${periodLabel}`,
      value: formatValue(kpis.activeProducts, false),
      icon: Package,
      color: theme.colors.chartColors[3],
    },
    ...(kpis.projection != null ? [{
      title: `${kpis.paceLabel} Projection`,
      subtitle: kpis.pacePct != null
        ? `Pace: ${kpis.pacePct >= 0 ? '+' : ''}${kpis.pacePct.toFixed(1)}%`
        : 'Year-End Pace',
      value: formatValue(kpis.projection, kpis.useDollars),
      icon: Target,
      color: theme.colors.primaryDark,
      changeBadge: kpis.pacePct,
    }] : []),
  ];

  return (
    <div>
      <h2 style={{
        fontFamily: theme.fonts.heading, fontSize: isMobile ? '1.1rem' : '1.3rem',
        color: theme.colors.secondary, marginBottom: theme.spacing.lg,
      }}>
        Executive Summary
      </h2>
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(auto-fit, minmax(150px, 1fr))' : 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: theme.spacing.lg,
      }}>
        {cards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div key={i} style={{
              background: theme.colors.cardBg, borderRadius: theme.borderRadius.lg,
              boxShadow: theme.shadows.sm, padding: isMobile ? theme.spacing.md : theme.spacing.xl,
              display: 'flex', flexDirection: 'column', gap: theme.spacing.sm,
              borderTop: `3px solid ${card.color}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{
                  fontFamily: theme.fonts.body, fontSize: '0.8rem', color: theme.colors.textLight,
                  fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em',
                }}>
                  {card.title}
                </span>
                <div style={{
                  width: 36, height: 36, borderRadius: theme.borderRadius.md,
                  background: `${card.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={18} style={{ color: card.color }} />
                </div>
              </div>
              <div style={{
                fontFamily: theme.fonts.heading, fontSize: isMobile ? '1.3rem' : '1.8rem',
                fontWeight: 700, color: theme.colors.text,
              }}>
                {card.value}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
                {card.changeBadge != null && <ChangeBadge value={card.changeBadge} />}
                <span style={{
                  fontFamily: theme.fonts.body, fontSize: '0.72rem', color: theme.colors.textLight,
                }}>
                  {card.subtitle}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
