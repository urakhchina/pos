import React, { useMemo, useState } from 'react';
import { theme } from '../styles/theme';
import { AlertTriangle, CheckCircle, Package } from 'lucide-react';

export default function InventoryHealth({ inventory }) {
  const [sortOrder, setSortOrder] = useState('asc'); // worst first by default

  const { overallInStock, products } = useMemo(() => {
    if (!inventory || !inventory.products) {
      return { overallInStock: null, products: [] };
    }

    const prods = inventory.products.map(p => ({
      upc: p.upc || '',
      name: p.product_name || p.name || p.upc || 'Unknown',
      brand: p.brand || '',
      inStockPct: p.in_stock_pct != null ? p.in_stock_pct : (p.instock_pct != null ? p.instock_pct : null),
      wos: p.weeks_of_supply != null ? p.weeks_of_supply : (p.wos != null ? p.wos : null),
      onHand: p.on_hand_qty != null ? p.on_hand_qty : (p.oh_qty != null ? p.oh_qty : null),
    }));

    // Overall in-stock %
    const withPct = prods.filter(p => p.inStockPct != null);
    const avgInStock = withPct.length > 0
      ? withPct.reduce((s, p) => s + p.inStockPct, 0) / withPct.length
      : null;

    return { overallInStock: avgInStock, products: prods };
  }, [inventory]);

  const sortedProducts = useMemo(() => {
    const sorted = [...products];
    sorted.sort((a, b) => {
      const aVal = a.inStockPct != null ? a.inStockPct : (sortOrder === 'asc' ? Infinity : -Infinity);
      const bVal = b.inStockPct != null ? b.inStockPct : (sortOrder === 'asc' ? Infinity : -Infinity);
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });
    return sorted;
  }, [products, sortOrder]);

  if (!inventory) {
    return (
      <div style={{ padding: theme.spacing.xl, textAlign: 'center', color: theme.colors.textLight }}>
        No inventory data available for this retailer.
      </div>
    );
  }

  // Gauge component
  const Gauge = ({ value }) => {
    const pct = value != null ? Math.min(100, Math.max(0, value)) : 0;
    const angle = (pct / 100) * 180;
    const color = pct >= 90 ? theme.colors.success : pct >= 70 ? theme.colors.warning : theme.colors.danger;
    const radians = (angle) * (Math.PI / 180);
    const endX = 50 - 40 * Math.cos(radians);
    const endY = 50 - 40 * Math.sin(radians);
    const largeArc = angle > 90 ? 1 : 0;

    return (
      <div style={{ textAlign: 'center' }}>
        <svg viewBox="0 0 100 55" width="200" height="110">
          {/* Background arc */}
          <path
            d="M 10 50 A 40 40 0 0 1 90 50"
            fill="none"
            stroke={theme.colors.border}
            strokeWidth="8"
            strokeLinecap="round"
          />
          {/* Value arc */}
          {pct > 0 && (
            <path
              d={`M 10 50 A 40 40 0 ${largeArc} 1 ${endX} ${endY}`}
              fill="none"
              stroke={color}
              strokeWidth="8"
              strokeLinecap="round"
            />
          )}
          <text
            x="50"
            y="48"
            textAnchor="middle"
            style={{
              fontFamily: theme.fonts.heading,
              fontSize: '16px',
              fontWeight: 700,
              fill: theme.colors.text,
            }}
          >
            {value != null ? `${value.toFixed(1)}%` : 'N/A'}
          </text>
          <text
            x="50"
            y="54"
            textAnchor="middle"
            style={{
              fontFamily: theme.fonts.body,
              fontSize: '5px',
              fill: theme.colors.textLight,
            }}
          >
            In-Stock Rate
          </text>
        </svg>
      </div>
    );
  };

  const getStatusColor = (pct) => {
    if (pct == null) return theme.colors.textLight;
    if (pct >= 90) return theme.colors.success;
    if (pct >= 70) return theme.colors.warning;
    return theme.colors.danger;
  };

  const getStatusIcon = (pct) => {
    if (pct == null) return <Package size={14} style={{ color: theme.colors.textLight }} />;
    if (pct >= 90) return <CheckCircle size={14} style={{ color: theme.colors.success }} />;
    return <AlertTriangle size={14} style={{ color: getStatusColor(pct) }} />;
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
        Inventory Health
      </h2>

      {/* Overall gauge */}
      <div
        style={{
          background: theme.colors.cardBg,
          borderRadius: theme.borderRadius.lg,
          boxShadow: theme.shadows.sm,
          padding: theme.spacing.xl,
          marginBottom: theme.spacing.lg,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <h3
          style={{
            fontFamily: theme.fonts.heading,
            fontSize: '1rem',
            color: theme.colors.secondary,
            marginBottom: theme.spacing.md,
          }}
        >
          Overall In-Stock Rate
        </h3>
        <Gauge value={overallInStock} />
      </div>

      {/* Sort toggle */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: theme.spacing.md,
        }}
      >
        <span style={{ fontFamily: theme.fonts.body, fontSize: '0.82rem', color: theme.colors.textLight }}>
          {sortedProducts.length} products
        </span>
        <div
          style={{
            display: 'inline-flex',
            background: theme.colors.backgroundAlt,
            borderRadius: theme.borderRadius.md,
            padding: '3px',
          }}
        >
          <button
            onClick={() => setSortOrder('asc')}
            style={{
              padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
              border: 'none',
              borderRadius: theme.borderRadius.sm,
              background: sortOrder === 'asc' ? theme.colors.danger : 'transparent',
              color: sortOrder === 'asc' ? '#fff' : theme.colors.textLight,
              fontFamily: theme.fonts.body,
              fontSize: '0.78rem',
              cursor: 'pointer',
            }}
          >
            Worst First
          </button>
          <button
            onClick={() => setSortOrder('desc')}
            style={{
              padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
              border: 'none',
              borderRadius: theme.borderRadius.sm,
              background: sortOrder === 'desc' ? theme.colors.success : 'transparent',
              color: sortOrder === 'desc' ? '#fff' : theme.colors.textLight,
              fontFamily: theme.fonts.body,
              fontSize: '0.78rem',
              cursor: 'pointer',
            }}
          >
            Best First
          </button>
        </div>
      </div>

      {/* Product cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: theme.spacing.md,
        }}
      >
        {sortedProducts.map((p) => (
          <div
            key={p.upc}
            style={{
              background: theme.colors.cardBg,
              borderRadius: theme.borderRadius.lg,
              boxShadow: theme.shadows.sm,
              padding: theme.spacing.lg,
              borderLeft: `4px solid ${getStatusColor(p.inStockPct)}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: theme.spacing.sm }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: theme.fonts.body,
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    color: theme.colors.text,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {p.name}
                </div>
                {p.brand && (
                  <div style={{ fontFamily: theme.fonts.body, fontSize: '0.72rem', color: theme.colors.textLight }}>
                    {p.brand}
                  </div>
                )}
              </div>
              {getStatusIcon(p.inStockPct)}
            </div>
            <div style={{ display: 'flex', gap: theme.spacing.lg, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontFamily: theme.fonts.body, fontSize: '0.68rem', color: theme.colors.textLight, textTransform: 'uppercase' }}>
                  In-Stock %
                </div>
                <div
                  style={{
                    fontFamily: theme.fonts.heading,
                    fontSize: '1.15rem',
                    fontWeight: 700,
                    color: getStatusColor(p.inStockPct),
                  }}
                >
                  {p.inStockPct != null ? `${p.inStockPct.toFixed(1)}%` : 'N/A'}
                </div>
              </div>
              <div>
                <div style={{ fontFamily: theme.fonts.body, fontSize: '0.68rem', color: theme.colors.textLight, textTransform: 'uppercase' }}>
                  WOS
                </div>
                <div
                  style={{
                    fontFamily: theme.fonts.heading,
                    fontSize: '1.15rem',
                    fontWeight: 700,
                    color: theme.colors.text,
                  }}
                >
                  {p.wos != null ? p.wos.toFixed(1) : 'N/A'}
                </div>
              </div>
              <div>
                <div style={{ fontFamily: theme.fonts.body, fontSize: '0.68rem', color: theme.colors.textLight, textTransform: 'uppercase' }}>
                  On Hand
                </div>
                <div
                  style={{
                    fontFamily: theme.fonts.heading,
                    fontSize: '1.15rem',
                    fontWeight: 700,
                    color: theme.colors.text,
                  }}
                >
                  {p.onHand != null ? p.onHand.toLocaleString() : 'N/A'}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
