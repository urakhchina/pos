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
import { formatValue, periodToMonthName } from '../utils/timePeriodUtils';
import { useResponsive } from '../hooks/useResponsive';

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

const normalizeBrand = (raw) => {
  const u = (raw || '').trim().toUpperCase();
  if (u.includes('IRWIN')) return 'Irwin Naturals';
  if (u.includes('APPLIED')) return 'Applied Nutrition';
  if (u.includes('SECRET') || u.includes('NATURES')) return "Nature's Secret";
  if (u.includes('INHOLTRA')) return 'Inholtra';
  if (!u || u === 'NAN') return 'Other';
  return raw.trim();
};

function sortItems(items, field, dir) {
  return [...items].sort((a, b) => {
    let aVal = a[field], bVal = b[field];
    if (typeof aVal === 'string') { aVal = aVal.toLowerCase(); bVal = (bVal || '').toLowerCase(); return dir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal); }
    return dir === 'asc' ? (aVal || 0) - (bVal || 0) : (bVal || 0) - (aVal || 0);
  });
}

const SortIndicator = ({ field, sortState }) => {
  if (sortState.field !== field) return null;
  return <span style={{ marginLeft: '4px' }}>{sortState.dir === 'asc' ? '\u25B2' : '\u25BC'}</span>;
};

