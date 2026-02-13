import React, { useState, useMemo } from 'react';
import {
  ComposedChart, BarChart, Bar, Cell, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, ChevronUp, ChevronDown } from 'lucide-react';
import { theme } from '../styles/theme';
import { formatValue, sumPeriod, periodToMonthName, MONTH_NAMES } from '../utils/timePeriodUtils';

const thStyle = {
  padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#555',
  borderBottom: '2px solid #e0e0e0', fontSize: '12px',
  textTransform: 'uppercase', letterSpacing: '0.5px',
  cursor: 'pointer', userSelect: 'none',
};
const tdStyle = { padding: '10px 16px', color: '#333' };

function pctColor(val) {
  if (val == null) return theme.colors.textLight;
  return val >= 0 ? '#2e7d32' : '#c62828';
}
function fmtPct(val) {
  if (val == null) return '—';
  return `${val >= 0 ? '+' : ''}${val.toFixed(1)}%`;
}

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

function toggleSort(sortState, setSortState, field) {
  setSortState(prev =>
    prev.field === field
      ? { field, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { field, dir: 'desc' }
  );
}

const SortIndicator = ({ field, sortState }) => {
  if (sortState.field !== field) return null;
  return sortState.dir === 'asc'
    ? <ChevronUp size={12} style={{ marginLeft: '2px', verticalAlign: 'middle' }} />
    : <ChevronDown size={12} style={{ marginLeft: '2px', verticalAlign: 'middle' }} />;
};

const SummaryCard = ({ label, value, color, subtext, icon }) => (
  <div style={{
    backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e0e0e0',
    padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px',
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: '13px', color: '#666', fontWeight: 500 }}>{label}</span>
      {icon}
    </div>
    <span style={{ fontSize: '28px', fontWeight: 700, color }}>{value}</span>
    {subtext && <span style={{ fontSize: '12px', color: '#999' }}>{subtext}</span>}
  </div>
);

const YoYPerformance = ({
  posData, currentData, comparisonData, trendData, periodLabel, timePeriod,
  primaryMetric, fullPrevYearData, comparableMonths,
  selectedPeriodKey, priorSequentialData, fullPriorYearProductData, monthsWithData,
}) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [growthSort, setGrowthSort] = useState({ field: 'changePercent', dir: 'desc' });
  const [declineSort, setDeclineSort] = useState({ field: 'changePercent', dir: 'asc' });
  const [catGrowSort, setCatGrowSort] = useState({ field: 'changePct', dir: 'desc' });
  const [catDecSort, setCatDecSort] = useState({ field: 'changePct', dir: 'asc' });

  const useDollars = primaryMetric === 'dollars';
  const metricKey = useDollars ? 'dollars' : 'units';
  const metricLabel = useDollars ? 'Dollars' : 'Units';

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

  const productMap = useMemo(() => {
    const map = {};
    if (posData?.products) {
      posData.products.forEach(p => { map[p.upc] = p; });
    }
    return map;
  }, [posData]);

  const productYoY = useMemo(() => {
    if (!currentData) return [];

    const allUPCs = new Set([
      ...Object.keys(currentData || {}),
      ...Object.keys(comparisonData || {}),
    ]);

    const products = [];
    allUPCs.forEach(upc => {
      const product = productMap[upc];
      const name = product?.product_name || upc;
      const brand = product?.brand || '';
      const category = product?.category || 'Unknown';

      const currentVal = currentData?.[upc]?.[metricKey] || 0;
      const compVal = comparisonData?.[upc]?.[metricKey] || 0;
      if (currentVal === 0 && compVal === 0) return;

      const change = currentVal - compVal;
      const changePercent = compVal !== 0
        ? ((currentVal - compVal) / compVal) * 100
        : currentVal > 0 ? 100 : 0;

      // Sequential
      let seqPct = null;
      if (priorSequentialData) {
        const pm = priorSequentialData[upc];
        const priorVal = pm ? (pm[metricKey] || 0) : 0;
        if (priorVal > 0) seqPct = ((currentVal - priorVal) / priorVal) * 100;
      }

      // PY & YEP & Pace
      let pyVal = null, yepVal = currentVal * yepMultiplier, pacePct = null;
      if (fullPriorYearProductData) {
        const pm = fullPriorYearProductData[upc];
        if (pm) {
          pyVal = pm[metricKey] || 0;
          if (pyVal > 0) pacePct = ((yepVal - pyVal) / pyVal) * 100;
        }
      }

      products.push({
        upc, name, brand, category,
        currentVal, compVal, change, changePercent,
        seqPct, pyVal, yepVal, pacePct,
      });
    });

    return products;
  }, [currentData, comparisonData, priorSequentialData, fullPriorYearProductData, productMap, metricKey, yepMultiplier]);

  const summaryStats = useMemo(() => {
    const growing = productYoY.filter(p => p.changePercent > 0);
    const declining = productYoY.filter(p => p.changePercent < 0);
    const flat = productYoY.filter(p => p.changePercent === 0);
    const totalCurrent = productYoY.reduce((sum, p) => sum + p.currentVal, 0);
    const totalComp = productYoY.reduce((sum, p) => sum + p.compVal, 0);
    const overallChange = totalComp !== 0 ? ((totalCurrent - totalComp) / totalComp) * 100 : 0;
    return { growingCount: growing.length, decliningCount: declining.length, flatCount: flat.length, totalCurrent, totalComp, overallChange };
  }, [productYoY]);

  const { chartData, chartYearCY, chartYearPY } = useMemo(() => {
    if (!trendData || trendData.length === 0) return { chartData: [], chartYearCY: null, chartYearPY: null };
    const years = [...new Set(trendData.map(e => e.year))].filter(Boolean).sort();
    const cy = years.length > 0 ? years[years.length - 1] : null;
    const py = years.length > 1 ? years[years.length - 2] : null;
    if (!cy) return { chartData: [], chartYearCY: cy, chartYearPY: py };

    // Collect by month, track which months have actual data per year
    const monthMap = {};
    trendData.forEach(entry => {
      const mm = entry.month != null ? String(entry.month).padStart(2, '0') : null;
      if (!mm) return;
      if (!monthMap[mm]) monthMap[mm] = { ty: 0, ly: 0, hasTY: false, hasLY: false };
      const val = entry[metricKey] || 0;
      if (entry.year === cy) { monthMap[mm].ty += val; monthMap[mm].hasTY = true; }
      else if (entry.year === py) { monthMap[mm].ly += val; monthMap[mm].hasLY = true; }
    });

    // Compute YoY ratio from months with data in both years (for forecast)
    let sumTY = 0, sumLY = 0;
    Object.values(monthMap).forEach(d => {
      if (d.hasTY && d.hasLY) { sumTY += d.ty; sumLY += d.ly; }
    });
    const yoyRatio = sumLY > 0 ? sumTY / sumLY : 1;

    // Find last month with actual current-year data
    const allMonths = Object.keys(monthMap).sort();
    const lastActualMonth = allMonths.filter(mm => monthMap[mm].hasTY).pop();

    const data = allMonths.map(mm => {
      const d = monthMap[mm];
      const monthIdx = parseInt(mm, 10) - 1;
      const label = MONTH_NAMES[monthIdx] || mm;

      const result = {
        label,
        month: mm,
        ly: d.hasLY ? d.ly : null,
        ty: d.hasTY ? d.ty : null,
        tyForecast: null,
      };

      // Forecast for months after last actual current-year month
      if (!d.hasTY && d.hasLY && lastActualMonth && mm > lastActualMonth) {
        result.tyForecast = Math.round(d.ly * yoyRatio);
      }
      // Bridge point: include last actual value in forecast series to connect the lines
      if (d.hasTY && mm === lastActualMonth) {
        const hasProjectedAfter = allMonths.some(m => m > mm && !monthMap[m].hasTY && monthMap[m].hasLY);
        if (hasProjectedAfter) result.tyForecast = d.ty;
      }

      return result;
    });

    return { chartData: data, chartYearCY: cy, chartYearPY: py };
  }, [trendData, metricKey]);

  const top10Growth = useMemo(() => {
    return [...productYoY].filter(p => p.compVal > 0 || p.currentVal > 0)
      .sort((a, b) => b.changePercent - a.changePercent).slice(0, 10);
  }, [productYoY]);

  const top10Decline = useMemo(() => {
    return [...productYoY].filter(p => p.compVal > 0 || p.currentVal > 0)
      .sort((a, b) => a.changePercent - b.changePercent).slice(0, 10);
  }, [productYoY]);

  // Category-level YoY aggregation
  const categoryYoY = useMemo(() => {
    if (!currentData || !comparisonData) return [];

    const cats = {};
    const allUPCs = new Set([
      ...Object.keys(currentData || {}),
      ...Object.keys(comparisonData || {}),
    ]);

    allUPCs.forEach(upc => {
      const product = productMap[upc];
      const category = product?.category || 'Unknown';
      if (!cats[category]) cats[category] = { name: category, current: 0, comp: 0, productCount: 0 };

      const cur = currentData?.[upc]?.[metricKey] || 0;
      const comp = comparisonData?.[upc]?.[metricKey] || 0;
      cats[category].current += cur;
      cats[category].comp += comp;
      if (cur > 0) cats[category].productCount += 1;
    });

    return Object.values(cats)
      .filter(c => c.current > 0 || c.comp > 0)
      .map(c => {
        const change = c.current - c.comp;
        const changePct = c.comp > 0
          ? ((c.current - c.comp) / c.comp) * 100
          : c.current > 0 ? 100 : 0;
        return { ...c, change, changePct };
      })
      .sort((a, b) => b.changePct - a.changePct);
  }, [currentData, comparisonData, productMap, metricKey]);

  const categoryChartData = useMemo(() => {
    return categoryYoY.map(c => ({
      name: c.name.length > 22 ? c.name.substring(0, 22) + '...' : c.name,
      fullName: c.name,
      yoy: parseFloat(c.changePct.toFixed(1)),
      current: c.current,
      comp: c.comp,
      change: c.change,
      productCount: c.productCount,
    }));
  }, [categoryYoY]);

  const topGrowingCats = useMemo(() => categoryYoY.filter(c => c.changePct > 0).slice(0, 5), [categoryYoY]);
  const topDecliningCats = useMemo(() => [...categoryYoY].filter(c => c.changePct < 0).sort((a, b) => a.changePct - b.changePct).slice(0, 5), [categoryYoY]);

  const hasComparisonData = comparisonData && Object.keys(comparisonData).length > 0;

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload || payload.length === 0) return null;
    const visible = payload.filter(e => e.value != null);
    if (visible.length === 0) return null;
    return (
      <div style={{
        backgroundColor: '#fff', border: `1px solid ${theme.colors.secondary}`,
        borderRadius: '8px', padding: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      }}>
        <p style={{ margin: '0 0 8px', fontWeight: 600, color: theme.colors.secondary }}>{label}</p>
        {visible.map((entry, idx) => (
          <p key={idx} style={{ margin: '4px 0', color: entry.color, fontSize: '13px' }}>
            {entry.name}: {formatValue(entry.value, useDollars)}
          </p>
        ))}
      </div>
    );
  };

  const colCount = 3 + (hasPY ? 1 : 0) + 1 + (hasSeq && seqPctLabel ? 1 : 0) + 1 + (hasPY ? 1 : 0);

  const renderProductTable = (products, title, icon, sortState, setSortState) => {
    const sorted = sortItems(products, sortState.field, sortState.dir);
    const handleSort = (field) => toggleSort(sortState, setSortState, field);
    return (
      <div style={{
        backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e0e0e0',
        overflow: 'hidden', flex: 1,
      }}>
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid #e0e0e0',
          display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#f8f9fa',
        }}>
          {icon}
          <h3 style={{ margin: 0, fontSize: '16px', color: theme.colors.secondary }}>{title}</h3>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8f9fa' }}>
                <th style={thStyle} onClick={() => handleSort('name')}>Product<SortIndicator field="name" sortState={sortState} /></th>
                <th style={{ ...thStyle, textAlign: 'right' }} onClick={() => handleSort('compVal')}>{yagoColLabel}<SortIndicator field="compVal" sortState={sortState} /></th>
                <th style={{ ...thStyle, textAlign: 'right' }} onClick={() => handleSort('currentVal')}>{curColLabel}<SortIndicator field="currentVal" sortState={sortState} /></th>
                {hasPY && <th style={{ ...thStyle, textAlign: 'right' }} onClick={() => handleSort('pyVal')}>{pyLabel}<SortIndicator field="pyVal" sortState={sortState} /></th>}
                <th style={{ ...thStyle, textAlign: 'right' }} onClick={() => handleSort('yepVal')}>{yepLabel}<SortIndicator field="yepVal" sortState={sortState} /></th>
                {hasSeq && seqPctLabel && <th style={{ ...thStyle, textAlign: 'right' }} onClick={() => handleSort('seqPct')}>{seqPctLabel}<SortIndicator field="seqPct" sortState={sortState} /></th>}
                <th style={{ ...thStyle, textAlign: 'right' }} onClick={() => handleSort('changePercent')}>YoY%<SortIndicator field="changePercent" sortState={sortState} /></th>
                {hasPY && <th style={{ ...thStyle, textAlign: 'right' }} onClick={() => handleSort('pacePct')}>Pace%<SortIndicator field="pacePct" sortState={sortState} /></th>}
              </tr>
            </thead>
            <tbody>
              {sorted.map((p, idx) => (
                <tr key={p.upc} style={{ backgroundColor: idx % 2 === 0 ? '#fff' : '#f8f9fa', borderBottom: '1px solid #eee' }}>
                  <td style={{ ...tdStyle, maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <div style={{ fontWeight: 500 }}>{p.name}</div>
                    {p.brand && <div style={{ fontSize: '0.7rem', color: theme.colors.textLight }}>{p.brand}</div>}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{formatValue(p.compVal, useDollars)}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{formatValue(p.currentVal, useDollars)}</td>
                  {hasPY && (
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      {p.pyVal != null ? formatValue(p.pyVal, useDollars) : '—'}
                    </td>
                  )}
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{formatValue(p.yepVal, useDollars)}</td>
                  {hasSeq && seqPctLabel && (
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: pctColor(p.seqPct) }}>
                      {fmtPct(p.seqPct)}
                    </td>
                  )}
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: p.changePercent >= 0 ? theme.colors.success : theme.colors.danger }}>
                      {p.changePercent >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                      {fmtPct(p.changePercent)}
                    </span>
                  </td>
                  {hasPY && (
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: pctColor(p.pacePct) }}>
                      {fmtPct(p.pacePct)}
                    </td>
                  )}
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={colCount} style={{ ...tdStyle, textAlign: 'center', color: '#999' }}>
                    No data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  if (!hasComparisonData) {
    return (
      <div style={{
        padding: '40px', textAlign: 'center', backgroundColor: '#fff',
        borderRadius: '12px', border: '1px solid #e0e0e0',
      }}>
        <TrendingUp size={48} color={theme.colors.secondary} style={{ opacity: 0.4 }} />
        <h3 style={{ color: theme.colors.secondary, marginTop: '16px' }}>No year-ago data available</h3>
        <p style={{ color: '#666', maxWidth: '400px', margin: '8px auto 0' }}>
          Year-over-year comparison requires data from a prior period.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <SummaryCard
          label="Overall YoY Change"
          value={`${summaryStats.overallChange >= 0 ? '+' : ''}${summaryStats.overallChange.toFixed(1)}%`}
          color={summaryStats.overallChange >= 0 ? theme.colors.success : theme.colors.danger}
          subtext={`${formatValue(summaryStats.totalCurrent, useDollars)} vs ${formatValue(summaryStats.totalComp, useDollars)}`}
        />
        <SummaryCard label="Products Growing" value={summaryStats.growingCount} color={theme.colors.success}
          subtext={`of ${productYoY.length} total products`} icon={<TrendingUp size={20} color={theme.colors.success} />} />
        <SummaryCard label="Products Declining" value={summaryStats.decliningCount} color={theme.colors.danger}
          subtext={`of ${productYoY.length} total products`} icon={<TrendingDown size={20} color={theme.colors.danger} />} />
        <SummaryCard label="Flat / New" value={summaryStats.flatCount} color={theme.colors.warning} subtext="No change or new items" />
      </div>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: '4px', backgroundColor: '#f0f0f0', borderRadius: '8px', padding: '4px' }}>
        {[
          { key: 'overview', label: 'Overview Chart' },
          { key: 'categories', label: 'Categories' },
          { key: 'growth', label: 'Top Growth' },
          { key: 'decline', label: 'Top Decline' },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
            flex: 1, padding: '10px 16px', border: 'none', borderRadius: '6px',
            backgroundColor: activeTab === tab.key ? '#fff' : 'transparent',
            color: activeTab === tab.key ? theme.colors.primary : '#666',
            fontWeight: activeTab === tab.key ? 600 : 400, cursor: 'pointer', fontSize: '14px',
            boxShadow: activeTab === tab.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.2s',
          }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Chart */}
      {activeTab === 'overview' && (
        <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e0e0e0', padding: '24px' }}>
          <h3 style={{ margin: '0 0 20px', color: theme.colors.secondary, fontSize: '16px' }}>
            {metricLabel} Trend: {chartYearPY || 'Prior Year'} vs {chartYearCY || 'Current Year'}
          </h3>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <ComposedChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#666' }} axisLine={{ stroke: '#ccc' }} />
                <YAxis tick={{ fontSize: 12, fill: '#666' }} axisLine={{ stroke: '#ccc' }} tickFormatter={val => formatValue(val, useDollars)} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="ly" name={chartYearPY || 'Prior Year'} fill={theme.colors.secondary} radius={[4, 4, 0, 0]} barSize={30} opacity={0.6} />
                <Bar dataKey="ty" name={chartYearCY || 'Current Year'} fill={theme.colors.primary} radius={[4, 4, 0, 0]} barSize={30} />
                <Line dataKey="ty" name={`${chartYearCY || 'CY'} Trend`} stroke={theme.colors.primaryDark} strokeWidth={2.5} dot={{ r: 3 }} type="monotone" connectNulls={false} />
                <Line dataKey="tyForecast" name={`${chartYearCY || 'CY'} Forecast`} stroke={theme.colors.warning} strokeWidth={2} strokeDasharray="6 3" dot={{ r: 3, strokeDasharray: '' }} type="monotone" connectNulls={false} />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <p style={{ textAlign: 'center', color: '#999', padding: '40px 0' }}>
              No trend data available for the selected period.
            </p>
          )}
        </div>
      )}

      {/* Category YoY */}
      {activeTab === 'categories' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Horizontal bar chart */}
          {categoryChartData.length > 0 && (
            <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e0e0e0', padding: '24px' }}>
              <h3 style={{ margin: '0 0 20px', color: theme.colors.secondary, fontSize: '16px' }}>
                Category Year-over-Year Growth
              </h3>
              <ResponsiveContainer width="100%" height={Math.max(280, categoryChartData.length * 38)}>
                <BarChart data={categoryChartData} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={true} horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 12, fill: '#666' }} axisLine={{ stroke: '#ccc' }} tickFormatter={val => `${val}%`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: '#444' }} axisLine={{ stroke: '#ccc' }} width={180} />
                  <Tooltip content={({ active, payload }) => {
                    if (!active || !payload || payload.length === 0) return null;
                    const d = payload[0]?.payload;
                    if (!d) return null;
                    return (
                      <div style={{
                        backgroundColor: '#fff', border: `1px solid ${theme.colors.secondary}`,
                        borderRadius: '8px', padding: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', minWidth: '200px',
                      }}>
                        <p style={{ margin: '0 0 8px', fontWeight: 600, color: theme.colors.secondary, fontSize: '13px' }}>{d.fullName}</p>
                        <p style={{ margin: '3px 0', fontSize: '12px', color: '#444' }}>{yagoColLabel}: {formatValue(d.comp, useDollars)}</p>
                        <p style={{ margin: '3px 0', fontSize: '12px', color: '#444' }}>{curColLabel}: {formatValue(d.current, useDollars)}</p>
                        <p style={{ margin: '3px 0', fontSize: '12px', color: '#444' }}>Change: {formatValue(d.change, useDollars)}</p>
                        <p style={{ margin: '3px 0', fontSize: '12px', fontWeight: 600, color: d.yoy >= 0 ? theme.colors.success : theme.colors.danger }}>
                          {d.yoy >= 0 ? '+' : ''}{d.yoy}% YoY
                        </p>
                        <p style={{ margin: '3px 0', fontSize: '11px', color: '#999' }}>{d.productCount} active products</p>
                      </div>
                    );
                  }} />
                  <Bar dataKey="yoy" name="YoY %" radius={[0, 4, 4, 0]}>
                    {categoryChartData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.yoy >= 0 ? theme.colors.success : theme.colors.danger} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Top Growing / Declining side by side */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            {/* Top Growing */}
            <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e0e0e0', overflow: 'hidden' }}>
              <div style={{
                padding: '16px 20px', borderBottom: '1px solid #e0e0e0', backgroundColor: '#f8f9fa',
                display: 'flex', alignItems: 'center', gap: '8px',
              }}>
                <TrendingUp size={18} color={theme.colors.success} />
                <h3 style={{ margin: 0, fontSize: '16px', color: theme.colors.secondary }}>Top Growing Categories</h3>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8f9fa' }}>
                      <th style={thStyle} onClick={() => toggleSort(catGrowSort, setCatGrowSort, 'name')}>Category<SortIndicator field="name" sortState={catGrowSort} /></th>
                      <th style={{ ...thStyle, textAlign: 'right' }} onClick={() => toggleSort(catGrowSort, setCatGrowSort, 'comp')}>{yagoColLabel}<SortIndicator field="comp" sortState={catGrowSort} /></th>
                      <th style={{ ...thStyle, textAlign: 'right' }} onClick={() => toggleSort(catGrowSort, setCatGrowSort, 'current')}>{curColLabel}<SortIndicator field="current" sortState={catGrowSort} /></th>
                      <th style={{ ...thStyle, textAlign: 'right' }} onClick={() => toggleSort(catGrowSort, setCatGrowSort, 'change')}>Change<SortIndicator field="change" sortState={catGrowSort} /></th>
                      <th style={{ ...thStyle, textAlign: 'right' }} onClick={() => toggleSort(catGrowSort, setCatGrowSort, 'changePct')}>YoY%<SortIndicator field="changePct" sortState={catGrowSort} /></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortItems(topGrowingCats, catGrowSort.field, catGrowSort.dir).map((c, idx) => (
                      <tr key={c.name} style={{ backgroundColor: idx % 2 === 0 ? '#fff' : '#f8f9fa', borderBottom: '1px solid #eee' }}>
                        <td style={{ ...tdStyle, fontWeight: 500 }}>{c.name}</td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>{formatValue(c.comp, useDollars)}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{formatValue(c.current, useDollars)}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', color: theme.colors.success }}>{formatValue(c.change, useDollars)}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: theme.colors.success }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <ArrowUpRight size={14} />
                            {fmtPct(c.changePct)}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {topGrowingCats.length === 0 && (
                      <tr><td colSpan={5} style={{ ...tdStyle, textAlign: 'center', color: '#999' }}>No growing categories</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Top Declining */}
            <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e0e0e0', overflow: 'hidden' }}>
              <div style={{
                padding: '16px 20px', borderBottom: '1px solid #e0e0e0', backgroundColor: '#f8f9fa',
                display: 'flex', alignItems: 'center', gap: '8px',
              }}>
                <TrendingDown size={18} color={theme.colors.danger} />
                <h3 style={{ margin: 0, fontSize: '16px', color: theme.colors.secondary }}>Top Declining Categories</h3>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8f9fa' }}>
                      <th style={thStyle} onClick={() => toggleSort(catDecSort, setCatDecSort, 'name')}>Category<SortIndicator field="name" sortState={catDecSort} /></th>
                      <th style={{ ...thStyle, textAlign: 'right' }} onClick={() => toggleSort(catDecSort, setCatDecSort, 'comp')}>{yagoColLabel}<SortIndicator field="comp" sortState={catDecSort} /></th>
                      <th style={{ ...thStyle, textAlign: 'right' }} onClick={() => toggleSort(catDecSort, setCatDecSort, 'current')}>{curColLabel}<SortIndicator field="current" sortState={catDecSort} /></th>
                      <th style={{ ...thStyle, textAlign: 'right' }} onClick={() => toggleSort(catDecSort, setCatDecSort, 'change')}>Change<SortIndicator field="change" sortState={catDecSort} /></th>
                      <th style={{ ...thStyle, textAlign: 'right' }} onClick={() => toggleSort(catDecSort, setCatDecSort, 'changePct')}>YoY%<SortIndicator field="changePct" sortState={catDecSort} /></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortItems(topDecliningCats, catDecSort.field, catDecSort.dir).map((c, idx) => (
                      <tr key={c.name} style={{ backgroundColor: idx % 2 === 0 ? '#fff' : '#f8f9fa', borderBottom: '1px solid #eee' }}>
                        <td style={{ ...tdStyle, fontWeight: 500 }}>{c.name}</td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>{formatValue(c.comp, useDollars)}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{formatValue(c.current, useDollars)}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', color: theme.colors.danger }}>{formatValue(c.change, useDollars)}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: theme.colors.danger }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <ArrowDownRight size={14} />
                            {fmtPct(c.changePct)}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {topDecliningCats.length === 0 && (
                      <tr><td colSpan={5} style={{ ...tdStyle, textAlign: 'center', color: '#999' }}>No declining categories</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'growth' && renderProductTable(top10Growth, 'Top 10 Growth Products', <TrendingUp size={18} color={theme.colors.success} />, growthSort, setGrowthSort)}
      {activeTab === 'decline' && renderProductTable(top10Decline, 'Top 10 Declining Products', <TrendingDown size={18} color={theme.colors.danger} />, declineSort, setDeclineSort)}
    </div>
  );
};

export default YoYPerformance;
