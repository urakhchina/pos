import React, { useMemo, useState } from 'react';
import { theme } from '../styles/theme';
import { formatValue, periodToMonthName } from '../utils/timePeriodUtils';
import { TrendingUp, TrendingDown, ChevronUp, ChevronDown } from 'lucide-react';

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

  const [gainerSort, setGainerSort] = useState({ field: 'unitChange', dir: 'desc' });
  const [declinerSort, setDeclinerSort] = useState({ field: 'unitChange', dir: 'asc' });

  function sortItems(items, field, dir) {
    return [...items].sort((a, b) => {
      let aVal = a[field], bVal = b[field];
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = (bVal || '').toLowerCase();
        return dir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return dir === 'asc' ? (aVal || 0) - (bVal || 0) : (bVal || 0) - (aVal || 0);
    });
  }

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
    if (!currentData) {
      return { gainers: [], decliners: [] };
    }

    // Use comparisonData prop if available; otherwise fall back to _yago fields
    // embedded in currentData (e.g. dollars_yago, units_yago)
    const hasCompProp = comparisonData && Object.keys(comparisonData).length > 0;

    const productMap = {};
    if (posData?.products) {
      posData.products.forEach(p => { productMap[p.upc] = p; });
    }

    const allUPCs = hasCompProp
      ? new Set([...Object.keys(currentData), ...Object.keys(comparisonData)])
      : new Set(Object.keys(currentData));
    const changes = [];
    allUPCs.forEach(upc => {
      const cur = currentData[upc] || { dollars: 0, units: 0 };
      let compVal, compUnits;
      if (hasCompProp) {
        const comp = comparisonData[upc] || { dollars: 0, units: 0 };
        compVal = useDollars ? comp.dollars : comp.units;
        compUnits = comp.units || 0;
      } else {
        // Fall back to _yago fields embedded in the current period data
        compVal = useDollars ? (cur.dollars_yago || 0) : (cur.units_yago || 0);
        compUnits = cur.units_yago || 0;
      }
      const curVal = useDollars ? cur.dollars : cur.units;
      const curUnits = cur.units || 0;
      if (curVal === 0 && compVal === 0) return;
      const change = curVal - compVal;
      const unitChange = curUnits - compUnits;
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
        curVal, compVal, change, unitChange, curUnits, compUnits,
        yoyPct, seqPct, pyVal, yepVal, pacePct,
      });
    });

    // Sort by unit change (absolute unit movement defines top/bottom movers)
    const sortedGain = [...changes].sort((a, b) => b.unitChange - a.unitChange).filter(c => c.unitChange > 0).slice(0, 10);
    const sortedDecline = [...changes].sort((a, b) => a.unitChange - b.unitChange).filter(c => c.unitChange < 0).slice(0, 10);
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
    cursor: 'pointer', userSelect: 'none',
  };
  const tdStyle = {
    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
    borderBottom: `1px solid ${theme.colors.border}`, color: theme.colors.text,
  };

  const renderTable = (items, isGainer, sortState, setSortState) => {
    const handleSort = (field) => {
      setSortState(prev =>
        prev.field === field
          ? { field, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
          : { field, dir: 'desc' }
      );
    };

    const SortIcon = ({ field }) => {
      if (sortState.field !== field) return null;
      return sortState.dir === 'asc'
        ? <ChevronUp size={14} style={{ verticalAlign: 'middle', marginLeft: 2 }} />
        : <ChevronDown size={14} style={{ verticalAlign: 'middle', marginLeft: 2 }} />;
    };

    const sortedItems = sortItems(items, sortState.field, sortState.dir);

    return (
      <div style={{ overflowX: 'auto' }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={{ ...thStyle, cursor: 'default' }}>#</th>
              <th style={thStyle} onClick={() => handleSort('name')}>Product<SortIcon field="name" /></th>
              <th style={{ ...thStyle, textAlign: 'right' }} onClick={() => handleSort('unitChange')}>Unit Chg<SortIcon field="unitChange" /></th>
              <th style={{ ...thStyle, textAlign: 'right' }} onClick={() => handleSort('compVal')}>{yagoColLabel}<SortIcon field="compVal" /></th>
              <th style={{ ...thStyle, textAlign: 'right' }} onClick={() => handleSort('curVal')}>{curColLabel}<SortIcon field="curVal" /></th>
              {hasPY && <th style={{ ...thStyle, textAlign: 'right' }} onClick={() => handleSort('pyVal')}>{pyLabel}<SortIcon field="pyVal" /></th>}
              <th style={{ ...thStyle, textAlign: 'right' }} onClick={() => handleSort('yepVal')}>{yepLabel}<SortIcon field="yepVal" /></th>
              {hasSeq && seqPctLabel && <th style={{ ...thStyle, textAlign: 'right' }} onClick={() => handleSort('seqPct')}>{seqPctLabel}<SortIcon field="seqPct" /></th>}
              <th style={{ ...thStyle, textAlign: 'right' }} onClick={() => handleSort('yoyPct')}>YoY%<SortIcon field="yoyPct" /></th>
              {hasPY && <th style={{ ...thStyle, textAlign: 'right' }} onClick={() => handleSort('pacePct')}>Pace%<SortIcon field="pacePct" /></th>}
            </tr>
          </thead>
          <tbody>
            {sortedItems.map((item, i) => (
              <tr key={item.upc} style={{ background: i % 2 === 0 ? 'transparent' : theme.colors.backgroundAlt }}>
                <td style={tdStyle}>{i + 1}</td>
                <td style={{ ...tdStyle, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <div style={{ fontWeight: 500 }}>{item.name}</div>
                  {item.brand && <div style={{ fontSize: '0.7rem', color: theme.colors.textLight }}>{item.brand}</div>}
                </td>
                <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: isGainer ? '#2e7d32' : '#c62828' }}>
                  {item.unitChange >= 0 ? '+' : ''}{item.unitChange.toLocaleString()}
                </td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>{formatValue(item.compVal, useDollars)}</td>
                <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{formatValue(item.curVal, useDollars)}</td>
                {hasPY && (
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    {item.pyVal != null ? formatValue(item.pyVal, useDollars) : '---'}
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
  };

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
          {gainers.length > 0 ? renderTable(gainers, true, gainerSort, setGainerSort) : (
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
          {decliners.length > 0 ? renderTable(decliners, false, declinerSort, setDeclinerSort) : (
            <p style={{ color: theme.colors.textLight, fontFamily: theme.fonts.body, fontSize: '0.82rem' }}>
              No products declined in this period.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