const BrandPerformance = ({
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
  const [selectedBrand, setSelectedBrand] = useState(null);
  const [brandCatSort, setBrandCatSort] = useState({ field: 'curVal', dir: 'desc' });
  const [brandProdSort, setBrandProdSort] = useState({ field: 'curVal', dir: 'desc' });

  const toggleSort = (setter, current, field) => {
    if (current.field === field) {
      setter({ field, dir: current.dir === 'asc' ? 'desc' : 'asc' });
    } else {
      setter({ field, dir: 'desc' });
    }
  };

  const { isMobile } = useResponsive();
  const thStyleR = isMobile ? { ...thStyle, padding: '6px 8px', fontSize: '11px' } : thStyle;
  const tdStyleR = isMobile ? { ...tdStyle, padding: '6px 8px', fontSize: '12px' } : tdStyle;

  const useDollars = primaryMetric === 'dollars';
  const metricKey = useDollars ? 'dollars' : 'units';
  const metricLabel = useDollars ? 'Dollars' : 'Units';

  const pctColor = (val) => val == null ? '#999' : val >= 0 ? '#2e7d32' : '#c62828';
  const fmtPct = (val) => val == null ? '\u2014' : `${val >= 0 ? '+' : ''}${val.toFixed(1)}%`;

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

  // Build product lookup map with normalized brand
  const productMap = useMemo(() => {
    const map = {};
    if (posData?.products) {
      posData.products.forEach(p => {
        map[p.upc] = { ...p, normalizedBrand: normalizeBrand(p.brand) };
      });
    }
    return map;
  }, [posData]);

  // Aggregate by brand — include ALL products
  const brandData = useMemo(() => {
    if (Object.keys(productMap).length === 0) return {};

    const brands = {};

    Object.values(productMap).forEach(product => {
      const brand = product.normalizedBrand;
      const upc = product.upc;

      if (!brands[brand]) {
        brands[brand] = {
          name: brand,
          dollars: 0,
          units: 0,
          productCount: 0,
          categories: {},
          products: []
        };
      }

      const data = currentData?.[upc];
      const dollars = data?.dollars || 0;
      const units = data?.units || 0;

      brands[brand].dollars += dollars;
      brands[brand].units += units;
      brands[brand].productCount += 1;
      brands[brand].products.push({
        upc,
        name: product.product_name || upc,
        dollars,
        units,
        category: product.category || 'Unknown'
      });

      const category = product.category || 'Unknown';
      if (!brands[brand].categories[category]) {
        brands[brand].categories[category] = {
          name: category,
          dollars: 0,
          units: 0,
          productCount: 0
        };
      }
      brands[brand].categories[category].dollars += dollars;
      brands[brand].categories[category].units += units;
      brands[brand].categories[category].productCount += 1;
    });

    return brands;
  }, [currentData, productMap]);

  // Aggregate comparisonData by brand for YoY
  const brandCompData = useMemo(() => {
    if (!comparisonData || Object.keys(productMap).length === 0) return {};

    const brands = {};
    Object.entries(comparisonData).forEach(([upc, data]) => {
      const product = productMap[upc];
      const brand = product?.normalizedBrand || 'Other';

      if (!brands[brand]) {
        brands[brand] = { dollars: 0, units: 0 };
      }
      brands[brand].dollars += data.dollars || 0;
      brands[brand].units += data.units || 0;
    });

    return brands;
  }, [comparisonData, productMap]);

  // Aggregate priorSequentialData by brand
  const brandSeqData = useMemo(() => {
    if (!priorSequentialData || Object.keys(productMap).length === 0) return {};
    const brands = {};
    Object.entries(priorSequentialData).forEach(([upc, data]) => {
      const product = productMap[upc];
      const brand = product?.normalizedBrand || 'Other';
      if (!brands[brand]) brands[brand] = { dollars: 0, units: 0 };
      brands[brand].dollars += data.dollars || 0;
      brands[brand].units += data.units || 0;
    });
    return brands;
  }, [priorSequentialData, productMap]);

  // Aggregate fullPriorYearProductData by brand
  const brandPYData = useMemo(() => {
    if (!fullPriorYearProductData || Object.keys(productMap).length === 0) return {};
    const brands = {};
    Object.entries(fullPriorYearProductData).forEach(([upc, data]) => {
      const product = productMap[upc];
      const brand = product?.normalizedBrand || 'Other';
      if (!brands[brand]) brands[brand] = { dollars: 0, units: 0 };
      brands[brand].dollars += data.dollars || 0;
      brands[brand].units += data.units || 0;
    });
    return brands;
  }, [fullPriorYearProductData, productMap]);

  // Build brand list with YoY, seq%, pace%
  const brands = useMemo(() => {
    const allBrands = new Set([
      ...Object.keys(brandData),
      ...Object.keys(brandCompData)
    ]);

    return Array.from(allBrands).map(brand => {
      const current = brandData[brand] || { dollars: 0, units: 0, productCount: 0, categories: {}, products: [] };
      const comp = brandCompData[brand] || { dollars: 0, units: 0 };
      const seq = brandSeqData[brand] || { dollars: 0, units: 0 };
      const py = brandPYData[brand] || { dollars: 0, units: 0 };

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
        name: brand,
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
        categories: current.categories,
        products: current.products
      };
    }).sort((a, b) => b.primaryVal - a.primaryVal);
  }, [brandData, brandCompData, brandSeqData, brandPYData, metricKey, yepMultiplier]);

  // Velocity bar chart data
  const velocityBarData = useMemo(() => {
    return brands
      .filter(b => b.primaryVal > 0 && b.productCount > 0)
      .map((b, idx) => ({
        name: b.name.length > 18 ? b.name.substring(0, 18) + '...' : b.name,
        fullName: b.name,
        velocity: parseFloat((b.primaryVal / b.productCount).toFixed(2)),
        color: CHART_COLORS[idx % CHART_COLORS.length],
        productCount: b.productCount,
        primaryVal: b.primaryVal,
        pyVal: b.pyVal,
        yepVal: b.yepVal,
        yoyChange: b.yoyChange,
        pacePct: b.pacePct,
      }))
      .sort((a, b) => b.velocity - a.velocity);
  }, [brands]);

  // Pie chart data
  const pieData = useMemo(() => {
    return brands.map((b, idx) => ({
      name: b.name,
      value: b.primaryVal,
      color: CHART_COLORS[idx % CHART_COLORS.length]
    })).filter(d => d.value > 0);
  }, [brands]);

  // YoY bar chart data
  const yoyBarData = useMemo(() => {
    return brands
      .filter(b => b.compVal > 0 || b.primaryVal > 0)
      .map(b => ({
        name: b.name.length > 18 ? b.name.substring(0, 18) + '...' : b.name,
        fullName: b.name,
        yoy: parseFloat(b.yoyChange.toFixed(1))
      }));
  }, [brands]);

  // Stacked area trend data
  const trendChartData = useMemo(() => {
    if (!trendData || trendData.length === 0 || !posData?.periods || Object.keys(productMap).length === 0) return [];

    const brandNames = brands.map(b => b.name);

    const rows = trendData.map(entry => {
      const periodKey = entry.period;
      const periodData = posData.periods?.[periodKey];
      const row = { label: entry.label || periodKey, period: periodKey };

      brandNames.forEach(brand => { row[brand] = 0; });

      if (periodData) {
        Object.entries(periodData).forEach(([upc, data]) => {
          const product = productMap[upc];
          const brand = product?.normalizedBrand || 'Other';
          if (row[brand] !== undefined) {
            row[brand] += data[metricKey] || 0;
          } else {
            row[brand] = data[metricKey] || 0;
          }
        });
      }

      return row;
    });

    rows.sort((a, b) => String(a.period).localeCompare(String(b.period)));
    return rows;
  }, [trendData, posData, productMap, brands, metricKey]);

  // Brands actually present in trend data
  const trendBrands = useMemo(() => {
    if (trendChartData.length === 0) return [];
    const brandNames = brands.map(b => b.name);
    return brandNames.filter(brand =>
      trendChartData.some(row => (row[brand] || 0) > 0)
    );
  }, [trendChartData, brands]);

  // Drilldown: categories + products within selected brand
  const drilldownEnrichedData = useMemo(() => {
    if (!selectedBrand) return { cats: [], products: [] };
    const brand = brands.find(b => b.name === selectedBrand);
    if (!brand) return { cats: [], products: [] };

    const aggregateByCat = (upcData) => {
      const result = {};
      if (!upcData) return result;
      Object.entries(upcData).forEach(([upc, data]) => {
        const product = productMap[upc];
        if (!product || product.normalizedBrand !== selectedBrand) return;
        const cat = product.category || 'Unknown';
        if (!result[cat]) result[cat] = { dollars: 0, units: 0 };
        result[cat].dollars += data.dollars || 0;
        result[cat].units += data.units || 0;
      });
      return result;
    };

    const compByCat = aggregateByCat(comparisonData);
    const seqByCat = aggregateByCat(priorSequentialData);
    const pyByCat = aggregateByCat(fullPriorYearProductData);

    const cats = Object.values(brand.categories).map(cat => {
      const curVal = cat[metricKey] || 0;
      const compVal = compByCat[cat.name]?.[metricKey] || 0;
      const seqVal = seqByCat[cat.name]?.[metricKey] || 0;
      const pyVal = pyByCat[cat.name]?.[metricKey] || 0;
      const yepVal = curVal * yepMultiplier;
      const yoyPct = compVal > 0 ? ((curVal - compVal) / compVal) * 100 : (curVal > 0 ? 100 : 0);
      const seqPct = seqVal > 0 ? ((curVal - seqVal) / seqVal) * 100 : null;
      const pacePct = pyVal > 0 ? ((yepVal - pyVal) / pyVal) * 100 : null;
      return { ...cat, curVal, compVal, seqVal, pyVal, yepVal, seqPct, yoyPct, pacePct };
    }).sort((a, b) => b.curVal - a.curVal);

    const products = [...brand.products].map(p => {
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

    return { cats, products };
  }, [selectedBrand, brands, comparisonData, priorSequentialData, fullPriorYearProductData, productMap, metricKey, useDollars, yepMultiplier]);

  const totalPrimaryVal = brands.reduce((sum, b) => sum + b.primaryVal, 0);
  const hasComparison = comparisonData && Object.keys(comparisonData).length > 0;

  // Tooltips
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

  // ── Drilldown View ────────────────────────────────────────────────
  if (selectedBrand) {
    const brand = brands.find(b => b.name === selectedBrand);
    if (!brand) {
      setSelectedBrand(null);
      return null;
    }

    const { cats, products: brandProducts } = drilldownEnrichedData;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Back button */}
        <button
          onClick={() => setSelectedBrand(null)}
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
          Back to All Brands
        </button>

        {/* Brand header */}
        <div style={{
          backgroundColor: '#fff',
          borderRadius: '12px',
          border: '1px solid #e0e0e0',
          padding: '24px'
        }}>
          <h2 style={{ margin: '0 0 8px', color: theme.colors.secondary, fontSize: isMobile ? '18px' : '22px' }}>
            {brand.name}
          </h2>
          <div style={{ display: 'flex', gap: isMobile ? '16px' : '32px', flexWrap: 'wrap' }}>
            <div>
              <span style={{ fontSize: '12px', color: '#999', textTransform: 'uppercase', fontWeight: 600 }}>
                {curColLabel}
              </span>
              <p style={{ margin: '4px 0 0', fontSize: isMobile ? '18px' : '24px', fontWeight: 700, color: theme.colors.primary }}>
                {formatValue(brand.primaryVal, useDollars)}
              </p>
            </div>
            <div>
              <span style={{ fontSize: '12px', color: '#999', textTransform: 'uppercase', fontWeight: 600 }}>
                Products
              </span>
              <p style={{ margin: '4px 0 0', fontSize: isMobile ? '18px' : '24px', fontWeight: 700, color: theme.colors.secondary }}>
                {brand.productCount}
              </p>
            </div>
            {hasPY && (
              <div>
                <span style={{ fontSize: '12px', color: '#999', textTransform: 'uppercase', fontWeight: 600 }}>
                  {pyLabel}
                </span>
                <p style={{ margin: '4px 0 0', fontSize: isMobile ? '18px' : '24px', fontWeight: 700, color: theme.colors.secondary }}>
                  {formatValue(brand.pyVal, useDollars)}
                </p>
              </div>
            )}
            <div>
              <span style={{ fontSize: '12px', color: '#999', textTransform: 'uppercase', fontWeight: 600 }}>
                {yepLabel}
              </span>
              <p style={{ margin: '4px 0 0', fontSize: isMobile ? '18px' : '24px', fontWeight: 700, color: theme.colors.secondary }}>
                {formatValue(brand.yepVal, useDollars)}
              </p>
            </div>
            {hasComparison && (
              <div>
                <span style={{ fontSize: '12px', color: '#999', textTransform: 'uppercase', fontWeight: 600 }}>
                  YoY
                </span>
                <p style={{
                  margin: '4px 0 0',
                  fontSize: isMobile ? '18px' : '24px',
                  fontWeight: 700,
                  color: brand.yoyChange >= 0 ? theme.colors.success : theme.colors.danger
                }}>
                  {fmtPct(brand.yoyChange)}
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
                  fontSize: isMobile ? '18px' : '24px',
                  fontWeight: 700,
                  color: pctColor(brand.pacePct)
                }}>
                  {fmtPct(brand.pacePct)}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Categories within brand */}
        {cats.length > 0 && (
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
                Categories
              </h3>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8f9fa' }}>
                    <th style={thStyleR} onClick={() => toggleSort(setBrandCatSort, brandCatSort, 'name')}>Category<SortIndicator field="name" sortState={brandCatSort} /></th>
                    <th style={{ ...thStyleR, textAlign: 'right' }} onClick={() => toggleSort(setBrandCatSort, brandCatSort, 'compVal')}>{yagoColLabel}<SortIndicator field="compVal" sortState={brandCatSort} /></th>
                    {hasSeq && seqColLabel && <th style={{ ...thStyleR, textAlign: 'right' }} onClick={() => toggleSort(setBrandCatSort, brandCatSort, 'seqVal')}>{seqColLabel}<SortIndicator field="seqVal" sortState={brandCatSort} /></th>}
                    <th style={{ ...thStyleR, textAlign: 'right' }} onClick={() => toggleSort(setBrandCatSort, brandCatSort, 'curVal')}>{curColLabel}<SortIndicator field="curVal" sortState={brandCatSort} /></th>
                    {hasPY && <th style={{ ...thStyleR, textAlign: 'right' }} onClick={() => toggleSort(setBrandCatSort, brandCatSort, 'pyVal')}>{pyLabel}<SortIndicator field="pyVal" sortState={brandCatSort} /></th>}
                    <th style={{ ...thStyleR, textAlign: 'right' }} onClick={() => toggleSort(setBrandCatSort, brandCatSort, 'yepVal')}>{yepLabel}<SortIndicator field="yepVal" sortState={brandCatSort} /></th>
                    <th style={{ ...thStyleR, textAlign: 'right' }} onClick={() => toggleSort(setBrandCatSort, brandCatSort, 'productCount')}>Products<SortIndicator field="productCount" sortState={brandCatSort} /></th>
                    {hasSeq && seqPctLabel && <th style={{ ...thStyleR, textAlign: 'right' }} onClick={() => toggleSort(setBrandCatSort, brandCatSort, 'seqPct')}>{seqPctLabel}<SortIndicator field="seqPct" sortState={brandCatSort} /></th>}
                    <th style={{ ...thStyleR, textAlign: 'right' }} onClick={() => toggleSort(setBrandCatSort, brandCatSort, 'yoyPct')}>YoY%<SortIndicator field="yoyPct" sortState={brandCatSort} /></th>
                    {hasPY && <th style={{ ...thStyleR, textAlign: 'right' }} onClick={() => toggleSort(setBrandCatSort, brandCatSort, 'pacePct')}>Pace%<SortIndicator field="pacePct" sortState={brandCatSort} /></th>}
                  </tr>
                </thead>
                <tbody>
                  {sortItems(cats, brandCatSort.field, brandCatSort.dir).map((cat, idx) => (
                    <tr key={cat.name} style={{
                      backgroundColor: idx % 2 === 0 ? '#fff' : '#f8f9fa',
                      borderBottom: '1px solid #eee'
                    }}>
                      <td style={tdStyleR}>{cat.name}</td>
                      <td style={{ ...tdStyleR, textAlign: 'right' }}>{formatValue(cat.compVal, useDollars)}</td>
                      {hasSeq && seqColLabel && (
                        <td style={{ ...tdStyleR, textAlign: 'right' }}>{formatValue(cat.seqVal, useDollars)}</td>
                      )}
                      <td style={{ ...tdStyleR, textAlign: 'right', fontWeight: 600 }}>{formatValue(cat.curVal, useDollars)}</td>
                      {hasPY && <td style={{ ...tdStyleR, textAlign: 'right' }}>{cat.pyVal > 0 ? formatValue(cat.pyVal, useDollars) : '\u2014'}</td>}
                      <td style={{ ...tdStyleR, textAlign: 'right' }}>{formatValue(cat.yepVal, useDollars)}</td>
                      <td style={{ ...tdStyleR, textAlign: 'right' }}>{cat.productCount}</td>
                      {hasSeq && seqPctLabel && (
                        <td style={{ ...tdStyleR, textAlign: 'right', fontWeight: 600, color: pctColor(cat.seqPct) }}>
                          {fmtPct(cat.seqPct)}
                        </td>
                      )}
                      <td style={{ ...tdStyleR, textAlign: 'right', fontWeight: 600, color: pctColor(cat.yoyPct) }}>
                        {fmtPct(cat.yoyPct)}
                      </td>
                      {hasPY && (
                        <td style={{ ...tdStyleR, textAlign: 'right', fontWeight: 600, color: pctColor(cat.pacePct) }}>
                          {fmtPct(cat.pacePct)}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Products in brand */}
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
              Products ({brandProducts.length})
            </h3>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8f9fa' }}>
                  <th style={thStyleR} onClick={() => toggleSort(setBrandProdSort, brandProdSort, 'name')}>Product<SortIndicator field="name" sortState={brandProdSort} /></th>
                  <th style={thStyleR} onClick={() => toggleSort(setBrandProdSort, brandProdSort, 'category')}>Category<SortIndicator field="category" sortState={brandProdSort} /></th>
                  <th style={{ ...thStyleR, textAlign: 'right' }} onClick={() => toggleSort(setBrandProdSort, brandProdSort, 'compVal')}>{yagoColLabel}<SortIndicator field="compVal" sortState={brandProdSort} /></th>
                  {hasSeq && seqColLabel && <th style={{ ...thStyleR, textAlign: 'right' }} onClick={() => toggleSort(setBrandProdSort, brandProdSort, 'seqVal')}>{seqColLabel}<SortIndicator field="seqVal" sortState={brandProdSort} /></th>}
                  <th style={{ ...thStyleR, textAlign: 'right' }} onClick={() => toggleSort(setBrandProdSort, brandProdSort, 'curVal')}>{curColLabel}<SortIndicator field="curVal" sortState={brandProdSort} /></th>
                  {hasPY && <th style={{ ...thStyleR, textAlign: 'right' }} onClick={() => toggleSort(setBrandProdSort, brandProdSort, 'pyVal')}>{pyLabel}<SortIndicator field="pyVal" sortState={brandProdSort} /></th>}
                  <th style={{ ...thStyleR, textAlign: 'right' }} onClick={() => toggleSort(setBrandProdSort, brandProdSort, 'yepVal')}>{yepLabel}<SortIndicator field="yepVal" sortState={brandProdSort} /></th>
                  {hasSeq && seqPctLabel && <th style={{ ...thStyleR, textAlign: 'right' }} onClick={() => toggleSort(setBrandProdSort, brandProdSort, 'seqPct')}>{seqPctLabel}<SortIndicator field="seqPct" sortState={brandProdSort} /></th>}
                  <th style={{ ...thStyleR, textAlign: 'right' }} onClick={() => toggleSort(setBrandProdSort, brandProdSort, 'yoyPct')}>YoY%<SortIndicator field="yoyPct" sortState={brandProdSort} /></th>
                  {hasPY && <th style={{ ...thStyleR, textAlign: 'right' }} onClick={() => toggleSort(setBrandProdSort, brandProdSort, 'pacePct')}>Pace%<SortIndicator field="pacePct" sortState={brandProdSort} /></th>}
                </tr>
              </thead>
              <tbody>
                {sortItems(brandProducts, brandProdSort.field, brandProdSort.dir).map((p, idx) => (
                  <tr key={p.upc} style={{
                    backgroundColor: idx % 2 === 0 ? '#fff' : '#f8f9fa',
                    borderBottom: '1px solid #eee'
                  }}>
                    <td style={{
                      ...tdStyleR,
                      maxWidth: '250px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontWeight: 500
                    }}>
                      {p.name}
                    </td>
                    <td style={tdStyleR}>
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        backgroundColor: '#f0f0f0',
                        fontSize: '12px'
                      }}>
                        {p.category}
                      </span>
                    </td>
                    <td style={{ ...tdStyleR, textAlign: 'right' }}>{formatValue(p.compVal, useDollars)}</td>
                    {hasSeq && seqColLabel && (
                      <td style={{ ...tdStyleR, textAlign: 'right' }}>{formatValue(p.seqVal, useDollars)}</td>
                    )}
                    <td style={{ ...tdStyleR, textAlign: 'right', fontWeight: 600 }}>{formatValue(p.curVal, useDollars)}</td>
                    {hasPY && <td style={{ ...tdStyleR, textAlign: 'right' }}>{p.pyVal > 0 ? formatValue(p.pyVal, useDollars) : '\u2014'}</td>}
                    <td style={{ ...tdStyleR, textAlign: 'right' }}>{formatValue(p.yepVal, useDollars)}</td>
                    {hasSeq && seqPctLabel && (
                      <td style={{ ...tdStyleR, textAlign: 'right', fontWeight: 600, color: pctColor(p.seqPct) }}>
                        {fmtPct(p.seqPct)}
                      </td>
                    )}
                    <td style={{ ...tdStyleR, textAlign: 'right', fontWeight: 600, color: pctColor(p.yoyPct) }}>
                      {fmtPct(p.yoyPct)}
                    </td>
                    {hasPY && (
                      <td style={{ ...tdStyleR, textAlign: 'right', fontWeight: 600, color: pctColor(p.pacePct) }}>
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

  // ── Main brand overview ───────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Brand Cards Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(auto-fill, minmax(150px, 1fr))' : 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: '16px'
      }}>
        {brands.map((brand, idx) => {
          const share = totalPrimaryVal > 0
            ? ((brand.primaryVal / totalPrimaryVal) * 100).toFixed(1)
            : '0.0';
          return (
            <div
              key={brand.name}
              onClick={() => setSelectedBrand(brand.name)}
              style={{
                backgroundColor: '#fff',
                borderRadius: '12px',
                border: '1px solid #e0e0e0',
                padding: isMobile ? '12px' : '20px',
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
                {brand.name}
              </h4>
              <p style={{
                margin: '0 0 8px',
                fontSize: isMobile ? '18px' : '24px',
                fontWeight: 700,
                color: theme.colors.primary
              }}>
                {formatValue(brand.primaryVal, useDollars)}
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#666' }}>
                <span>{brand.productCount} product{brand.productCount !== 1 ? 's' : ''}</span>
                <span>{share}% share</span>
              </div>
              {(hasPY || brand.yepVal > 0) && (
                <div style={{ display: 'flex', gap: '16px', marginTop: '8px', fontSize: '11px', color: '#666' }}>
                  {hasPY && <span>{pyLabel}: {formatValue(brand.pyVal, useDollars)}</span>}
                  <span>{yepLabel}: {formatValue(brand.yepVal, useDollars)}</span>
                </div>
              )}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                {hasComparison && (
                  <div style={{
                    padding: '4px 8px',
                    borderRadius: '6px',
                    backgroundColor: brand.yoyChange >= 0 ? `${theme.colors.success}15` : `${theme.colors.danger}15`,
                    display: 'inline-block'
                  }}>
                    <span style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: brand.yoyChange >= 0 ? theme.colors.success : theme.colors.danger
                    }}>
                      {fmtPct(brand.yoyChange)} YoY
                    </span>
                  </div>
                )}
                {hasPY && brand.pacePct != null && (
                  <div style={{
                    padding: '4px 8px',
                    borderRadius: '6px',
                    backgroundColor: brand.pacePct >= 0 ? `${theme.colors.success}15` : `${theme.colors.danger}15`,
                    display: 'inline-block'
                  }}>
                    <span style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: pctColor(brand.pacePct)
                    }}>
                      {fmtPct(brand.pacePct)} Pace
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Velocity by Brand — horizontal bar chart */}
      {velocityBarData.length > 0 && (
        <div style={{
          backgroundColor: '#fff',
          borderRadius: '12px',
          border: '1px solid #e0e0e0',
          padding: '24px'
        }}>
          <h3 style={{ margin: '0 0 20px', color: theme.colors.secondary, fontSize: '16px' }}>
            Avg {metricLabel} per SKU by Brand
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
                width={isMobile ? 90 : 160}
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
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '24px' }}>
        {/* Pie Chart */}
        <div style={{
          backgroundColor: '#fff',
          borderRadius: '12px',
          border: '1px solid #e0e0e0',
          padding: '24px'
        }}>
          <h3 style={{ margin: '0 0 20px', color: theme.colors.secondary, fontSize: '16px' }}>
            {metricLabel} Share by Brand
          </h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={isMobile ? 250 : 320}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  outerRadius={isMobile ? 80 : 110}
                  innerRadius={50}
                  dataKey="value"
                  nameKey="name"
                  paddingAngle={2}
                  label={isMobile ? false : ({name, percent}) => `${name.length > 12 ? name.substring(0, 12) + '...' : name} ${(percent * 100).toFixed(0)}%`}
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
            Year-over-Year Change by Brand
          </h3>
          {hasComparison && yoyBarData.length > 0 ? (
            <ResponsiveContainer width="100%" height={isMobile ? 250 : 320}>
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
      {trendChartData.length > 0 && trendBrands.length > 0 && (
        <div style={{
          backgroundColor: '#fff',
          borderRadius: '12px',
          border: '1px solid #e0e0e0',
          padding: '24px'
        }}>
          <h3 style={{ margin: '0 0 20px', color: theme.colors.secondary, fontSize: '16px' }}>
            Brand {metricLabel} Trends Over Time
          </h3>
          <ResponsiveContainer width="100%" height={isMobile ? 280 : 400}>
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
                width={isMobile ? 50 : undefined}
              />
              <Tooltip content={<ChartTooltip />} />
              <Legend />
              {trendBrands.map((brand, idx) => (
                <Area
                  key={brand}
                  type="monotone"
                  dataKey={brand}
                  name={brand}
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
  letterSpacing: '0.5px',
  cursor: 'pointer',
  userSelect: 'none'
};

const tdStyle = {
  padding: '10px 16px',
  color: '#333',
  fontSize: '13px'
};

export default BrandPerformance;
