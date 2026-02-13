import React, { useMemo, useState } from 'react';
import { theme } from '../styles/theme';
import { useResponsive } from '../hooks/useResponsive';
import {
  sumPeriod, formatValue, MONTH_NAMES, periodToMonthName,
} from '../utils/timePeriodUtils';
import {
  ResponsiveContainer, ComposedChart, LineChart, Line, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { DollarSign, ShoppingCart, Activity, BarChart3 } from 'lucide-react';

/* ── ChangeBadge (matches ExecutiveSummary) ──────────────────────── */
function ChangeBadge({ value, label }) {
  if (value == null || isNaN(value)) return null;
  const isPositive = value >= 0;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '2px',
      padding: '2px 8px', borderRadius: '12px', fontSize: '0.7rem',
      fontWeight: 600, fontFamily: theme.fonts.body, whiteSpace: 'nowrap',
      background: isPositive ? '#e8f5e9' : '#fce4ec',
      color: isPositive ? '#2e7d32' : '#c62828',
    }}>
      {isPositive ? '+' : ''}{value.toFixed(1)}%{label ? ` ${label}` : ''}
    </span>
  );
}

/* ── Helper: period label for sequential comparison ──────────────── */
function seqLabel(timePeriod) {
  if (timePeriod === 'weekly') return 'vs prior wk';
  if (timePeriod === 'monthly') return 'vs prior mo';
  if (timePeriod === 'quarterly') return 'vs prior qtr';
  return '';
}

/* ── Pct cell color helper ───────────────────────────────────────── */
function pctColor(val, isNew) {
  if (isNew) return theme.colors.chartColors[1];
  if (val == null) return theme.colors.textLight;
  return val >= 0 ? '#2e7d32' : '#c62828';
}
function fmtPct(val, isNew) {
  if (isNew) return 'New';
  if (val == null) return '—';
  return `${val >= 0 ? '+' : ''}${val.toFixed(1)}%`;
}

