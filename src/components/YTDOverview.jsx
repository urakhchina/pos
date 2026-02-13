import React, { useMemo } from 'react';
import { theme } from '../styles/theme';
import { formatValue, sumPeriod, MONTH_NAMES } from '../utils/timePeriodUtils';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { useResponsive } from '../hooks/useResponsive';

export default function YTDOverview({
  trendData, currentData, comparisonData, fullPrevYearData,
  primaryMetric, comparableMonths,
  yepDollars, yepUnits, paceDollarsPct, paceUnitsPct,
  yearA, yearB, periodLabel,
}) {
  const useDollars = primaryMetric === 'dollars';
  const { isMobile } = useResponsive();

  const { currentTotals, comparisonTotals, fullPrevTotals, monthlyTrend } = useMemo(() => {
    const cur = sumPeriod(currentData);
    const comp = sumPeriod(comparisonData);
    const prev = sumPeriod(fullPrevYearData);

    // Pivot trendData into month-by-month comparison
    const byMonth = {};
    (trendData || []).forEach(d => {
      const monthName = MONTH_NAMES[parseInt(d.month, 10) - 1];
      if (!byMonth[d.month]) byMonth[d.month] = { month: monthName, mm: d.month };
      if (d.year === yearA) {
        byMonth[d.month].prevDollars = d.dollars;
        byMonth[d.month].prevUnits = d.units;
        byMonth[d.month].prevProducts = d.productCount;
      }
      if (d.year === yearB) {
        byMonth[d.month].curDollars = d.dollars;
        byMonth[d.month].curUnits = d.units;
        byMonth[d.month].curProducts = d.productCount;
      }
    });
    const trend = Object.values(byMonth).sort((a, b) => a.mm.localeCompare(b.mm));

    // Compute average velocity (value / active products) per month
    // Leave undefined when no data exists so Recharts skips the point
    trend.forEach(row => {
      const curVal = useDollars ? row.curDollars : row.curUnits;
      const prevVal = useDollars ? row.prevDollars : row.prevUnits;
      row.curVelocity = row.curProducts > 0 && curVal != null
        ? curVal / row.curProducts : undefined;
      row.prevVelocity = row.prevProducts > 0 && prevVal != null
        ? prevVal / row.prevProducts : undefined;
    });

    return { currentTotals: cur, comparisonTotals: comp, fullPrevTotals: prev, monthlyTrend: trend };
  }, [trendData, currentData, comparisonData, fullPrevYearData, yearA, yearB, useDollars]);

  const currentVal = useDollars ? currentTotals.dollars : currentTotals.units;
  const compVal = useDollars ? comparisonTotals.dollars : comparisonTotals.units;
  const fullPrevVal = useDollars ? fullPrevTotals.dollars : fullPrevTotals.units;
  const yoyPct = compVal > 0 ? ((currentVal - compVal) / compVal) * 100 : null;
  const yep = useDollars ? yepDollars : yepUnits;
  const pace = useDollars ? paceDollarsPct : paceUnitsPct;

  const cards = [
    { label: `${yearA} Total`, value: formatValue(fullPrevVal, useDollars), sub: 'Full Year' },
    { label: `${yearB} YTD`, value: formatValue(currentVal, useDollars), sub: `${comparableMonths} months` },
    { label: `${yearB} YEP`, value: formatValue(yep, useDollars), sub: 'Year-End Pace', accent: true },
    ...(yoyPct != null ? [{
      label: 'YoY Growth',
      value: `${yoyPct >= 0 ? '+' : ''}${yoyPct.toFixed(1)}%`,
      sub: 'Comparable months',
      color: yoyPct >= 0 ? theme.colors.success : theme.colors.danger,
    }] : []),
    ...(pace != null && fullPrevVal > 0 ? [{
      label: 'Pace %',
      value: `${pace >= 0 ? '+' : ''}${pace.toFixed(1)}%`,
      sub: 'YEP vs Full Year',
      color: pace >= 0 ? theme.colors.primaryDark : theme.colors.danger,
    }] : []),
  ];

  const chartStyle = {
    background: theme.colors.cardBg, borderRadius: theme.borderRadius.lg,
    boxShadow: theme.shadows.sm, padding: theme.spacing.lg,
  };

  const valKey = useDollars ? 'Dollars' : 'Units';
  const curField = useDollars ? 'curDollars' : 'curUnits';
  const prevField = useDollars ? 'prevDollars' : 'prevUnits';

  return (
    <div style={{ marginBottom: theme.spacing.lg }}>
      <h3 style={{
        fontFamily: theme.fonts.heading, fontSize: '1.1rem',
        fontWeight: 600, marginBottom: theme.spacing.md, color: theme.colors.text,
      }}>
        {periodLabel}
      </h3>

      {/* Summary Cards */}
      <div style={{
        display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: theme.spacing.md, marginBottom: theme.spacing.lg,
      }}>
        {cards.map((c, i) => (
          <div key={i} style={{
            background: theme.colors.cardBg, borderRadius: theme.borderRadius.lg,
            padding: theme.spacing.md, boxShadow: theme.shadows.sm,
            borderTop: `3px solid ${c.color || (c.accent ? theme.colors.primary : theme.colors.border)}`,
          }}>
            <div style={{ fontSize: '0.75rem', color: theme.colors.textLight, fontFamily: theme.fonts.body, marginBottom: '4px' }}>
              {c.label}
            </div>
            <div style={{
              fontSize: '1.3rem', fontWeight: 700, fontFamily: theme.fonts.heading,
              color: c.color || theme.colors.text,
            }}>
              {c.value}
            </div>
            <div style={{ fontSize: '0.68rem', color: theme.colors.textLight, fontFamily: theme.fonts.body }}>
              {c.sub}
            </div>
          </div>
        ))}
      </div>

      {/* Trend Charts */}
      {monthlyTrend.length > 1 && yearA !== yearB && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(380px, 1fr))', gap: theme.spacing.md }}>
          {/* Value by Month */}
          <div style={chartStyle}>
            <h4 style={{ fontFamily: theme.fonts.heading, fontSize: '0.9rem', fontWeight: 600, marginBottom: theme.spacing.sm }}>
              {useDollars ? 'Revenue' : 'Units'} by Month
            </h4>
            <ResponsiveContainer width="100%" height={isMobile ? 160 : 200}>
              <LineChart data={monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke={theme.colors.border} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => useDollars ? `$${(v/1000).toFixed(0)}K` : v.toLocaleString()} />
                <Tooltip formatter={v => formatValue(v, useDollars)} />
                <Legend />
                <Line type="monotone" dataKey={prevField} name={yearA} stroke={theme.colors.chartColors[1]} strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey={curField} name={yearB} stroke={theme.colors.primary} strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Product Count by Month */}
          <div style={chartStyle}>
            <h4 style={{ fontFamily: theme.fonts.heading, fontSize: '0.9rem', fontWeight: 600, marginBottom: theme.spacing.sm }}>
              Active Products by Month
            </h4>
            <ResponsiveContainer width="100%" height={isMobile ? 160 : 200}>
              <LineChart data={monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke={theme.colors.border} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="prevProducts" name={yearA} stroke={theme.colors.chartColors[1]} strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="curProducts" name={yearB} stroke={theme.colors.primary} strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Avg Velocity by Month */}
          <div style={chartStyle}>
            <h4 style={{ fontFamily: theme.fonts.heading, fontSize: '0.9rem', fontWeight: 600, marginBottom: theme.spacing.sm }}>
              Avg {useDollars ? 'Revenue' : 'Units'} per SKU by Month
            </h4>
            <ResponsiveContainer width="100%" height={isMobile ? 160 : 200}>
              <LineChart data={monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke={theme.colors.border} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => useDollars ? `$${(v/1000).toFixed(0)}K` : v.toLocaleString()} />
                <Tooltip formatter={v => formatValue(v, useDollars)} />
                <Legend />
                <Line type="monotone" dataKey="prevVelocity" name={yearA} stroke={theme.colors.chartColors[1]} strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="curVelocity" name={yearB} stroke={theme.colors.primary} strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
