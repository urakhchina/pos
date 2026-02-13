import React, { useMemo, useState } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  AreaChart,
  Area,
  ResponsiveContainer
} from 'recharts';
import { ArrowLeft } from 'lucide-react';
import { theme } from '../styles/theme';
import { formatValue, sumPeriod, periodToMonthName } from '../utils/timePeriodUtils';

const CHART_COLORS = [
  theme.colors.primary,
  theme.colors.secondary,
  theme.colors.primaryDark,
  '#5b9bd5',
  '#ed7d31',
  '#a855f7',
  '#f59e0b',
  '#06b6d4',
  '#ec4899',
  '#84cc16',
  '#6366f1',
  '#14b8a6'
];

const CategoryAnalytics = ({
  posData,
  currentData,
  comparisonData,
  trendData,
  periodLabel,
  timePeriod,
  primaryMetric,
  fullPrevYearData,
  comparableMonths,
  monthsWithData,
  selectedPeriodKey,
  priorSequentialData,
  fullPriorYearProductData,
  inventory,
  ltoos,
  forecast,
  ecommerce
}) => {
  const [selectedCategory, setSelectedCategory] = useState(null);

  const useDollars = primaryMetric === 'dollars';
  const metricKey = useDollars ? 'dollars' : 'units';
  const metricLabel = useDollars ? 'Dollars' : 'Units';

  /* ── Helpers ───────────────────────────────────────────────────── */
  const pctColor = (val) => val == null ? '#999' : val >= 0 ? '#2e7d32' : '#c62828';
  const fmtPct = (val) => val == null ? '—' : `${val >= 0 ? '+' : ''}${val.toFixed(1)}%`;

  /* ── Column header labels ─────────────────────────────────────── */
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
  const seqColLabel = timePeriod === 'weekly' ? 'Prev Wk' : timePeriod === 'monthly' ? 'Prev Mo' : timePeriod === 'quarterly' ? 'Prev Qtr' : null;

  const yepMultiplier =
    timePeriod === 'weekly' ? 52 :
    timePeriod === 'monthly' ? 12 :
    timePeriod === 'quarterly' ? (monthsWithData > 0 ? 12 / monthsWithData : 4) :
    timePeriod === 'ytd' ? (comparableMonths > 0 ? 12 / comparableMonths : 1) : 1;

  const hasSeq = priorSequentialData && Object.keys(priorSequentialData).length > 0;
  const hasPY = fullPriorYearProductData && Object.keys(fullPriorYearProductData).length > 0;

  // Build product lookup map from array
  const productMap = useMemo(() => {
    const map = {};
    if (posData?.products) {
      posData.products.forEach(p => { map[p.upc] = p; });
    }
    return map;
  }, [posData]);

  // Aggregate currentData by category
  const categoryData = useMemo(() => {
    if (!currentData || Object.keys(productMap).length === 0) return {};

    const cats = {};
    Object.entries(currentData).forEach(([upc, data]) => {
      const product = productMap[upc];
      const category = product?.category || 'Unknown';
      const subcategory = product?.subcategory || product?.sub_category || 'Other';

      if (!cats[category]) {
        cats[category] = {
          name: category,
          dollars: 0,
          units: 0,
          productCount: 0,
          subcategories: {},
          products: []
        };
      }

      cats[category].dollars += data.dollars || 0;
      cats[category].units += data.units || 0;
      cats[category].productCount += 1;
      cats[category].products.push({
        upc,
        name: product?.product_name || upc,
        dollars: data.dollars || 0,
        units: data.units || 0,
        subcategory
      });

      if (!cats[category].subcategories[subcategory]) {
        cats[category].subcategories[subcategory] = {
          name: subcategory,
          dollars: 0,
          units: 0,
          productCount: 0
        };
      }
      cats[category].subcategories[subcategory].dollars += data.dollars || 0;
      cats[category].subcategories[subcategory].units += data.units || 0;
      cats[category].subcategories[subcategory].productCount += 1;
    });

    return cats;
  }, [currentData, productMap]);

  // Aggregate comparisonData by category for YoY
  const categoryCompData = useMemo(() => {
    if (!comparisonData || Object.keys(productMap).length === 0) return {};

    const cats = {};
    Object.entries(comparisonData).forEach(([upc, data]) => {
      const product = productMap[upc];
      const category = product?.category || 'Unknown';

      if (!cats[category]) {
        cats[category] = { dollars: 0, units: 0 };
      }
      cats[category].dollars += data.dollars || 0;
      cats[category].units += data.units || 0;
    });

    return cats;
  }, [comparisonData, productMap]);

  // Aggregate priorSequentialData by category
  const categorySeqData = useMemo(() => {
    if (!priorSequentialData || Object.keys(productMap).length === 0) return {};
    const cats = {};
    Object.entries(priorSequentialData).forEach(([upc, data]) => {
      const product = productMap[upc];
      const category = product?.category || 'Unknown';
      if (!cats[category]) cats[category] = { dollars: 0, units: 0 };
      cats[category].dollars += data.dollars || 0;
      cats[category].units += data.units || 0;
    });
    return cats;
  }, [priorSequentialData, productMap]);

  // Aggregate fullPriorYearProductData by category
  const categoryPYData = useMemo(() => {
    if (!fullPriorYearProductData || Object.keys(productMap).length === 0) return {};
    const cats = {};
    Object.entries(fullPriorYearProductData).forEach(([upc, data]) => {
      const product = productMap[upc];
      const category = product?.category || 'Unknown';
      if (!cats[category]) cats[category] = { dollars: 0, units: 0 };
      cats[category].dollars += data.dollars || 0;
      cats[category].units += data.units || 0;
    });
    return cats;
  }, [fullPriorYearProductData, productMap]);

  // Build category list with YoY
  const categories = useMemo(() => {
    const allCats = new Set([
      ...Object.keys(categoryData),
      ...Object.keys(categoryCompData)
    ]);

    return Array.from(allCats).map(cat => {
      const current = categoryData[cat] || { dollars: 0, units: 0, productCount: 0, subcategories: {}, products: [] };
      const comp = categoryCompData[cat] || { dollars: 0, units: 0 };
      const seq = categorySeqData[cat] || { dollars: 0, units: 0 };
      const py = categoryPYData[cat] || { dollars: 0, units: 0 };

      const currentVal = current[metricKey] || 0;
      const compVal = comp[metricKey] || 0;
      const seqVal = seq[metricKey] || 0;
      const pyVal = py[metricKey] || 0;
      const yepVal = currentVal * yepMultiplier;
      const yoyChange = compVal !== 0
        ? ((currentVal - compVal) / compVal) * 100
        : currentVal > 0 ? 100 : 0;
      const seqPct = seqVal > 0 ? ((currentVal - seqVal) / seqVal) * 100 : null;
      const pacePct = pyVal > 0 ? ((yepVal - pyVal) / pyVal) * 100 : null;

      return {
        name: cat,
        dollars: current.dollars,
        units: current.units,
        primaryVal: currentVal,
        compVal,
        seqVal,
        pyVal,
        yepVal,
        yoyChange,
        seqPct,
        pacePct,
        productCount: current.productCount,
        subcategories: current.subcategories,
        products: current.products
      };
    }).sort((a, b) => b.primaryVal - a.primaryVal);
  }, [categoryData, categoryCompData, categorySeqData, categoryPYData, metricKey, yepMultiplier]);

  // Pie chart data
  const pieData = useMemo(() => {
    return categories.map((cat, idx) => ({
      name: cat.name,
      value: cat.primaryVal,
      color: CHART_COLORS[idx % CHART_COLORS.length]
    })).filter(d => d.value > 0);
  }, [categories]);

  // Velocity bar chart data (avg value per SKU, sorted descending)
  const velocityBarData = useMemo(() => {
    return categories
      .filter(c => c.primaryVal > 0 && c.productCount > 0)
      .map((c, idx) => ({
        name: c.name.length > 18 ? c.name.substring(0, 18) + '...' : c.name,
        fullName: c.name,
        velocity: parseFloat((c.primaryVal / c.productCount).toFixed(2)),
        color: CHART_COLORS[idx % CHART_COLORS.length],
        productCount: c.productCount,
        primaryVal: c.primaryVal,
        pyVal: c.pyVal,
        yepVal: c.yepVal,
        yoyChange: c.yoyChange,
        pacePct: c.pacePct,
      }))
      .sort((a, b) => b.velocity - a.velocity);
  }, [categories]);

  // YoY bar chart data
  const yoyBarData = useMemo(() => {
    return categories
      .filter(c => c.compVal > 0 || c.primaryVal > 0)
      .map(c => ({
        name: c.name.length > 18 ? c.name.substring(0, 18) + '...' : c.name,
        fullName: c.name,
        yoy: parseFloat(c.yoyChange.toFixed(1))
      }));
  }, [categories]);

  // Stacked area trends: use trendData period keys to look up posData.periods, group by category
  const trendChartData = useMemo(() => {
    if (!trendData || trendData.length === 0 || !posData?.periods || Object.keys(productMap).length === 0) return [];

    const catNames = categories.map(c => c.name);

    // For each trendData entry, look up the posData.periods for that period and aggregate by category
    const rows = trendData.map(entry => {
      const periodKey = entry.period;
      const periodData = posData.periods?.[periodKey];
      const row = { label: entry.label || periodKey, period: periodKey };

      // Initialize all categories to 0
      catNames.forEach(cat => { row[cat] = 0; });

      if (periodData) {
        Object.entries(periodData).forEach(([upc, data]) => {
          const product = productMap[upc];
          const category = product?.category || 'Unknown';
          if (row[category] !== undefined) {
            row[category] += data[metricKey] || 0;
          } else {
            row[category] = data[metricKey] || 0;
          }
        });
      }

      return row;
    });

    // Sort by period key for chronological order
    rows.sort((a, b) => String(a.period).localeCompare(String(b.period)));

    return rows;
  }, [trendData, posData, productMap, categories, metricKey]);

  // Categories actually present in the trend data (with non-zero values)
  const trendCategories = useMemo(() => {
    if (trendChartData.length === 0) return [];
    const catNames = categories.map(c => c.name);
    return catNames.filter(cat =>
      trendChartData.some(row => (row[cat] || 0) > 0)
    );
  }, [trendChartData, categories]);

  // Enriched subcategory + product data for drilldown (with comp/seq/PY)
  const drilldownEnrichedData = useMemo(() => {
    if (!selectedCategory) return { subcats: [], products: [] };
    const cat = categories.find(c => c.name === selectedCategory);
    if (!cat) return { subcats: [], products: [] };

    const aggregateBySubcat = (upcData) => {
      const result = {};
      if (!upcData) return result;
      Object.entries(upcData).forEach(([upc, data]) => {
        const product = productMap[upc];
        if (!product || product.category !== selectedCategory) return;
        const sub = product.subcategory || product.sub_category || 'Other';
        if (!result[sub]) result[sub] = { dollars: 0, units: 0 };
        result[sub].dollars += data.dollars || 0;
        result[sub].units += data.units || 0;
      });
      return result;
    };

    const compBySub = aggregateBySubcat(comparisonData);
    const seqBySub = aggregateBySubcat(priorSequentialData);
    const pyBySub = aggregateBySubcat(fullPriorYearProductData);

    const subcats = Object.values(cat.subcategories).map(sub => {
      const curVal = sub[metricKey] || 0;
      const compVal = compBySub[sub.name]?.[metricKey] || 0;
      const seqVal = seqBySub[sub.name]?.[metricKey] || 0;
      const pyVal = pyBySub[sub.name]?.[metricKey] || 0;
      const yepVal = curVal * yepMultiplier;
      const yoyPct = compVal > 0 ? ((curVal - compVal) / compVal) * 100 : (curVal > 0 ? 100 : 0);
      const seqPct = seqVal > 0 ? ((curVal - seqVal) / seqVal) * 100 : null;
      const pacePct = pyVal > 0 ? ((yepVal - pyVal) / pyVal) * 100 : null;
      return { ...sub, curVal, compVal, seqVal, pyVal, yepVal, seqPct, yoyPct, pacePct };
    }).sort((a, b) => b.curVal - a.curVal);

    const products = [...cat.products].map(p => {
      const curVal = useDollars ? p.dollars : p.units;
      const comp = comparisonData?.[p.upc];
      const compVal = comp ? (useDollars ? (comp.dollars || 0) : (comp.units || 0)) : 0;
      const seq = priorSequentialData?.[p.upc];
      const seqVal = seq ? (useDollars ? (seq.dollars || 0) : (seq.units || 0)) : 0;
      const py = fullPriorYearProductData?.[p.upc];
      const pyVal = py ? (useDollars ? (py.dollars || 0) : (py.units || 0)) : 0;
      const yepVal = curVal * yepMultiplier;
      const yoyPct = compVal > 0 ? ((curVal - compVal) / compVal) * 100 : (curVal > 0 ? 100 : 0);
      const seqPct = seqVal > 0 ? ((curVal - seqVal) / seqVal) * 100 : null;
      const pacePct = pyVal > 0 ? ((yepVal - pyVal) / pyVal) * 100 : null;
      return { ...p, curVal, compVal, seqVal, pyVal, yepVal, seqPct, yoyPct, pacePct };
    }).sort((a, b) => b.curVal - a.curVal);

    return { subcats, products };
  }, [selectedCategory, categories, comparisonData, priorSequentialData, fullPriorYearProductData, productMap, metricKey, useDollars, yepMultiplier]);

  const totalPrimaryVal = categories.reduce((sum, c) => sum + c.primaryVal, 0);

  const hasComparison = comparisonData && Object.keys(comparisonData).length > 0;

  // Custom tooltip for charts
  const ChartTooltip = ({ active, payload, label }) => {
    if (!active || !payload || payload.length === 0) return null;
    return (
      <div style={{
        backgroundColor: '#fff',
        border: `1px solid ${theme.colors.secondary}`,
        borderRadius: '8px',
        padding: '12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        maxWidth: '300px'
      }}>
        <p style={{ margin: '0 0 8px', fontWeight: 600, color: theme.colors.secondary, fontSize: '13px' }}>
          {label}
        </p>
        {payload.map((entry, idx) => (
          <p key={idx} style={{ margin: '3px 0', color: entry.color, fontSize: '12px' }}>
            {entry.name}: {formatValue(entry.value, useDollars)}
          </p>
        ))}
      </div>
    );
  };

  const PieTooltip = ({ active, payload }) => {
    if (!active || !payload || payload.length === 0) return null;
    const data = payload[0];
    const pct = totalPrimaryVal > 0 ? ((data.value / totalPrimaryVal) * 100).toFixed(1) : '0.0';
    return (
      <div style={{
        backgroundColor: '#fff',
        border: `1px solid ${theme.colors.secondary}`,
        borderRadius: '8px',
        padding: '12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
      }}>
        <p style={{ margin: '0 0 4px', fontWeight: 600, color: theme.colors.secondary }}>{data.name}</p>
        <p style={{ margin: 0, fontSize: '13px', color: '#666' }}>
          {formatValue(data.value, useDollars)} ({pct}%)
        </p>
      </div>
    );
  };

  const YoYTooltip = ({ active, payload }) => {
    if (!active || !payload || payload.length === 0) return null;
    const data = payload[0]?.payload;
    return (
      <div style={{
        backgroundColor: '#fff',
        border: `1px solid ${theme.colors.secondary}`,
        borderRadius: '8px',
        padding: '12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
      }}>
        <p style={{ margin: '0 0 4px', fontWeight: 600, color: theme.colors.secondary }}>
          {data?.fullName || data?.name}
        </p>
        <p style={{
          margin: 0,
          fontSize: '13px',
          color: data?.yoy >= 0 ? theme.colors.success : theme.colors.danger,
          fontWeight: 600
        }}>
          {data?.yoy >= 0 ? '+' : ''}{data?.yoy}% YoY
        </p>
      </div>
    );
  };

  // Subcategory drilldown view
  if (selectedCategory) {
    const cat = categories.find(c => c.name === selectedCategory);
    if (!cat) {
      setSelectedCategory(null);
      return null;
    }

    const { subcats, products: catProducts } = drilldownEnrichedData;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Back button */}
        <button
          onClick={() => setSelectedCategory(null)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            border: `1px solid ${theme.colors.secondary}`,
            borderRadius: '8px',
            backgroundColor: '#fff',
            color: theme.colors.secondary,
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 500,
            alignSelf: 'flex-start'
          }}
        >
          <ArrowLeft size={16} />
          Back to All Categories
        </button>

        {/* Category header */}
        <div style={{
          backgroundColor: '#fff',
          borderRadius: '12px',
          border: '1px solid #e0e0e0',
          padding: '24px'
        }}>
          <h2 style={{ margin: '0 0 8px', color: theme.colors.secondary, fontSize: '22px' }}>
            {cat.name}
          </h2>
          <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
            <div>
              <span style={{ fontSize: '12px', color: '#999', textTransform: 'uppercase', fontWeight: 600 }}>
                {curColLabel}
              </span>
              <p style={{ margin: '4px 0 0', fontSize: '24px', fontWeight: 700, color: theme.colors.primary }}>
                {formatValue(cat.primaryVal, useDollars)}
              </p>
            </div>
            <div>
              <span style={{ fontSize: '12px', color: '#999', textTransform: 'uppercase', fontWeight: 600 }}>
                Products
              </span>
              <p style={{ margin: '4px 0 0', fontSize: '24px', fontWeight: 700, color: theme.colors.secondary }}>
                {cat.productCount}
              </p>
            </div>
            {hasPY && (
              <div>
                <span style={{ fontSize: '12px', color: '#999', textTransform: 'uppercase', fontWeight: 600 }}>
                  {pyLabel}
                </span>
                <p style={{ margin: '4px 0 0', fontSize: '24px', fontWeight: 700, color: theme.colors.secondary }}>
                  {formatValue(cat.pyVal, useDollars)}
                </p>
              </div>
            )}
            <div>
              <span style={{ fontSize: '12px', color: '#999', textTransform: 'uppercase', fontWeight: 600 }}>
                {yepLabel}
              </span>
              <p style={{ margin: '4px 0 0', fontSize: '24px', fontWeight: 700, color: theme.colors.secondary }}>
                {formatValue(cat.yepVal, useDollars)}
              </p>
            </div>
            {hasComparison && (
              <div>
                <span style={{ fontSize: '12px', color: '#999', textTransform: 'uppercase', fontWeight: 600 }}>
                  YoY
                </span>
                <p style={{
                  margin: '4px 0 0',
                  fontSize: '24px',
                  fontWeight: 700,
                  color: cat.yoyChange >= 0 ? theme.colors.success : theme.colors.danger
                }}>
                  {fmtPct(cat.yoyChange)}
                </p>
              </div>
            )}
            {hasPY && (
              <div>
                <span style={{ fontSize: '12px', color: '#999', textTransform: 'uppercase', fontWeight: 600 }}>
                  Pace
                </span>
                <p style={{
                  margin: '4px 0 0',
                  fontSize: '24px',
                  fontWeight: 700,
                  color: pctColor(cat.pacePct)
                }}>
                  {fmtPct(cat.pacePct)}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Subcategories */}
        {subcats.length > 0 && (
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '12px',
            border: '1px solid #e0e0e0',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid #e0e0e0',
              backgroundColor: '#f8f9fa'
            }}>
              <h3 style={{ margin: 0, fontSize: '16px', color: theme.colors.secondary }}>
                Subcategories
              </h3>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8f9fa' }}>
                    <th style={thStyle}>Subcategory</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>{yagoColLabel}</th>
                    {hasSeq && seqColLabel && <th style={{ ...thStyle, textAlign: 'right' }}>{seqColLabel}</th>}
                    <th style={{ ...thStyle, textAlign: 'right' }}>{curColLabel}</th>
                    {hasPY && <th style={{ ...thStyle, textAlign: 'right' }}>{pyLabel}</th>}
                    <th style={{ ...thStyle, textAlign: 'right' }}>{yepLabel}</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Products</th>
                    {hasSeq && seqPctLabel && <th style={{ ...thStyle, textAlign: 'right' }}>{seqPctLabel}</th>}
                    <th style={{ ...thStyle, textAlign: 'right' }}>YoY%</th>
                    {hasPY && <th style={{ ...thStyle, textAlign: 'right' }}>Pace%</th>}
                  </tr>
                </thead>
                <tbody>
                  {subcats.map((sub, idx) => (
                    <tr key={sub.name} style={{
                      backgroundColor: idx % 2 === 0 ? '#fff' : '#f8f9fa',
                      borderBottom: '1px solid #eee'
                    }}>
                      <td style={tdStyle}>{sub.name}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{formatValue(sub.compVal, useDollars)}</td>
                      {hasSeq && seqColLabel && (
                        <td style={{ ...tdStyle, textAlign: 'right' }}>{formatValue(sub.seqVal, useDollars)}</td>
                      )}
                      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{formatValue(sub.curVal, useDollars)}</td>
                      {hasPY && <td style={{ ...tdStyle, textAlign: 'right' }}>{sub.pyVal > 0 ? formatValue(sub.pyVal, useDollars) : '—'}</td>}
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{formatValue(sub.yepVal, useDollars)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{sub.productCount}</td>
                      {hasSeq && seqPctLabel && (
                        <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: pctColor(sub.seqPct) }}>
                          {fmtPct(sub.seqPct)}
                        </td>
                      )}
                      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: pctColor(sub.yoyPct) }}>
                        {fmtPct(sub.yoyPct)}
                      </td>
                      {hasPY && (
                        <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: pctColor(sub.pacePct) }}>
                          {fmtPct(sub.pacePct)}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Products in category */}
        <div style={{
          backgroundColor: '#fff',
          borderRadius: '12px',
          border: '1px solid #e0e0e0',
          overflow: 'hidden'
        }}>
          <div style={{
            padding: '16px 20px',
            borderBottom: '1px solid #e0e0e0',
            backgroundColor: '#f8f9fa'
          }}>
            <h3 style={{ margin: 0, fontSize: '16px', color: theme.colors.secondary }}>
              Products ({catProducts.length})
            </h3>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8f9fa' }}>
                  <th style={thStyle}>Product</th>
                  <th style={thStyle}>Subcategory</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>{yagoColLabel}</th>
                  {hasSeq && seqColLabel && <th style={{ ...thStyle, textAlign: 'right' }}>{seqColLabel}</th>}
                  <th style={{ ...thStyle, textAlign: 'right' }}>{curColLabel}</th>
                  {hasPY && <th style={{ ...thStyle, textAlign: 'right' }}>{pyLabel}</th>}
                  <th style={{ ...thStyle, textAlign: 'right' }}>{yepLabel}</th>
                  {hasSeq && seqPctLabel && <th style={{ ...thStyle, textAlign: 'right' }}>{seqPctLabel}</th>}
                  <th style={{ ...thStyle, textAlign: 'right' }}>YoY%</th>
                  {hasPY && <th style={{ ...thStyle, textAlign: 'right' }}>Pace%</th>}
                </tr>
              </thead>
              <tbody>
                {catProducts.map((p, idx) => (
                  <tr key={p.upc} style={{
                    backgroundColor: idx % 2 === 0 ? '#fff' : '#f8f9fa',
                    borderBottom: '1px solid #eee'
                  }}>
                    <td style={{
                      ...tdStyle,
                      maxWidth: '250px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontWeight: 500
                    }}>
                      {p.name}
                    </td>
                    <td style={tdStyle}>
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        backgroundColor: '#f0f0f0',
                        fontSize: '12px'
                      }}>
                        {p.subcategory}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{formatValue(p.compVal, useDollars)}</td>
                    {hasSeq && seqColLabel && (
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{formatValue(p.seqVal, useDollars)}</td>
                    )}
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{formatValue(p.curVal, useDollars)}</td>
                    {hasPY && <td style={{ ...tdStyle, textAlign: 'right' }}>{p.pyVal > 0 ? formatValue(p.pyVal, useDollars) : '—'}</td>}
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{formatValue(p.yepVal, useDollars)}</td>
                    {hasSeq && seqPctLabel && (
                      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: pctColor(p.seqPct) }}>
                        {fmtPct(p.seqPct)}
                      </td>
                    )}
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: pctColor(p.yoyPct) }}>
                      {fmtPct(p.yoyPct)}
                    </td>
                    {hasPY && (
                      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: pctColor(p.pacePct) }}>
                        {fmtPct(p.pacePct)}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // Main category overview
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Category Cards Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: '16px'
      }}>
        {categories.map((cat, idx) => {
          const share = totalPrimaryVal > 0
            ? ((cat.primaryVal / totalPrimaryVal) * 100).toFixed(1)
            : '0.0';
          return (
            <div
              key={cat.name}
              onClick={() => setSelectedCategory(cat.name)}
              style={{
                backgroundColor: '#fff',
                borderRadius: '12px',
                border: '1px solid #e0e0e0',
                padding: '20px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                borderLeft: `4px solid ${CHART_COLORS[idx % CHART_COLORS.length]}`
              }}
              onMouseEnter={e => {
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.transform = 'none';
              }}
            >
              <h4 style={{
                margin: '0 0 12px',
                color: theme.colors.secondary,
                fontSize: '15px',
                fontWeight: 600
              }}>
                {cat.name}
              </h4>
              <p style={{
                margin: '0 0 8px',
                fontSize: '24px',
                fontWeight: 700,
                color: theme.colors.primary
              }}>
                {formatValue(cat.primaryVal, useDollars)}
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#666' }}>
                <span>{cat.productCount} product{cat.productCount !== 1 ? 's' : ''}</span>
                <span>{share}% share</span>
              </div>
              {(hasPY || cat.yepVal > 0) && (
                <div style={{ display: 'flex', gap: '16px', marginTop: '8px', fontSize: '11px', color: '#666' }}>
                  {hasPY && <span>{pyLabel}: {formatValue(cat.pyVal, useDollars)}</span>}
                  <span>{yepLabel}: {formatValue(cat.yepVal, useDollars)}</span>
                </div>
              )}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                {hasComparison && (
                  <div style={{
                    padding: '4px 8px',
                    borderRadius: '6px',
                    backgroundColor: cat.yoyChange >= 0 ? `${theme.colors.success}15` : `${theme.colors.danger}15`,
                    display: 'inline-block'
                  }}>
                    <span style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: cat.yoyChange >= 0 ? theme.colors.success : theme.colors.danger
                    }}>
                      {fmtPct(cat.yoyChange)} YoY
                    </span>
                  </div>
                )}
                {hasPY && cat.pacePct != null && (
                  <div style={{
                    padding: '4px 8px',
                    borderRadius: '6px',
                    backgroundColor: cat.pacePct >= 0 ? `${theme.colors.success}15` : `${theme.colors.danger}15`,
                    display: 'inline-block'
                  }}>
                    <span style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: pctColor(cat.pacePct)
                    }}>
                      {fmtPct(cat.pacePct)} Pace
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Velocity by Category — horizontal bar chart */}
      {velocityBarData.length > 0 && (
        <div style={{
          backgroundColor: '#fff',
          borderRadius: '12px',
          border: '1px solid #e0e0e0',
          padding: '24px'
        }}>
          <h3 style={{ margin: '0 0 20px', color: theme.colors.secondary, fontSize: '16px' }}>
            Avg {metricLabel} per SKU by Category
          </h3>
          <ResponsiveContainer width="100%" height={Math.max(280, velocityBarData.length * 40)}>
            <BarChart data={velocityBarData} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fontSize: 12, fill: '#666' }}
                axisLine={{ stroke: '#ccc' }}
                tickFormatter={(val) => formatValue(val, useDollars)}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 12, fill: '#444' }}
                axisLine={{ stroke: '#ccc' }}
                width={160}
              />
              <Tooltip content={({ active, payload }) => {
                if (!active || !payload || payload.length === 0) return null;
                const d = payload[0]?.payload;
                if (!d) return null;
                return (
                  <div style={{
                    backgroundColor: '#fff',
                    border: `1px solid ${theme.colors.secondary}`,
                    borderRadius: '8px',
                    padding: '12px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                    minWidth: '200px',
                  }}>
                    <p style={{ margin: '0 0 8px', fontWeight: 600, color: theme.colors.secondary, fontSize: '13px' }}>
                      {d.fullName}
                    </p>
                    <p style={{ margin: '3px 0', fontSize: '12px', color: '#444' }}>
                      Avg / SKU: <strong>{formatValue(d.velocity, useDollars)}</strong> ({d.productCount} SKUs)
                    </p>
                    <p style={{ margin: '3px 0', fontSize: '12px', color: '#444' }}>
                      {curColLabel}: {formatValue(d.primaryVal, useDollars)}
                    </p>
                    {d.pyVal > 0 && (
                      <p style={{ margin: '3px 0', fontSize: '12px', color: '#444' }}>
                        {pyLabel}: {formatValue(d.pyVal, useDollars)}
                      </p>
                    )}
                    <p style={{ margin: '3px 0', fontSize: '12px', color: '#444' }}>
                      {yepLabel}: {formatValue(d.yepVal, useDollars)}
                    </p>
                    {hasComparison && (
                      <p style={{ margin: '3px 0', fontSize: '12px', fontWeight: 600, color: pctColor(d.yoyChange) }}>
                        YoY: {fmtPct(d.yoyChange)}
                      </p>
                    )}
                    {d.pacePct != null && (
                      <p style={{ margin: '3px 0', fontSize: '12px', fontWeight: 600, color: pctColor(d.pacePct) }}>
                        Pace: {fmtPct(d.pacePct)}
                      </p>
                    )}
                  </div>
                );
              }} />
              <Bar dataKey="velocity" name="Avg / SKU" radius={[0, 4, 4, 0]}>
                {velocityBarData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Charts Row: Pie + YoY Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Pie Chart */}
        <div style={{
          backgroundColor: '#fff',
          borderRadius: '12px',
          border: '1px solid #e0e0e0',
          padding: '24px'
        }}>
          <h3 style={{ margin: '0 0 20px', color: theme.colors.secondary, fontSize: '16px' }}>
            {metricLabel} Share by Category
          </h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  outerRadius={110}
                  innerRadius={50}
                  dataKey="value"
                  nameKey="name"
                  paddingAngle={2}
                  label={({ name, percent }) =>
                    `${name.length > 12 ? name.substring(0, 12) + '...' : name} ${(percent * 100).toFixed(0)}%`
                  }
                  labelLine={{ stroke: '#ccc' }}
                >
                  {pieData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<PieTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p style={{ textAlign: 'center', color: '#999', padding: '40px 0' }}>No data available</p>
          )}
        </div>

        {/* YoY Bar Chart */}
        <div style={{
          backgroundColor: '#fff',
          borderRadius: '12px',
          border: '1px solid #e0e0e0',
          padding: '24px'
        }}>
          <h3 style={{ margin: '0 0 20px', color: theme.colors.secondary, fontSize: '16px' }}>
            Year-over-Year Change by Category
          </h3>
          {hasComparison && yoyBarData.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={yoyBarData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: '#666' }}
                  axisLine={{ stroke: '#ccc' }}
                  interval={0}
                  angle={-25}
                  textAnchor="end"
                  height={60}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: '#666' }}
                  axisLine={{ stroke: '#ccc' }}
                  tickFormatter={val => `${val}%`}
                />
                <Tooltip content={<YoYTooltip />} />
                <Bar dataKey="yoy" name="YoY %" radius={[4, 4, 0, 0]}>
                  {yoyBarData.map((entry, idx) => (
                    <Cell
                      key={idx}
                      fill={entry.yoy >= 0 ? theme.colors.success : theme.colors.danger}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p style={{ textAlign: 'center', color: '#999', padding: '40px 0' }}>
              {hasComparison ? 'No YoY data available' : 'No year-ago data for comparison'}
            </p>
          )}
        </div>
      </div>

      {/* Stacked Area Trend Chart */}
      {trendChartData.length > 0 && trendCategories.length > 0 && (
        <div style={{
          backgroundColor: '#fff',
          borderRadius: '12px',
          border: '1px solid #e0e0e0',
          padding: '24px'
        }}>
          <h3 style={{ margin: '0 0 20px', color: theme.colors.secondary, fontSize: '16px' }}>
            Category {metricLabel} Trends Over Time
          </h3>
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={trendChartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 12, fill: '#666' }}
                axisLine={{ stroke: '#ccc' }}
              />
              <YAxis
                tick={{ fontSize: 12, fill: '#666' }}
                axisLine={{ stroke: '#ccc' }}
                tickFormatter={(val) => formatValue(val, useDollars)}
              />
              <Tooltip content={<ChartTooltip />} />
              <Legend />
              {trendCategories.map((cat, idx) => (
                <Area
                  key={cat}
                  type="monotone"
                  dataKey={cat}
                  name={cat}
                  stackId="1"
                  stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                  fill={CHART_COLORS[idx % CHART_COLORS.length]}
                  fillOpacity={0.6}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

const thStyle = {
  padding: '10px 16px',
  textAlign: 'left',
  fontWeight: 600,
  color: '#555',
  borderBottom: '2px solid #e0e0e0',
  fontSize: '12px',
  textTransform: 'uppercase',
  letterSpacing: '0.5px'
};

const tdStyle = {
  padding: '10px 16px',
  color: '#333',
  fontSize: '13px'
};

export default CategoryAnalytics;
