import React, { useMemo, useState } from 'react';
import { theme } from '../styles/theme';
import { getSortedPeriods } from '../utils/timePeriodUtils';
import { MapPin, ChevronUp, ChevronDown } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
} from 'recharts';

export default function DistributionACV({ posData }) {
  const [sortCol, setSortCol] = useState('acv');
  const [sortDir, setSortDir] = useState('desc');

  const skuData = useMemo(() => {
    if (!posData || !posData.products || !posData.periods) return [];

    const periods = getSortedPeriods(posData.periods);
    if (periods.length === 0) return [];

    // Use latest period data
    const latestKey = periods[periods.length - 1];
    const latestPeriod = posData.periods[latestKey] || {};

    return posData.products
      .map(p => {
        const metrics = latestPeriod[p.upc] || {};
        return {
          upc: p.upc,
          name: p.product_name || p.upc,
          brand: p.brand || '',
          category: p.category || '',
          acv: metrics.acv != null ? metrics.acv : (p.acv != null ? p.acv : null),
          storeCount: metrics.store_count != null ? metrics.store_count : (p.store_count != null ? p.store_count : null),
          dollars: metrics.dollars || 0,
        };
      })
      .filter(p => p.acv != null || p.storeCount != null);
  }, [posData]);

  const sortedData = useMemo(() => {
    const result = [...skuData];
    result.sort((a, b) => {
      let aVal = a[sortCol];
      let bVal = b[sortCol];
      if (aVal == null) aVal = -Infinity;
      if (bVal == null) bVal = -Infinity;
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });
    return result;
  }, [skuData, sortCol, sortDir]);

  // Chart data: top 20 by ACV
  const chartData = useMemo(() => {
    return [...skuData]
      .filter(s => s.acv != null)
      .sort((a, b) => b.acv - a.acv)
      .slice(0, 20)
      .map(s => ({
        name: s.name.length > 25 ? s.name.slice(0, 22) + '...' : s.name,
        acv: s.acv,
        storeCount: s.storeCount,
      }));
  }, [skuData]);

  if (skuData.length === 0) {
    return (
      <div style={{ padding: theme.spacing.xl, textAlign: 'center', color: theme.colors.textLight }}>
        No distribution or ACV data available for this retailer.
      </div>
    );
  }

  const handleSort = col => {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('desc');
    }
  };

  const SortIcon = ({ col }) => {
    if (sortCol !== col) return null;
    return sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
  };

  // Summary
  const avgAcv = skuData.filter(s => s.acv != null).reduce((s, d) => s + d.acv, 0) / skuData.filter(s => s.acv != null).length;
  const maxStores = Math.max(...skuData.filter(s => s.storeCount != null).map(s => s.storeCount), 0);

  const thStyle = {
    textAlign: 'left',
    padding: `${theme.spacing.sm} ${theme.spacing.sm}`,
    borderBottom: `2px solid ${theme.colors.border}`,
    fontWeight: 600,
    color: theme.colors.secondary,
    fontSize: '0.72rem',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
    fontFamily: theme.fonts.body,
    cursor: 'pointer',
    userSelect: 'none',
    whiteSpace: 'nowrap',
  };
  const tdStyle = {
    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
    borderBottom: `1px solid ${theme.colors.border}`,
    color: theme.colors.text,
    fontFamily: theme.fonts.body,
    fontSize: '0.82rem',
  };

  return (
    <div>
      <h2
        style={{
          fontFamily: theme.fonts.heading,
          fontSize: '1.3rem',
          color: theme.colors.secondary,
          marginBottom: theme.spacing.lg,
        }}
      >
        Distribution / ACV
      </h2>

      {/* Summary */}
      <div
        style={{
          display: 'flex',
          gap: theme.spacing.lg,
          marginBottom: theme.spacing.lg,
          flexWrap: 'wrap',
        }}
      >
        {[
          { label: 'SKUs with ACV Data', value: skuData.length, color: theme.colors.primary },
          { label: 'Avg ACV %', value: `${avgAcv.toFixed(1)}%`, color: theme.colors.chartColors[1] },
          { label: 'Max Store Count', value: maxStores > 0 ? maxStores.toLocaleString() : 'N/A', color: theme.colors.chartColors[3] },
        ].map((item, i) => (
          <div
            key={i}
            style={{
              flex: '1 1 180px',
              background: theme.colors.cardBg,
              borderRadius: theme.borderRadius.md,
              boxShadow: theme.shadows.sm,
              padding: theme.spacing.lg,
              borderTop: `3px solid ${item.color}`,
            }}
          >
            <div style={{ fontFamily: theme.fonts.body, fontSize: '0.7rem', color: theme.colors.textLight, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {item.label}
            </div>
            <div style={{ fontFamily: theme.fonts.heading, fontSize: '1.4rem', fontWeight: 700, color: item.color }}>
              {item.value}
            </div>
          </div>
        ))}
      </div>

      {/* Bar chart */}
      {chartData.length > 0 && (
        <div
          style={{
            background: theme.colors.cardBg,
            borderRadius: theme.borderRadius.lg,
            boxShadow: theme.shadows.sm,
            padding: theme.spacing.xl,
            marginBottom: theme.spacing.lg,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.md }}>
            <MapPin size={16} style={{ color: theme.colors.secondary }} />
            <h3 style={{ fontFamily: theme.fonts.heading, fontSize: '1rem', color: theme.colors.secondary }}>
              ACV % by SKU (Top 20)
            </h3>
          </div>
          <ResponsiveContainer width="100%" height={Math.max(300, chartData.length * 30)}>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 140, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={theme.colors.border} horizontal={false} />
              <XAxis
                type="number"
                domain={[0, 100]}
                tickFormatter={v => `${v}%`}
                tick={{ fontFamily: theme.fonts.body, fontSize: 11, fill: theme.colors.textLight }}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontFamily: theme.fonts.body, fontSize: 10, fill: theme.colors.textLight }}
                width={135}
              />
              <Tooltip
                contentStyle={{
                  fontFamily: theme.fonts.body,
                  fontSize: '0.82rem',
                  borderRadius: theme.borderRadius.md,
                  border: `1px solid ${theme.colors.border}`,
                }}
                formatter={(value, name) => {
                  if (name === 'ACV %') return [`${value.toFixed(1)}%`, name];
                  return [value, name];
                }}
              />
              <Bar dataKey="acv" name="ACV %" radius={[0, 3, 3, 0]}>
                {chartData.map((entry, index) => (
                  <Cell
                    key={index}
                    fill={entry.acv >= 70 ? theme.colors.success : entry.acv >= 40 ? theme.colors.warning : theme.colors.danger}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Table */}
      <div
        style={{
          background: theme.colors.cardBg,
          borderRadius: theme.borderRadius.lg,
          boxShadow: theme.shadows.sm,
          overflow: 'hidden',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle} onClick={() => handleSort('name')}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>Product <SortIcon col="name" /></span>
                </th>
                <th style={{ ...thStyle, textAlign: 'right' }} onClick={() => handleSort('acv')}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, justifyContent: 'flex-end' }}>ACV % <SortIcon col="acv" /></span>
                </th>
                <th style={{ ...thStyle, textAlign: 'right' }} onClick={() => handleSort('storeCount')}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, justifyContent: 'flex-end' }}>Stores <SortIcon col="storeCount" /></span>
                </th>
                <th style={{ ...thStyle, textAlign: 'right' }} onClick={() => handleSort('dollars')}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, justifyContent: 'flex-end' }}>Revenue <SortIcon col="dollars" /></span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedData.map((p, i) => (
                <tr key={p.upc} style={{ background: i % 2 === 0 ? 'transparent' : theme.colors.backgroundAlt }}>
                  <td style={{ ...tdStyle, maxWidth: 280 }}>
                    <div style={{ fontWeight: 500 }}>{p.name}</div>
                    <div style={{ fontSize: '0.7rem', color: theme.colors.textLight }}>
                      {p.brand && <span>{p.brand} &middot; </span>}
                      <span style={{ fontFamily: 'monospace', fontSize: '0.68rem' }}>{p.upc}</span>
                    </div>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    {p.acv != null ? (
                      <span style={{ fontWeight: 600, color: p.acv >= 70 ? theme.colors.success : p.acv >= 40 ? theme.colors.warning : theme.colors.danger }}>
                        {p.acv.toFixed(1)}%
                      </span>
                    ) : '--'}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    {p.storeCount != null ? p.storeCount.toLocaleString() : '--'}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    ${p.dollars.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
