import React, { useMemo, useState } from 'react';
import { theme } from '../styles/theme';
import { AlertTriangle, Clock, XCircle } from 'lucide-react';

function getSeverity(days) {
  if (days == null) return { level: 'unknown', color: theme.colors.textLight, label: 'Unknown' };
  if (days >= 60) return { level: 'critical', color: theme.colors.danger, label: 'Critical' };
  if (days >= 30) return { level: 'high', color: theme.colors.warning, label: 'High' };
  if (days >= 14) return { level: 'medium', color: '#FF9800', label: 'Medium' };
  return { level: 'low', color: theme.colors.chartColors[1], label: 'Low' };
}

export default function LTOOSRisk({ ltoos }) {
  const [statusFilter, setStatusFilter] = useState('all');

  const items = useMemo(() => {
    if (!ltoos || !ltoos.products) return [];
    return ltoos.products.map(p => ({
      upc: p.upc || '',
      name: p.product_name || p.name || p.upc || 'Unknown',
      brand: p.brand || '',
      days: p.days_ltoos != null ? p.days_ltoos : (p.days != null ? p.days : null),
      status: p.status || p.ltoos_status || 'Unknown',
      qtyAvailable: p.qty_available != null ? p.qty_available : (p.quantity_available != null ? p.quantity_available : null),
      store_count: p.store_count || null,
      severity: getSeverity(p.days_ltoos != null ? p.days_ltoos : (p.days != null ? p.days : null)),
    }));
  }, [ltoos]);

  const statuses = useMemo(() => {
    const s = new Set(items.map(i => i.status));
    return ['all', ...Array.from(s).sort()];
  }, [items]);

  const filtered = useMemo(() => {
    let result = [...items];
    if (statusFilter !== 'all') {
      result = result.filter(i => i.status === statusFilter);
    }
    // Sort by days descending (worst first)
    result.sort((a, b) => (b.days || 0) - (a.days || 0));
    return result;
  }, [items, statusFilter]);

  if (!ltoos) {
    return (
      <div style={{ padding: theme.spacing.xl, textAlign: 'center', color: theme.colors.textLight }}>
        No LTOOS data available for this retailer.
      </div>
    );
  }

  // Summary
  const critical = items.filter(i => i.severity.level === 'critical').length;
  const high = items.filter(i => i.severity.level === 'high').length;
  const medium = items.filter(i => i.severity.level === 'medium').length;
  const low = items.filter(i => i.severity.level === 'low').length;

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
        LTOOS Risk Monitor
      </h2>

      {/* Severity summary */}
      <div
        style={{
          display: 'flex',
          gap: theme.spacing.md,
          marginBottom: theme.spacing.lg,
          flexWrap: 'wrap',
        }}
      >
        {[
          { label: 'Critical (60+ days)', count: critical, color: theme.colors.danger, icon: XCircle },
          { label: 'High (30-59 days)', count: high, color: theme.colors.warning, icon: AlertTriangle },
          { label: 'Medium (14-29 days)', count: medium, color: '#FF9800', icon: Clock },
          { label: 'Low (<14 days)', count: low, color: theme.colors.chartColors[1], icon: Clock },
        ].map((s, i) => {
          const Icon = s.icon;
          return (
            <div
              key={i}
              style={{
                flex: '1 1 180px',
                background: theme.colors.cardBg,
                borderRadius: theme.borderRadius.md,
                boxShadow: theme.shadows.sm,
                padding: theme.spacing.lg,
                borderTop: `3px solid ${s.color}`,
                display: 'flex',
                alignItems: 'center',
                gap: theme.spacing.md,
              }}
            >
              <Icon size={22} style={{ color: s.color, flexShrink: 0 }} />
              <div>
                <div style={{ fontFamily: theme.fonts.heading, fontSize: '1.4rem', fontWeight: 700, color: s.color }}>
                  {s.count}
                </div>
                <div style={{ fontFamily: theme.fonts.body, fontSize: '0.7rem', color: theme.colors.textLight }}>
                  {s.label}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filter */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: theme.spacing.md,
          marginBottom: theme.spacing.md,
        }}
      >
        <span style={{ fontFamily: theme.fonts.body, fontSize: '0.8rem', color: theme.colors.textLight }}>
          Filter by status:
        </span>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          style={{
            padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.borderRadius.sm,
            fontFamily: theme.fonts.body,
            fontSize: '0.82rem',
            color: theme.colors.text,
            background: theme.colors.cardBg,
          }}
        >
          {statuses.map(s => (
            <option key={s} value={s}>{s === 'all' ? 'All Statuses' : s}</option>
          ))}
        </select>
        <span style={{ fontFamily: theme.fonts.body, fontSize: '0.8rem', color: theme.colors.textLight, marginLeft: 'auto' }}>
          {filtered.length} item{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

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
                <th style={thStyle}>Product</th>
                <th style={thStyle}>Status</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Days LTOOS</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Qty Available</th>
                <th style={thStyle}>Severity</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ ...tdStyle, textAlign: 'center', padding: theme.spacing.xl, color: theme.colors.textLight }}>
                    No LTOOS items match the current filter.
                  </td>
                </tr>
              ) : (
                filtered.map((item, i) => (
                  <tr key={item.upc + '-' + i} style={{ background: i % 2 === 0 ? 'transparent' : theme.colors.backgroundAlt }}>
                    <td style={{ ...tdStyle, maxWidth: 250 }}>
                      <div style={{ fontWeight: 500 }}>{item.name}</div>
                      {item.brand && (
                        <div style={{ fontSize: '0.7rem', color: theme.colors.textLight }}>{item.brand}</div>
                      )}
                    </td>
                    <td style={tdStyle}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: '10px',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          background: `${item.severity.color}18`,
                          color: item.severity.color,
                        }}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td
                      style={{
                        ...tdStyle,
                        textAlign: 'right',
                        fontWeight: 600,
                        color: item.severity.color,
                      }}
                    >
                      {item.days != null ? item.days : '--'}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      {item.qtyAvailable != null ? item.qtyAvailable.toLocaleString() : '--'}
                    </td>
                    <td style={tdStyle}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '2px 10px',
                          borderRadius: '10px',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          background: `${item.severity.color}18`,
                          color: item.severity.color,
                        }}
                      >
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            background: item.severity.color,
                          }}
                        />
                        {item.severity.label}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