export default function SalesOverview({
  posData, currentData, comparisonData, trendData, periodLabel, timePeriod,
  primaryMetric, selectedPeriodKey, priorSequentialData,
  fullPriorYearProductData, monthsWithData, comparableMonths,
}) {
  const useDollars = primaryMetric === 'dollars';
  const { isMobile } = useResponsive();

  /* ── Derive year & column header labels ─────────────────────────── */
  const currentYear = selectedPeriodKey
    ? selectedPeriodKey.slice(0, 4)
    : (posData?.periods ? [...new Set(Object.keys(posData.periods).map(k => k.slice(0, 4)))].sort().pop() : null);
  const priorYear = currentYear ? String(Number(currentYear) - 1) : null;
  const shortCur = currentYear ? currentYear.slice(2) : '';
  const shortPrior = priorYear ? priorYear.slice(2) : '';

  let curColLabel = 'Current', yagoColLabel = 'Year Ago';
  if (timePeriod === 'monthly' && selectedPeriodKey) {
    const mon = periodToMonthName(selectedPeriodKey);
    curColLabel = `${mon} ${shortCur}`;
    yagoColLabel = `${mon} ${shortPrior}`;
  } else if (timePeriod === 'quarterly' && selectedPeriodKey) {
    const q = selectedPeriodKey.slice(5);
    curColLabel = `${q} ${shortCur}`;
    yagoColLabel = `${q} ${shortPrior}`;
  } else if (timePeriod === 'weekly') {
    curColLabel = 'Current Wk';
    yagoColLabel = 'Year-Ago Wk';
  }
  const pyLabel = `PY ${shortPrior}`;
  const yepLabel = `YEP ${shortCur}`;
  const seqPctLabel = timePeriod === 'weekly' ? 'WoW%' : timePeriod === 'monthly' ? 'MoM%' : timePeriod === 'quarterly' ? 'QoQ%' : null;

  /* ── YEP multiplier ─────────────────────────────────────────────── */
  const yepMultiplier =
    timePeriod === 'weekly' ? 52 :
    timePeriod === 'monthly' ? 12 :
    timePeriod === 'quarterly' ? (monthsWithData > 0 ? 12 / monthsWithData : 4) :
    timePeriod === 'ytd' ? (comparableMonths > 0 ? 12 / comparableMonths : 1) : 1;

  /* ── Chart data (unchanged logic) ───────────────────────────────── */
  const { chartData, ytdChartData, summaryStats } = useMemo(() => {
    if (!trendData || trendData.length === 0) return { chartData: [], ytdChartData: [], summaryStats: null };

    const years = [...new Set(trendData.map(d => d.year))].sort();
    if (timePeriod === 'ytd' && years.length === 2) {
      const byMonth = {};
      trendData.forEach(d => {
        const monthName = MONTH_NAMES[parseInt(d.month, 10) - 1];
        if (!byMonth[d.month]) byMonth[d.month] = { month: monthName, mm: d.month };
        const prefix = d.year === years[0] ? 'prev' : 'cur';
        byMonth[d.month][`${prefix}Val`] = useDollars ? d.dollars : d.units;
      });
      const ytd = Object.values(byMonth).sort((a, b) => a.mm.localeCompare(b.mm));

      const current = sumPeriod(currentData);
      return {
        chartData: [],
        ytdChartData: ytd,
        summaryStats: {
          totalVal: useDollars ? current.dollars : current.units,
          totalUnits: current.units,
          productCount: current.productCount,
          periods: trendData.filter(d => d.year === years[1]).length,
          yearA: years[0],
          yearB: years[1],
        },
      };
    }

    const chart = trendData.map(d => ({
      period: d.label,
      dollars: d.dollars,
      units: d.units,
    }));

    const current = sumPeriod(currentData);
    return {
      chartData: chart,
      ytdChartData: [],
      summaryStats: {
        totalVal: useDollars ? current.dollars : current.units,
        totalUnits: current.units,
        productCount: current.productCount,
        periods: trendData.length,
      },
    };
  }, [trendData, currentData, timePeriod, primaryMetric, useDollars]);

  /* ── Velocity KPI computations ──────────────────────────────────── */
  const velocityKpis = useMemo(() => {
    if (!summaryStats || !currentData) return null;

    const current = sumPeriod(currentData);
    const curVal = useDollars ? current.dollars : current.units;
    const productCount = current.productCount || 1;

    const unitsVelocity = current.units / productCount;
    const dollarsVelocity = useDollars ? current.dollars / productCount : null;

    let yoyPct = null;
    let compUnitsVelocity = 0;
    if (comparisonData && Object.keys(comparisonData).length > 0) {
      const comp = sumPeriod(comparisonData);
      const compVal = useDollars ? comp.dollars : comp.units;
      if (compVal > 0) yoyPct = ((curVal - compVal) / compVal) * 100;
      compUnitsVelocity = comp.units / (comp.productCount || 1);
    }

    let seqPct = null;
    let seqVelocityPct = null;
    if (priorSequentialData && Object.keys(priorSequentialData).length > 0) {
      const prior = sumPeriod(priorSequentialData);
      const priorVal = useDollars ? prior.dollars : prior.units;
      if (priorVal > 0) seqPct = ((curVal - priorVal) / priorVal) * 100;
      const priorUnitsVelocity = prior.units / (prior.productCount || 1);
      if (priorUnitsVelocity > 0) seqVelocityPct = ((unitsVelocity - priorUnitsVelocity) / priorUnitsVelocity) * 100;
    }

    let yoyVelocityPct = null;
    if (compUnitsVelocity > 0) {
      yoyVelocityPct = ((unitsVelocity - compUnitsVelocity) / compUnitsVelocity) * 100;
    }

    return {
      curVal, totalUnits: current.units, productCount,
      unitsVelocity, dollarsVelocity, periods: summaryStats.periods,
      yoyPct, seqPct, yoyVelocityPct, seqVelocityPct,
    };
  }, [summaryStats, currentData, comparisonData, priorSequentialData, useDollars]);

  /* ── Leading Products table data ────────────────────────────────── */
  const leadingProducts = useMemo(() => {
    if (!currentData || timePeriod === 'ytd') return null;

    const productMap = {};
    if (posData?.products) {
      posData.products.forEach(p => { productMap[p.upc] = p; });
    }

    const hasComp = comparisonData && Object.keys(comparisonData).length > 0;
    const hasPY = fullPriorYearProductData && Object.keys(fullPriorYearProductData).length > 0;

    const products = Object.entries(currentData).map(([upc, metrics]) => {
      const curVal = useDollars ? (metrics.dollars || 0) : (metrics.units || 0);
      const info = productMap[upc] || {};

      // Prior sequential
      let priorVal = null, seqPct = null;
      if (priorSequentialData) {
        const pm = priorSequentialData[upc];
        if (pm) {
          priorVal = useDollars ? (pm.dollars || 0) : (pm.units || 0);
          seqPct = priorVal > 0 ? ((curVal - priorVal) / priorVal) * 100 : null;
        }
      }

      // YoY
      let yagoVal = null, yoyPct = null;
      if (hasComp) {
        const ym = comparisonData[upc];
        if (ym) {
          yagoVal = useDollars ? (ym.dollars || 0) : (ym.units || 0);
          yoyPct = yagoVal > 0 ? ((curVal - yagoVal) / yagoVal) * 100 : null;
        }
      }

      // PY (full prior year)
      let pyVal = null;
      if (hasPY) {
        const pm = fullPriorYearProductData[upc];
        if (pm) pyVal = useDollars ? (pm.dollars || 0) : (pm.units || 0);
      }

      // YEP
      const yepVal = curVal * yepMultiplier;

      // Pace%
      const pacePct = pyVal > 0 ? ((yepVal - pyVal) / pyVal) * 100 : null;

      return {
        upc, curVal, priorVal, seqPct, yagoVal, yoyPct, pyVal, yepVal, pacePct,
        name: info.product_name || upc,
        brand: info.brand || '',
        isNewSeq: priorSequentialData && !priorSequentialData[upc] && curVal > 0,
        isNewYoY: hasComp && !comparisonData[upc] && curVal > 0,
      };
    });

    return products.sort((a, b) => b.curVal - a.curVal).slice(0, 15);
  }, [currentData, comparisonData, priorSequentialData, fullPriorYearProductData, posData, timePeriod, useDollars, yepMultiplier]);

  /* ── Product sort state ────────────────────────────────────────── */
  const [prodSort, setProdSort] = useState({ field: 'curVal', dir: 'desc' });

  const handleProdSort = (field) => {
    setProdSort(prev =>
      prev.field === field
        ? { field, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { field, dir: 'desc' }
    );
  };

  function sortItems(items, field, dir) {
    return [...items].sort((a, b) => {
      let aVal = a[field], bVal = b[field];
      if (typeof aVal === 'string') { aVal = aVal.toLowerCase(); bVal = (bVal || '').toLowerCase(); return dir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal); }
      return dir === 'asc' ? (aVal || 0) - (bVal || 0) : (bVal || 0) - (aVal || 0);
    });
  }

  const sortedProducts = leadingProducts ? sortItems(leadingProducts, prodSort.field, prodSort.dir) : null;

  const prodSortIndicator = (field) => prodSort.field === field ? (prodSort.dir === 'asc' ? ' \u25B2' : ' \u25BC') : '';

  /* ── Early return ───────────────────────────────────────────────── */
  if (!summaryStats) {
    return (
      <div style={{ padding: theme.spacing.xl, textAlign: 'center', color: theme.colors.textLight }}>
        No sales data available.
      </div>
    );
  }

  const fmtAxis = v => useDollars
    ? (v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `$${(v / 1e3).toFixed(0)}K` : `$${v}`)
    : v.toLocaleString();

  const hasSeq = priorSequentialData && Object.keys(priorSequentialData).length > 0;
  const hasYoY = comparisonData && Object.keys(comparisonData).length > 0;
  const hasPY = fullPriorYearProductData && Object.keys(fullPriorYearProductData).length > 0;

  /* ── KPI cards ──────────────────────────────────────────────────── */
  const kpiCards = velocityKpis ? [
    {
      title: useDollars ? 'Total Revenue' : 'Total Units',
      value: formatValue(velocityKpis.curVal, useDollars),
      icon: useDollars ? DollarSign : ShoppingCart,
      color: theme.colors.primary,
      seqPct: velocityKpis.seqPct,
      yoyPct: velocityKpis.yoyPct,
    },
    {
      title: 'Avg Velocity / SKU',
      value: formatValue(velocityKpis.unitsVelocity, false) + ' units',
      subtitle: velocityKpis.dollarsVelocity != null
        ? formatValue(velocityKpis.dollarsVelocity, true)
        : null,
      icon: Activity,
      color: theme.colors.chartColors[1],
      seqPct: velocityKpis.seqVelocityPct,
      yoyPct: velocityKpis.yoyVelocityPct,
    },
    ...(useDollars ? [{
      title: 'Total Units',
      value: formatValue(velocityKpis.totalUnits, false),
      icon: ShoppingCart,
      color: theme.colors.chartColors[3],
      seqPct: null,
      yoyPct: null,
    }] : []),
    {
      title: 'Periods in Trend',
      value: velocityKpis.periods,
      icon: BarChart3,
      color: theme.colors.secondary,
      seqPct: null,
      yoyPct: null,
    },
  ] : [];

  /* ── Table styles ───────────────────────────────────────────────── */
  const tableStyle = {
    width: '100%', borderCollapse: 'collapse', fontFamily: theme.fonts.body, fontSize: '0.82rem',
  };
  const thStyle = {
    textAlign: 'left', padding: `${theme.spacing.sm} ${theme.spacing.sm}`,
    borderBottom: `2px solid ${theme.colors.border}`, fontWeight: 600,
    color: theme.colors.secondary, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.03em',
    cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap',
  };
  const tdStyle = {
    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
    borderBottom: `1px solid ${theme.colors.border}`, color: theme.colors.text,
  };
  const thStyleR = isMobile ? { ...thStyle, padding: '6px 8px', fontSize: '0.65rem' } : thStyle;
  const tdStyleR = isMobile ? { ...tdStyle, padding: '4px 8px' } : tdStyle;

  return (
    <div>
      <h2 style={{ fontFamily: theme.fonts.heading, fontSize: isMobile ? '1.1rem' : '1.3rem', color: theme.colors.secondary, marginBottom: theme.spacing.lg }}>
        Sales Overview
      </h2>

      {/* ── Velocity KPI Cards ─────────────────────────────────────── */}
      {kpiCards.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? 'repeat(auto-fit, minmax(150px, 1fr))' : 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: theme.spacing.lg, marginBottom: theme.spacing.lg,
        }}>
          {kpiCards.map((card, i) => {
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
                {card.subtitle && (
                  <div style={{
                    fontFamily: theme.fonts.body, fontSize: '0.82rem',
                    color: theme.colors.textLight, marginTop: '-4px',
                  }}>
                    {card.subtitle}
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  {card.seqPct != null && <ChangeBadge value={card.seqPct} label={seqLabel(timePeriod)} />}
                  {card.yoyPct != null && <ChangeBadge value={card.yoyPct} label="YoY" />}
                  {card.seqPct == null && card.yoyPct == null && (
                    <span style={{ fontFamily: theme.fonts.body, fontSize: '0.72rem', color: theme.colors.textLight }}>
                      {periodLabel}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Leading Products Table ─────────────────────────────────── */}
      {sortedProducts && sortedProducts.length > 0 && (
        <div style={{
          background: theme.colors.cardBg, borderRadius: theme.borderRadius.lg,
          boxShadow: theme.shadows.sm, padding: theme.spacing.xl, marginBottom: theme.spacing.lg,
          borderTop: `3px solid ${theme.colors.primary}`,
        }}>
          <h3 style={{
            fontFamily: theme.fonts.heading, fontSize: '1rem', color: theme.colors.secondary,
            marginBottom: theme.spacing.md,
          }}>
            Leading Products by Velocity
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={{ ...thStyleR, cursor: 'default' }}>#</th>
                  <th style={thStyleR} onClick={() => handleProdSort('name')}>Product{prodSortIndicator('name')}</th>
                  {hasYoY && <th style={{ ...thStyleR, textAlign: 'right' }} onClick={() => handleProdSort('yagoVal')}>{yagoColLabel}{prodSortIndicator('yagoVal')}</th>}
                  <th style={{ ...thStyleR, textAlign: 'right' }} onClick={() => handleProdSort('curVal')}>{curColLabel}{prodSortIndicator('curVal')}</th>
                  {!isMobile && hasPY && <th style={{ ...thStyleR, textAlign: 'right' }} onClick={() => handleProdSort('pyVal')}>{pyLabel}{prodSortIndicator('pyVal')}</th>}
                  {!isMobile && <th style={{ ...thStyleR, textAlign: 'right' }} onClick={() => handleProdSort('yepVal')}>{yepLabel}{prodSortIndicator('yepVal')}</th>}
                  {hasSeq && seqPctLabel && <th style={{ ...thStyleR, textAlign: 'right' }} onClick={() => handleProdSort('seqPct')}>{seqPctLabel}{prodSortIndicator('seqPct')}</th>}
                  {hasYoY && <th style={{ ...thStyleR, textAlign: 'right' }} onClick={() => handleProdSort('yoyPct')}>YoY%{prodSortIndicator('yoyPct')}</th>}
                  {!isMobile && hasPY && <th style={{ ...thStyleR, textAlign: 'right' }} onClick={() => handleProdSort('pacePct')}>Pace%{prodSortIndicator('pacePct')}</th>}
                </tr>
              </thead>
              <tbody>
                {sortedProducts.map((item, i) => (
                  <tr key={item.upc} style={{ background: i % 2 === 0 ? 'transparent' : theme.colors.backgroundAlt }}>
                    <td style={tdStyleR}>{i + 1}</td>
                    <td style={{ ...tdStyleR, maxWidth: isMobile ? 160 : 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <div style={{ fontWeight: 500 }}>{item.name}</div>
                      {item.brand && <div style={{ fontSize: '0.7rem', color: theme.colors.textLight }}>{item.brand}</div>}
                    </td>
                    {hasYoY && (
                      <td style={{ ...tdStyleR, textAlign: 'right' }}>
                        {item.yagoVal != null ? formatValue(item.yagoVal, useDollars) : '—'}
                      </td>
                    )}
                    <td style={{ ...tdStyleR, textAlign: 'right', fontWeight: 600 }}>
                      {formatValue(item.curVal, useDollars)}
                    </td>
                    {!isMobile && hasPY && (
                      <td style={{ ...tdStyleR, textAlign: 'right' }}>
                        {item.pyVal != null ? formatValue(item.pyVal, useDollars) : '—'}
                      </td>
                    )}
                    {!isMobile && (
                      <td style={{ ...tdStyleR, textAlign: 'right' }}>
                        {formatValue(item.yepVal, useDollars)}
                      </td>
                    )}
                    {hasSeq && seqPctLabel && (
                      <td style={{ ...tdStyleR, textAlign: 'right', fontWeight: 600, color: pctColor(item.seqPct, item.isNewSeq) }}>
                        {fmtPct(item.seqPct, item.isNewSeq)}
                      </td>
                    )}
                    {hasYoY && (
                      <td style={{ ...tdStyleR, textAlign: 'right', fontWeight: 600, color: pctColor(item.yoyPct, item.isNewYoY) }}>
                        {fmtPct(item.yoyPct, item.isNewYoY)}
                      </td>
                    )}
                    {!isMobile && hasPY && (
                      <td style={{ ...tdStyleR, textAlign: 'right', fontWeight: 600, color: pctColor(item.pacePct, false) }}>
                        {fmtPct(item.pacePct, false)}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── YTD: Year-over-year overlay chart (unchanged) ──────────── */}
      {timePeriod === 'ytd' && ytdChartData.length > 0 && (
        <div style={{
          background: theme.colors.cardBg, borderRadius: theme.borderRadius.lg,
          boxShadow: theme.shadows.sm, padding: theme.spacing.xl,
        }}>
          <h3 style={{ fontFamily: theme.fonts.heading, fontSize: '1rem', color: theme.colors.secondary, marginBottom: theme.spacing.md }}>
            {useDollars ? 'Revenue' : 'Units'} by Month — {summaryStats.yearA} vs {summaryStats.yearB}
          </h3>
          <ResponsiveContainer width="100%" height={isMobile ? 250 : 380}>
            <LineChart data={ytdChartData} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme.colors.border} />
              <XAxis dataKey="month" tick={{ fontFamily: theme.fonts.body, fontSize: 11, fill: theme.colors.textLight }} tickLine={false} />
              <YAxis tickFormatter={fmtAxis} tick={{ fontFamily: theme.fonts.body, fontSize: 11, fill: theme.colors.textLight }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ fontFamily: theme.fonts.body, fontSize: '0.82rem', borderRadius: theme.borderRadius.md }}
                formatter={v => formatValue(v, useDollars)} />
              <Legend wrapperStyle={{ fontFamily: theme.fonts.body, fontSize: '0.8rem' }} />
              <Line type="monotone" dataKey="prevVal" name={summaryStats.yearA} stroke={theme.colors.chartColors[1]} strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="curVal" name={summaryStats.yearB} stroke={theme.colors.primary} strokeWidth={3} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Standard: timeline chart (unchanged) ──────────────────── */}
      {chartData.length > 0 && (
        <div style={{
          background: theme.colors.cardBg, borderRadius: theme.borderRadius.lg,
          boxShadow: theme.shadows.sm, padding: theme.spacing.xl,
        }}>
          <ResponsiveContainer width="100%" height={isMobile ? 280 : 400}>
            <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme.colors.border} />
              <XAxis dataKey="period" tick={{ fontFamily: theme.fonts.body, fontSize: 11, fill: theme.colors.textLight }} tickLine={false} />
              {useDollars && (
                <YAxis yAxisId="dollars" tickFormatter={fmtAxis}
                  tick={{ fontFamily: theme.fonts.body, fontSize: 11, fill: theme.colors.textLight }} tickLine={false} axisLine={false} />
              )}
              <YAxis yAxisId="units" orientation={useDollars ? 'right' : 'left'}
                tick={{ fontFamily: theme.fonts.body, fontSize: 11, fill: theme.colors.textLight }}
                tickLine={false} axisLine={false} tickFormatter={v => v.toLocaleString()} />
              <Tooltip contentStyle={{ fontFamily: theme.fonts.body, fontSize: '0.82rem', borderRadius: theme.borderRadius.md, border: `1px solid ${theme.colors.border}` }}
                formatter={(value, name) => name === 'Revenue' ? [`$${value.toLocaleString()}`, name] : [value.toLocaleString(), name]} />
              <Legend wrapperStyle={{ fontFamily: theme.fonts.body, fontSize: '0.8rem' }} />
              <Bar yAxisId="units" dataKey="units" name="Units" fill={`${theme.colors.chartColors[1]}60`} radius={[3, 3, 0, 0]} />
              {useDollars && (
                <Line yAxisId="dollars" type="monotone" dataKey="dollars" name="Revenue"
                  stroke={theme.colors.primary} strokeWidth={3} dot={{ r: 4, fill: theme.colors.primary }} activeDot={{ r: 6 }} />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
