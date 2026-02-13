import React, { useMemo, useState, useCallback } from 'react';
import { LineChart, Line, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { Search, Filter, ChevronUp, ChevronDown } from 'lucide-react';
import { theme } from '../styles/theme';
import { formatValue, sumPeriod, periodToMonthName, getSortedPeriods } from '../utils/timePeriodUtils';

const thStyle = {
  padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#555',
  borderBottom: '2px solid #e0e0e0', fontSize: '12px',
  textTransform: 'uppercase', letterSpacing: '0.5px',
  cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap',
};
const tdStyle = { padding: '10px 16px', color: '#333', fontSize: '13px' };

function pctColor(val) {
  if (val == null) return theme.colors.textLight;
  return val >= 0 ? '#2e7d32' : '#c62828';
}
function fmtPct(val) {
  if (val == null) return '—';
  return `${val >= 0 ? '+' : ''}${val.toFixed(1)}%`;
}

function heatmapBg(momPct) {
  if (momPct == null) return '#f5f5f5';
  if (momPct >= 20) return '#c8e6c9';
  if (momPct >= 5) return '#e8f5e9';
  if (momPct > -5) return '#f5f5f5';
  if (momPct > -20) return '#ffebee';
  return '#ffcdd2';
}

const ProductSparkline = React.memo(({ data, trend, useDollars }) => {
  if (!data || data.length < 2) return <span style={{ color: '#ccc', fontSize: '11px' }}>—</span>;
  const color = trend === 'up' ? '#2e7d32' : trend === 'down' ? '#c62828' : '#999';
  return (
    <div style={{ width: 100, height: 28 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
          <RechartsTooltip
            contentStyle={{ fontSize: '11px', padding: '4px 8px', borderRadius: '4px' }}
            formatter={(v) => [formatValue(v, useDollars), null]}
            labelFormatter={(label, payload) => payload?.[0]?.payload?.month || label}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
});

const ProductPerformance = ({
  posData, currentData, comparisonData, trendData, periodLabel, timePeriod,
  primaryMetric, fullPrevYearData, comparableMonths,
  selectedPeriodKey, priorSequentialData, fullPriorYearProductData, monthsWithData,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [brandFilter, setBrandFilter] = useState('all');
  const [activeSubTab, setActiveSubTab] = useState('all');
  const [sortField, setSortField] = useState('primaryVal');
  const [sortDirection, setSortDirection] = useState('desc');
  const [showFilters, setShowFilters] = useState(false);
  const [heatmapSortField, setHeatmapSortField] = useState('latestVal');
  const [heatmapSortDir, setHeatmapSortDir] = useState('desc');

  const useDollars = primaryMetric === 'dollars';
  const metricKey = useDollars ? 'dollars' : 'units';

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
  const pyColLabel = `PY ${shortPrior}`;
  const yepColLabel = `YEP ${shortCur}`;
  const seqPctLabel = timePeriod === 'weekly' ? 'WoW%' : timePeriod === 'monthly' ? 'MoM%' : timePeriod === 'quarterly' ? 'QoQ%' : null;

  const yepMultiplier =
    timePeriod === 'weekly' ? 52 :
    timePeriod === 'monthly' ? 12 :
    timePeriod === 'quarterly' ? (monthsWithData > 0 ? 12 / monthsWithData : 4) :
    timePeriod === 'ytd' ? (comparableMonths > 0 ? 12 / comparableMonths : 1) : 1;

  const hasComparison = comparisonData && Object.keys(comparisonData).length > 0;
  const hasSeq = priorSequentialData && Object.keys(priorSequentialData).length > 0;
  const hasPY = fullPriorYearProductData && Object.keys(fullPriorYearProductData).length > 0;

  const productMap = useMemo(() => {
    const map = {};
    if (posData?.products) {
      posData.products.forEach(p => { map[p.upc] = p; });
    }
    return map;
  }, [posData]);

  /* ── Sparkline + Heatmap data ─────────────────────────────────────── */
  const sortedMonthKeys = useMemo(() => {
    if (!posData?.periods) return [];
    const all = getSortedPeriods(posData.periods);
    return all.slice(-12);
  }, [posData]);

  const sparklineDataMap = useMemo(() => {
    if (!posData?.periods || sortedMonthKeys.length < 2) return {};
    const map = {};
    const allUPCs = new Set();
    sortedMonthKeys.forEach(k => {
      if (posData.periods[k]) Object.keys(posData.periods[k]).forEach(u => allUPCs.add(u));
    });
    allUPCs.forEach(upc => {
      const data = sortedMonthKeys.map(k => ({
        month: periodToMonthName(k) + ' \'' + k.slice(2, 4),
        value: posData.periods[k]?.[upc]?.[metricKey] || 0,
      }));
      const half = Math.floor(data.length / 2);
      const firstHalf = data.slice(0, half);
      const secondHalf = data.slice(half);
      const avgFirst = firstHalf.reduce((s, d) => s + d.value, 0) / (firstHalf.length || 1);
      const avgSecond = secondHalf.reduce((s, d) => s + d.value, 0) / (secondHalf.length || 1);
      const diff = avgSecond - avgFirst;
      const trend = Math.abs(diff) < avgFirst * 0.02 ? 'flat' : diff > 0 ? 'up' : 'down';
      map[upc] = { data, trend };
    });
    return map;
  }, [posData, sortedMonthKeys, metricKey]);

  const heatmapData = useMemo(() => {
    if (activeSubTab !== 'heatmap' || !posData?.periods || sortedMonthKeys.length === 0) return [];
    const allUPCs = new Set();
    sortedMonthKeys.forEach(k => {
      if (posData.periods[k]) Object.keys(posData.periods[k]).forEach(u => allUPCs.add(u));
    });
    const rows = [];
    allUPCs.forEach(upc => {
      const product = productMap[upc];
      const name = product?.product_name || upc;
      const category = product?.category || 'Unknown';
      const brand = product?.brand || 'Unknown';
      const monthValues = {};
      const momChanges = {};
      let prevVal = null;
      let total = 0;
      let count = 0;
      sortedMonthKeys.forEach(k => {
        const val = posData.periods[k]?.[upc]?.[metricKey] || 0;
        monthValues[k] = val;
        if (prevVal != null && prevVal > 0) {
          momChanges[k] = ((val - prevVal) / prevVal) * 100;
        } else {
          momChanges[k] = null;
        }
        prevVal = val;
        total += val;
        count++;
      });
      const latestVal = monthValues[sortedMonthKeys[sortedMonthKeys.length - 1]] || 0;
      const avgVal = count > 0 ? total / count : 0;
      if (total === 0) return;
      rows.push({ upc, name, category, brand, monthValues, momChanges, latestVal, avgVal });
    });
    return rows;
  }, [activeSubTab, posData, sortedMonthKeys, productMap, metricKey]);

  const filteredHeatmapData = useMemo(() => {
    if (activeSubTab !== 'heatmap') return [];
    let result = [...heatmapData];
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(term) || p.upc.toLowerCase().includes(term) ||
        p.category.toLowerCase().includes(term) || p.brand.toLowerCase().includes(term)
      );
    }
    if (categoryFilter !== 'all') result = result.filter(p => p.category === categoryFilter);
    if (brandFilter !== 'all') result = result.filter(p => p.brand === brandFilter);
    result.sort((a, b) => {
      let aVal, bVal;
      if (heatmapSortField === 'name') {
        aVal = a.name.toLowerCase();
        bVal = b.name.toLowerCase();
        return heatmapSortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      if (heatmapSortField === 'avgVal' || heatmapSortField === 'latestVal') {
        aVal = a[heatmapSortField] || 0;
        bVal = b[heatmapSortField] || 0;
      } else {
        // month key sort
        aVal = a.monthValues[heatmapSortField] || 0;
        bVal = b.monthValues[heatmapSortField] || 0;
      }
      return heatmapSortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });
    return result;
  }, [activeSubTab, heatmapData, searchTerm, categoryFilter, brandFilter, heatmapSortField, heatmapSortDir]);

  const products = useMemo(() => {
    if (!currentData) return [];

    const allUPCs = new Set([
      ...Object.keys(currentData || {}),
      ...Object.keys(comparisonData || {}),
    ]);

    const list = [];
    allUPCs.forEach(upc => {
      const product = productMap[upc];
      const name = product?.product_name || upc;
      const category = product?.category || 'Unknown';
      const brand = product?.brand || 'Unknown';

      const dollars = currentData?.[upc]?.dollars || 0;
      const units = currentData?.[upc]?.units || 0;
      const primaryVal = currentData?.[upc]?.[metricKey] || 0;

      const compPrimaryVal = comparisonData?.[upc]?.[metricKey] || 0;

      const yoyChange = compPrimaryVal !== 0
        ? ((primaryVal - compPrimaryVal) / compPrimaryVal) * 100
        : primaryVal > 0 ? 100 : 0;

      // Sequential
      let seqPct = null;
      if (priorSequentialData) {
        const pm = priorSequentialData[upc];
        const priorVal = pm ? (pm[metricKey] || 0) : 0;
        if (priorVal > 0) seqPct = ((primaryVal - priorVal) / priorVal) * 100;
      }

      // PY & YEP & Pace
      let pyVal = null, yepVal = primaryVal * yepMultiplier, pacePct = null;
      if (fullPriorYearProductData) {
        const pm = fullPriorYearProductData[upc];
        if (pm) {
          pyVal = pm[metricKey] || 0;
          if (pyVal > 0) pacePct = ((yepVal - pyVal) / pyVal) * 100;
        }
      }

      if (primaryVal === 0 && compPrimaryVal === 0) return;

      list.push({
        upc, name, category, brand, dollars, units,
        primaryVal, compPrimaryVal, yoyChange,
        seqPct, pyVal, yepVal, pacePct,
      });
    });

    return list;
  }, [currentData, comparisonData, priorSequentialData, fullPriorYearProductData, productMap, metricKey, yepMultiplier]);

  const categories = useMemo(() => {
    const set = new Set(products.map(p => p.category));
    return ['all', ...Array.from(set).sort()];
  }, [products]);

  const brands = useMemo(() => {
    const set = new Set(products.map(p => p.brand));
    return ['all', ...Array.from(set).sort()];
  }, [products]);

  const filteredProducts = useMemo(() => {
    let result = [...products];
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(term) || p.upc.toLowerCase().includes(term) ||
        p.category.toLowerCase().includes(term) || p.brand.toLowerCase().includes(term)
      );
    }
    if (categoryFilter !== 'all') result = result.filter(p => p.category === categoryFilter);
    if (brandFilter !== 'all') result = result.filter(p => p.brand === brandFilter);
    if (activeSubTab === 'top') {
      result = result.sort((a, b) => b.primaryVal - a.primaryVal).slice(0, 20);
    } else if (activeSubTab === 'growth') {
      result = result.filter(p => p.yoyChange > 0);
    } else if (activeSubTab === 'decline') {
      result = result.filter(p => p.yoyChange < 0);
    }
    result.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = (bVal || '').toLowerCase();
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDirection === 'asc' ? (aVal || 0) - (bVal || 0) : (bVal || 0) - (aVal || 0);
    });
    return result;
  }, [products, searchTerm, categoryFilter, brandFilter, activeSubTab, sortField, sortDirection]);

  const handleSort = useCallback((field) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  }, [sortField]);

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <ChevronDown size={12} style={{ opacity: 0.3, marginLeft: '4px' }} />;
    return sortDirection === 'asc'
      ? <ChevronUp size={12} style={{ marginLeft: '4px', color: theme.colors.primary }} />
      : <ChevronDown size={12} style={{ marginLeft: '4px', color: theme.colors.primary }} />;
  };

  const SortHeader = ({ field, label, align }) => (
    <th style={{ ...thStyle, textAlign: align || 'left' }} onClick={() => handleSort(field)}>
      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: align === 'right' ? 'flex-end' : 'flex-start' }}>
        {label} <SortIcon field={field} />
      </span>
    </th>
  );

  // Count visible columns for colspan (+1 for sparkline Trend column)
  const colCount = 4 + 1 + (useDollars ? 1 : 1)
    + (hasComparison ? 1 : 0)
    + (hasPY ? 1 : 0) + 1
    + (hasSeq && seqPctLabel ? 1 : 0)
    + (hasComparison ? 1 : 0)
    + (hasPY ? 1 : 0);

  const handleHeatmapSort = useCallback((field) => {
    if (heatmapSortField === field) {
      setHeatmapSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setHeatmapSortField(field);
      setHeatmapSortDir('desc');
    }
  }, [heatmapSortField]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Search and Filters Bar */}
      <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e0e0e0', padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            backgroundColor: '#f8f9fa', borderRadius: '8px', padding: '8px 14px',
            flex: '1 1 300px', minWidth: '200px', border: '1px solid #e0e0e0',
          }}>
            <Search size={16} color="#999" />
            <input type="text" placeholder="Search products by name, UPC, category, or brand..."
              value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              style={{ border: 'none', outline: 'none', backgroundColor: 'transparent', fontSize: '14px', width: '100%', color: '#333' }}
            />
          </div>
          <button onClick={() => setShowFilters(!showFilters)} style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px',
            border: `1px solid ${showFilters ? theme.colors.primary : '#e0e0e0'}`, borderRadius: '8px',
            backgroundColor: showFilters ? `${theme.colors.primary}10` : '#fff',
            color: showFilters ? theme.colors.primary : '#666', cursor: 'pointer', fontSize: '14px', fontWeight: 500,
          }}>
            <Filter size={16} /> Filters
          </button>
          <span style={{ fontSize: '13px', color: '#999', whiteSpace: 'nowrap' }}>
            {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''}
          </span>
        </div>
        {showFilters && (
          <div style={{ display: 'flex', gap: '16px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #eee', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '180px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#666', textTransform: 'uppercase' }}>Category</label>
              <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
                style={{ padding: '8px 12px', border: '1px solid #e0e0e0', borderRadius: '6px', fontSize: '13px', color: '#333', backgroundColor: '#fff' }}>
                {categories.map(c => <option key={c} value={c}>{c === 'all' ? 'All Categories' : c}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '180px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#666', textTransform: 'uppercase' }}>Brand</label>
              <select value={brandFilter} onChange={e => setBrandFilter(e.target.value)}
                style={{ padding: '8px 12px', border: '1px solid #e0e0e0', borderRadius: '6px', fontSize: '13px', color: '#333', backgroundColor: '#fff' }}>
                {brands.map(b => <option key={b} value={b}>{b === 'all' ? 'All Brands' : b}</option>)}
              </select>
            </div>
            <button onClick={() => { setCategoryFilter('all'); setBrandFilter('all'); setSearchTerm(''); }}
              style={{ alignSelf: 'flex-end', padding: '8px 16px', border: '1px solid #e0e0e0', borderRadius: '6px', backgroundColor: '#fff', color: '#666', cursor: 'pointer', fontSize: '13px' }}>
              Clear Filters
            </button>
          </div>
        )}
      </div>

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: '4px', backgroundColor: '#f0f0f0', borderRadius: '8px', padding: '4px' }}>
        {[
          { key: 'all', label: 'All Products' },
          { key: 'top', label: 'Top Sellers' },
          { key: 'growth', label: 'Growth' },
          { key: 'decline', label: 'Decline' },
          { key: 'heatmap', label: 'Monthly Heatmap' },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveSubTab(tab.key)} style={{
            flex: 1, padding: '10px 16px', border: 'none', borderRadius: '6px',
            backgroundColor: activeSubTab === tab.key ? '#fff' : 'transparent',
            color: activeSubTab === tab.key ? theme.colors.primary : '#666',
            fontWeight: activeSubTab === tab.key ? 600 : 400, cursor: 'pointer', fontSize: '14px',
            boxShadow: activeSubTab === tab.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.2s',
          }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Product Table or Heatmap */}
      {activeSubTab !== 'heatmap' ? (
        <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e0e0e0', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8f9fa' }}>
                  <SortHeader field="name" label="Product" />
                  <SortHeader field="category" label="Category" />
                  <SortHeader field="brand" label="Brand" />
                  <th style={{ ...thStyle, cursor: 'default' }}>Trend</th>
                  {hasComparison && <SortHeader field="compPrimaryVal" label={yagoColLabel} align="right" />}
                  <SortHeader field="primaryVal" label={curColLabel} align="right" />
                  {useDollars && <SortHeader field="units" label="Units" align="right" />}
                  {hasPY && <SortHeader field="pyVal" label={pyColLabel} align="right" />}
                  <SortHeader field="yepVal" label={yepColLabel} align="right" />
                  {hasSeq && seqPctLabel && <SortHeader field="seqPct" label={seqPctLabel} align="right" />}
                  {hasComparison && <SortHeader field="yoyChange" label="YoY%" align="right" />}
                  {hasPY && <SortHeader field="pacePct" label="Pace%" align="right" />}
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((p, idx) => (
                  <tr key={p.upc} style={{ backgroundColor: idx % 2 === 0 ? '#fff' : '#f8f9fa', borderBottom: '1px solid #eee', transition: 'background-color 0.15s' }}>
                    <td style={{ ...tdStyle, maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
                      {p.name}
                    </td>
                    <td style={tdStyle}>
                      <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '4px', backgroundColor: '#f0f0f0', fontSize: '12px' }}>
                        {p.category}
                      </span>
                    </td>
                    <td style={tdStyle}>{p.brand}</td>
                    <td style={{ ...tdStyle, padding: '4px 8px' }}>
                      <ProductSparkline
                        data={sparklineDataMap[p.upc]?.data}
                        trend={sparklineDataMap[p.upc]?.trend}
                        useDollars={useDollars}
                      />
                    </td>
                    {hasComparison && (
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{formatValue(p.compPrimaryVal, useDollars)}</td>
                    )}
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{formatValue(p.primaryVal, useDollars)}</td>
                    {useDollars && (
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{formatValue(p.units, false)}</td>
                    )}
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
                    {hasComparison && (
                      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: p.yoyChange >= 0 ? theme.colors.success : theme.colors.danger }}>
                        {fmtPct(p.yoyChange)}
                      </td>
                    )}
                    {hasPY && (
                      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: pctColor(p.pacePct) }}>
                        {fmtPct(p.pacePct)}
                      </td>
                    )}
                  </tr>
                ))}
                {filteredProducts.length === 0 && (
                  <tr>
                    <td colSpan={colCount} style={{ ...tdStyle, textAlign: 'center', color: '#999', padding: '40px 16px' }}>
                      {searchTerm || categoryFilter !== 'all' || brandFilter !== 'all'
                        ? 'No products match the current filters.'
                        : 'No product data available.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div style={{
            padding: '12px 20px', borderTop: '1px solid #e0e0e0', backgroundColor: '#f8f9fa',
            fontSize: '13px', color: '#666', display: 'flex', justifyContent: 'space-between',
          }}>
            <span>Showing {filteredProducts.length} of {products.length} products</span>
            <span>{periodLabel}</span>
          </div>
        </div>
      ) : (
        /* ── Monthly Heatmap ──────────────────────────────────────────── */
        <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e0e0e0', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8f9fa' }}>
                  <th
                    style={{ ...thStyle, position: 'sticky', left: 0, backgroundColor: '#f8f9fa', zIndex: 2, minWidth: '200px' }}
                    onClick={() => handleHeatmapSort('name')}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                      Product {heatmapSortField === 'name' ? (heatmapSortDir === 'asc' ? '▲' : '▼') : ''}
                    </span>
                  </th>
                  {sortedMonthKeys.map(k => (
                    <th
                      key={k}
                      style={{ ...thStyle, textAlign: 'right', minWidth: '72px' }}
                      onClick={() => handleHeatmapSort(k)}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                        {periodToMonthName(k)} '{k.slice(2, 4)}
                        {heatmapSortField === k ? (heatmapSortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                      </span>
                    </th>
                  ))}
                  <th
                    style={{ ...thStyle, textAlign: 'right', minWidth: '72px' }}
                    onClick={() => handleHeatmapSort('avgVal')}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                      Avg {heatmapSortField === 'avgVal' ? (heatmapSortDir === 'asc' ? '▲' : '▼') : ''}
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredHeatmapData.map((row, idx) => (
                  <tr key={row.upc} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{
                      ...tdStyle, position: 'sticky', left: 0, zIndex: 1,
                      backgroundColor: idx % 2 === 0 ? '#fff' : '#f8f9fa',
                      fontWeight: 500, maxWidth: '200px', overflow: 'hidden',
                      textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {row.name}
                    </td>
                    {sortedMonthKeys.map(k => (
                      <td
                        key={k}
                        title={row.momChanges[k] != null ? `MoM: ${fmtPct(row.momChanges[k])}` : 'No prior month'}
                        style={{
                          ...tdStyle, textAlign: 'right', fontSize: '12px',
                          backgroundColor: heatmapBg(row.momChanges[k]),
                        }}
                      >
                        {formatValue(row.monthValues[k], useDollars)}
                      </td>
                    ))}
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, fontSize: '12px' }}>
                      {formatValue(row.avgVal, useDollars)}
                    </td>
                  </tr>
                ))}
                {filteredHeatmapData.length === 0 && (
                  <tr>
                    <td colSpan={sortedMonthKeys.length + 2} style={{ ...tdStyle, textAlign: 'center', color: '#999', padding: '40px 16px' }}>
                      {searchTerm || categoryFilter !== 'all' || brandFilter !== 'all'
                        ? 'No products match the current filters.'
                        : 'No product data available.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div style={{
            padding: '12px 20px', borderTop: '1px solid #e0e0e0', backgroundColor: '#f8f9fa',
            fontSize: '13px', color: '#666', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span>{filteredHeatmapData.length} product{filteredHeatmapData.length !== 1 ? 's' : ''}</span>
            <span style={{ display: 'flex', gap: '12px', alignItems: 'center', fontSize: '11px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: '#c8e6c9', display: 'inline-block' }} /> Growth
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: '#f5f5f5', border: '1px solid #e0e0e0', display: 'inline-block' }} /> Flat
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: '#ffcdd2', display: 'inline-block' }} /> Decline
              </span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductPerformance;
