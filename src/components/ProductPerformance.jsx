import React, { useMemo, useState, useCallback } from 'react';
import { Search, Filter, ChevronUp, ChevronDown } from 'lucide-react';
import { theme } from '../styles/theme';
import { formatValue, sumPeriod, periodToMonthName } from '../utils/timePeriodUtils';

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

  // Count visible columns for colspan
  const colCount = 3 + 1 + (useDollars ? 1 : 1)
    + (hasComparison ? 1 : 0)
    + (hasPY ? 1 : 0) + 1
    + (hasSeq && seqPctLabel ? 1 : 0)
    + (hasComparison ? 1 : 0)
    + (hasPY ? 1 : 0);

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

      {/* Product Table */}
      <div style={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e0e0e0', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8f9fa' }}>
                <SortHeader field="name" label="Product" />
                <SortHeader field="category" label="Category" />
                <SortHeader field="brand" label="Brand" />
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
    </div>
  );
};

export default ProductPerformance;
