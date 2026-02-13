import React, { useMemo, useState } from 'react';
import { theme } from '../styles/theme';
import { useResponsive } from '../hooks/useResponsive';
import { getSortedPeriods } from '../utils/timePeriodUtils';
import { XCircle, Shield, AlertTriangle } from 'lucide-react';

const STATUS_CONFIG = {
  CORE: { color: theme.colors.success, bg: '#e8f5e9', label: 'Core', icon: Shield },
  'CORE SECONDARY': { color: theme.colors.chartColors[1], bg: '#e3f2fd', label: 'Core Secondary', icon: Shield },
  'SELLABLE DISCO': { color: theme.colors.danger, bg: '#fce4ec', label: 'Sellable Disco', icon: XCircle },
  DISCO: { color: '#880e4f', bg: '#fce4ec', label: 'Discontinued', icon: XCircle },
  DISCONTINUED: { color: '#880e4f', bg: '#fce4ec', label: 'Discontinued', icon: XCircle },
  'AT RISK': { color: theme.colors.warning, bg: '#fff3e0', label: 'At Risk', icon: AlertTriangle },
};

function getStatusConfig(status) {
  if (!status) return { color: theme.colors.textLight, bg: theme.colors.backgroundAlt, label: 'Unknown', icon: AlertTriangle };
  const upper = status.toUpperCase();
  return STATUS_CONFIG[upper] || { color: theme.colors.textLight, bg: theme.colors.backgroundAlt, label: status, icon: AlertTriangle };
}

