import React, { useMemo } from 'react';
import { theme } from '../styles/theme';
import { formatValue, periodToMonthName } from '../utils/timePeriodUtils';
import { TrendingUp, TrendingDown } from 'lucide-react';

function pctColor(val) {
  if (val == null) return theme.colors.textLight;
  return val >= 0 ? '#2e7d32' : '#c62828';
}
function fmtPct(val) {
  if (val == null) return '—';
  return `${val >= 0 ? '+' : ''}${val.toFixed(1)}%`;
}

export default function TopBottomMovers({
  posData, currentData, comparisonData, periodLabel, timePeriod, primaryMetric,
  selectedPeriodKey, priorSequentialData, fullPriorYearProductData,
  monthsWithData, comparableMonths,
}) {
  const useDollars = primaryMetric === 'dollars';

  /* ── Column header labels ───────────────────────────────────────── */
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
  } else if (timePeriod === 'ytd') {
    curColLabel = `${currentYear} YTD`;
    yagoColLabel = `${priorYear} YTD`;
  }
  const pyLabel = `PY ${shortPrior}`;
  const yepLabel = `YEP ${shortCur}`;
  const seqPctLabel = timePeriod === 'weekly' ? 'WoW%' : timePeriod === 'monthly' ? 'MoM%' : timePeriod === 'quarterly' ? 'QoQ%' : null;

  const yepMultiplier =
    timePeriod === 'weekly' ? 52 :
    timePeriod === 'monthly' ? 12 :
    timePeriod === 'quarterly' ? (monthsWithData > 0 ? 12 / monthsWithData : 4) :
    timePeriod === 'ytd' ? (comparableMonths > 0 ? 12 / comparableMonths : 1) : 1;

  const hasSeq = priorSequentialData && Object.keys(priorSequentialData).length > 0;
  const hasPY = fullPriorYearProductData && Object.keys(fullPriorYearProductData).length > 0;

  const { gainers, decliners } = useMemo(() => {
    if (!currentData || !comparisonData || Object.keys(comparisonData).length === 0) {
      return { gainers: [], decliners: [] };
    }

    const productMap = {};
    if (posData?.products) {
      posData.products.forEach(p => { productMap[p.upc] = p; });
    }

    const allUPCs = new Set([...Object.keys(currentData), ...Object.keys(comparisonData)]);
    const changes = [];
    allUPCs.forEach(upc => {
      const cur = currentData[upc] || { dollars: 0, units: 0 };
      const comp = comparisonData[upc] || { dollars: 0, units: 0 };
      const curVal = useDollars ? cur.dollars : cur.units;
      const compVal = useDollars ? comp.dollars : comp.units;
      if (curVal === 0 && compVal === 0) return;
      const change = curVal - compVal;
      const yoyPct = compVal > 0 ? (change / compVal) * 100 : (curVal > 0 ? 100 : 0);
      const info = productMap[upc] || {};

      // Sequential
      let seqPct = null;
      if (priorSequentialData) {
        const pm = priorSequentialData[upc];
        const priorVal = pm ? (useDollars ? (pm.dollars || 0) : (pm.units || 0)) : 0;
        if (priorVal > 0) seqPct = ((curVal - priorVal) / priorVal) * 100;
      }

      // PY & YEP & Pace
      let pyVal = null, yepVal = curVal * yepMultiplier, pacePct = null;
      if (fullPriorYearProductData) {
        const pm = fullPriorYearProductData[upc];
        if (pm) {
          pyVal = useDollars ? (pm.dollars || 0) : (pm.units || 0);
          if (pyVal > 0) pacePct = ((yepVal - pyVal) / pyVal) * 100;
        }
      }

      changes.push({
        upc, name: info.product_name || upc, brand: info.brand || '',
        curVal, compVal, change, yoyPct, seqPct, pyVal, yepVal, pacePct,
      });
    });

    const sortedGain = [...changes].sort((a, b) => b.change - a.change).filter(c => c.change > 0).slice(0, 10);
    const sortedDecline = [...changes].sort((a, b) => a.change - b.change).filter(c => c.change < 0).slice(0, 10);
    return { gainers: sortedGain, decliners: sortedDecline };
  }, [posData, currentData, comparisonData, priorSequentialData, fullPriorYearProductData, useDollars, yepMultiplier]);

  if (gainers.length === 0 && decliners.length === 0) {
    return (
      <div style={{ padding: theme.spacing.xl, textAlign: 'center', color: theme.colors.textLight }}>
        Need year-ago comparison data for Top/Bottom Movers analysis.
      </div>
    );
  }

  const tableStyle = {
    width: '100%', borderCollapse: 'collapse', fontFamily: theme.fonts.body, fontSize: '0.82rem',
  };
  const thStyle = {
    textAlign: 'left', padding: `${theme.spacing.sm} ${theme.spacing.sm}`,
    borderBottom: `2px solid ${theme.colors.border}`, fontWeight: 600,
    color: theme.colors.secondary, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.03em',
  };
  const tdStyle = {
    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
    borderBottom: `1px solid ${theme.colors.border}`, color: theme.colors.text,
  };

  const renderTable = (items, isGainer) => (
    <div style={{ overflowX: 'auto' }}>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>#</th>
            <th style={thStyle}>Product</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>{yagoColLabel}</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>{curColLabel}</th>
            {hasPY && <th style={{ ...thStyle, textAlign: 'right' }}>{pyLabel}</th>}
            <th style={{ ...thStyle, textAlign: 'right' }}>{yepLabel}</th>
            {hasSeq && seqPctLabel && <th style={{ ...thStyle, textAlign: 'right' }}>{seqPctLabel}</th>}
            <th style={{ ...thStyle, textAlign: 'right' }}>YoY%</th>
            {hasPY && <th style={{ ...thStyle, textAlign: 'right' }}>Pace%</th>}
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={item.upc} style={{ background: i % 2 === 0 ? 'transparent' : theme.colors.backgroundAlt }}>
              <td style={tdStyle}>{i + 1}</td>
              <td style={{ ...tdStyle, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <div style={{ fontWeight: 500 }}>{item.name}</div>
                {item.brand && <div style={{ fontSize: '0.7rem', color: theme.colors.textLight }}>{item.brand}</div>}
              </td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>{formatValue(item.compVal, useDollars)}</td>
              <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{formatValue(item.curVal, useDollars)}</td>
              {hasPY && (
                <td style={{ ...tdStyle, textAlign: 'right' }}>
                  {item.pyVal != null ? formatValue(item.pyVal, useDollars) : '—'}
                </td>
              )}
              <td style={{ ...tdStyle, textAlign: 'right' }}>{formatValue(item.yepVal, useDollars)}</td>
              {hasSeq && seqPctLabel && (
                <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: pctColor(item.seqPct) }}>
                  {fmtPct(item.seqPct)}
                </td>
              )}
              <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: isGainer ? '#2e7d32' : '#c62828' }}>
                {fmtPct(item.yoyPct)}
              </td>
              {hasPY && (
                <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: pctColor(item.pacePct) }}>
                  {fmtPct(item.pacePct)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div>
      <h2 style={{ fontFamily: theme.fonts.heading, fontSize: '1.3rem', color: theme.colors.secondary, marginBottom: theme.spacing.sm }}>
        Top / Bottom Movers
      </h2>
      <p style={{ fontFamily: theme.fonts.body, fontSize: '0.82rem', color: theme.colors.textLight, marginBottom: theme.spacing.lg }}>
        YoY {useDollars ? 'dollar' : 'unit'} change for {periodLabel}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: theme.spacing.lg }}>
        <div style={{
          background: theme.colors.cardBg, borderRadius: theme.borderRadius.lg,
          boxShadow: theme.shadows.sm, padding: theme.spacing.xl, borderTop: `3px solid ${theme.colors.success}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.md }}>
            <TrendingUp size={18} style={{ color: '#2e7d32' }} />
            <h3 style={{ fontFamily: theme.fonts.heading, fontSize: '1rem', color: '#2e7d32' }}>Top 10 Gainers</h3>
          </div>
          {gainers.length > 0 ? renderTable(gainers, true) : (
            <p style={{ color: theme.colors.textLight, fontFamily: theme.fonts.body, fontSize: '0.82rem' }}>
              No products gained in this period.
            </p>
          )}
        </div>

        <div style={{
          background: theme.colors.cardBg, borderRadius: theme.borderRadius.lg,
          boxShadow: theme.shadows.sm, padding: theme.spacing.xl, borderTop: `3px solid ${theme.colors.danger}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.md }}>
            <TrendingDown size={18} style={{ color: '#c62828' }} />
            <h3 style={{ fontFamily: theme.fonts.heading, fontSize: '1rem', color: '#c62828' }}>Top 10 Decliners</h3>
          </div>
          {decliners.length > 0 ? renderTable(decliners, false) : (
            <p style={{ color: theme.colors.textLight, fontFamily: theme.fonts.body, fontSize: '0.82rem' }}>
              No products declined in this period.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