function formatDollar(val) {
  if (val >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
  if (val >= 1e3) return `$${(val / 1e3).toFixed(1)}K`;
  return `$${val.toFixed(0)}`;
}

export default function DiscontinuationRisk({ posData }) {
  const [statusFilter, setStatusFilter] = useState('all');
  const { isMobile } = useResponsive();

  const { products, statuses } = useMemo(() => {
    if (!posData || !posData.products) return { products: [], statuses: [] };

    const periods = posData.periods ? getSortedPeriods(posData.periods) : [];
    const withStatus = posData.products.filter(p => p.set_status != null);

    if (withStatus.length === 0) return { products: [], statuses: [] };

    const prods = withStatus.map(p => {
      let totalDollars = 0;
      let totalUnits = 0;
      periods.forEach(key => {
        const m = posData.periods[key]?.[p.upc];
        if (m) {
          totalDollars += m.dollars || 0;
          totalUnits += m.units || 0;
        }
      });

      return {
        upc: p.upc,
        name: p.product_name || p.upc,
        brand: p.brand || '',
        category: p.category || '',
        setStatus: p.set_status,
        config: getStatusConfig(p.set_status),
        totalDollars,
        totalUnits,
      };
    });

    // Sort: disco first, then at risk, then core
    const riskOrder = { 'SELLABLE DISCO': 0, DISCO: 0, DISCONTINUED: 0, 'AT RISK': 1, 'CORE SECONDARY': 2, CORE: 3 };
    prods.sort((a, b) => {
      const aOrder = riskOrder[a.setStatus?.toUpperCase()] ?? 1;
      const bOrder = riskOrder[b.setStatus?.toUpperCase()] ?? 1;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return b.totalDollars - a.totalDollars;
    });

    const stats = ['all', ...new Set(prods.map(p => p.setStatus))];
    return { products: prods, statuses: stats };
  }, [posData]);

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return products;
    return products.filter(p => p.setStatus === statusFilter);
  }, [products, statusFilter]);

  if (products.length === 0) {
    return (
      <div style={{ padding: theme.spacing.xl, textAlign: 'center', color: theme.colors.textLight }}>
        No set_status / discontinuation data available for this retailer.
      </div>
    );
  }

  // Status counts
  const statusCounts = {};
  products.forEach(p => {
    const s = p.setStatus || 'Unknown';
    statusCounts[s] = (statusCounts[s] || 0) + 1;
  });

  /* ── Sort state ───────────────────────────────────────────────── */
  const [sortField, setSortField] = useState('totalDollars');
  const [sortDir, setSortDir] = useState('desc');

  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  function sortItems(items, field, dir) {
    return [...items].sort((a, b) => {
      let aVal = a[field], bVal = b[field];
      if (typeof aVal === 'string') { aVal = aVal.toLowerCase(); bVal = (bVal || '').toLowerCase(); return dir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal); }
      return dir === 'asc' ? (aVal || 0) - (bVal || 0) : (bVal || 0) - (aVal || 0);
    });
  }

  const sortIndicator = (field) => sortField === field ? (sortDir === 'asc' ? ' \u25B2' : ' \u25BC') : '';

  const sorted = sortItems(filtered, sortField, sortDir);

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
  const thStyleR = isMobile ? { ...thStyle, padding: '6px 6px', fontSize: '0.65rem' } : thStyle;
  const tdStyleR = isMobile ? { ...tdStyle, padding: '4px 6px' } : tdStyle;

  return (
    <div>
      <h2
        style={{
          fontFamily: theme.fonts.heading,
          fontSize: isMobile ? '1.1rem' : '1.3rem',
          color: theme.colors.secondary,
          marginBottom: theme.spacing.lg,
        }}
      >
        Discontinuation Risk
      </h2>

      {/* Status summary cards */}
      <div
        style={{
          display: 'flex',
          gap: theme.spacing.md,
          marginBottom: theme.spacing.lg,
          flexWrap: 'wrap',
        }}
      >
        {Object.entries(statusCounts).map(([status, count]) => {
          const cfg = getStatusConfig(status);
          const Icon = cfg.icon;
          return (
            <div
              key={status}
              onClick={() => setStatusFilter(statusFilter === status ? 'all' : status)}
              style={{
                flex: '1 1 160px',
                background: statusFilter === status ? cfg.bg : theme.colors.cardBg,
                borderRadius: theme.borderRadius.md,
                boxShadow: theme.shadows.sm,
                padding: isMobile ? theme.spacing.md : theme.spacing.lg,
                borderTop: `3px solid ${cfg.color}`,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                border: statusFilter === status ? `2px solid ${cfg.color}` : `1px solid transparent`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.xs, marginBottom: theme.spacing.xs }}>
                <Icon size={16} style={{ color: cfg.color }} />
                <span style={{ fontFamily: theme.fonts.body, fontSize: '0.72rem', color: cfg.color, fontWeight: 600, textTransform: 'uppercase' }}>
                  {cfg.label}
                </span>
              </div>
              <div style={{ fontFamily: theme.fonts.heading, fontSize: '1.5rem', fontWeight: 700, color: cfg.color }}>
                {count}
              </div>
            </div>
          );
        })}
      </div>

      {/* Active filter indicator */}
      {statusFilter !== 'all' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: theme.spacing.sm,
            marginBottom: theme.spacing.md,
          }}
        >
          <span style={{ fontFamily: theme.fonts.body, fontSize: '0.82rem', color: theme.colors.textLight }}>
            Showing: <strong>{statusFilter}</strong> ({filtered.length} products)
          </span>
          <button
            onClick={() => setStatusFilter('all')}
            style={{
              padding: `2px 8px`,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: theme.borderRadius.sm,
              background: theme.colors.cardBg,
              cursor: 'pointer',
              fontFamily: theme.fonts.body,
              fontSize: '0.75rem',
              color: theme.colors.textLight,
            }}
          >
            Clear filter
          </button>
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
                <th style={thStyleR} onClick={() => handleSort('name')}>Product{sortIndicator('name')}</th>
                {!isMobile && <th style={thStyleR} onClick={() => handleSort('category')}>Category{sortIndicator('category')}</th>}
                <th style={thStyleR} onClick={() => handleSort('setStatus')}>Status{sortIndicator('setStatus')}</th>
                <th style={{ ...thStyleR, textAlign: 'right' }} onClick={() => handleSort('totalDollars')}>Total ${sortIndicator('totalDollars')}</th>
                <th style={{ ...thStyleR, textAlign: 'right' }} onClick={() => handleSort('totalUnits')}>Total Units{sortIndicator('totalUnits')}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={isMobile ? 4 : 5} style={{ ...tdStyleR, textAlign: 'center', padding: theme.spacing.xl, color: theme.colors.textLight }}>
                    No products match the current filter.
                  </td>
                </tr>
              ) : (
                sorted.map((p, i) => {
                  const cfg = p.config;
                  return (
                    <tr key={p.upc} style={{ background: i % 2 === 0 ? 'transparent' : theme.colors.backgroundAlt }}>
                      <td style={{ ...tdStyleR, maxWidth: 280 }}>
                        <div style={{ fontWeight: 500 }}>{p.name}</div>
                        <div style={{ fontSize: '0.7rem', color: theme.colors.textLight }}>
                          {p.brand && <span>{p.brand} &middot; </span>}
                          <span style={{ fontFamily: 'monospace', fontSize: '0.68rem' }}>{p.upc}</span>
                        </div>
                      </td>
                      {!isMobile && <td style={tdStyleR}>{p.category || '--'}</td>}
                      <td style={tdStyleR}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '3px 10px',
                            borderRadius: '12px',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            background: cfg.bg,
                            color: cfg.color,
                          }}
                        >
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.color }} />
                          {cfg.label}
                        </span>
                      </td>
                      <td style={{ ...tdStyleR, textAlign: 'right', fontWeight: 600 }}>
                        {formatDollar(p.totalDollars)}
                      </td>
                      <td style={{ ...tdStyleR, textAlign: 'right' }}>
                        {p.totalUnits.toLocaleString()}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
