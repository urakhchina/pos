import React, { useMemo } from 'react';
import { theme } from '../styles/theme';
import { ShoppingCart, DollarSign, Target, Users, TrendingUp, Package } from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

function formatCurrency(val) {
  if (val >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
  if (val >= 1e3) return `$${(val / 1e3).toFixed(1)}K`;
  return `$${val.toFixed(2)}`;
}

export default function EcommerceMetrics({ ecommerce }) {
  const { kpis, trendData } = useMemo(() => {
    if (!ecommerce) return { kpis: null, trendData: [] };

    // E-commerce data can have summary fields and period-level data
    const summary = ecommerce.summary || ecommerce;

    const kpiData = {
      aov: summary.aov != null ? summary.aov : (summary.average_order_value != null ? summary.average_order_value : null),
      asp: summary.asp != null ? summary.asp : (summary.average_selling_price != null ? summary.average_selling_price : null),
      totalOrders: summary.total_orders != null ? summary.total_orders : (summary.orders != null ? summary.orders : null),
      totalRevenue: summary.total_revenue != null ? summary.total_revenue : (summary.revenue != null ? summary.revenue : null),
      totalUnits: summary.total_units != null ? summary.total_units : (summary.units != null ? summary.units : null),
      conversion: summary.conversion_rate != null ? summary.conversion_rate : (summary.conversion != null ? summary.conversion : null),
      sessions: summary.sessions != null ? summary.sessions : null,
    };

    // Trend data from periods
    let trends = [];
    if (ecommerce.periods) {
      const sortedKeys = Object.keys(ecommerce.periods).sort();
      trends = sortedKeys.map(key => {
        const p = ecommerce.periods[key];
        const month = parseInt(key.slice(5, 7), 10);
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const year = key.slice(2, 4);
        return {
          period: `${monthNames[month - 1] || key} '${year}`,
          revenue: p.revenue || p.dollars || 0,
          orders: p.orders || p.total_orders || 0,
          aov: p.aov || p.average_order_value || 0,
        };
      });
    }

    return { kpis: kpiData, trendData: trends };
  }, [ecommerce]);

  if (!ecommerce) {
    return (
      <div
        style={{
          padding: theme.spacing.xxl,
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: theme.spacing.md,
        }}
      >
        <ShoppingCart size={48} style={{ color: theme.colors.textLight }} />
        <p style={{ fontFamily: theme.fonts.heading, fontSize: '1.1rem', color: theme.colors.textLight }}>
          No e-commerce data available
        </p>
        <p style={{ fontFamily: theme.fonts.body, fontSize: '0.85rem', color: theme.colors.textLight }}>
          E-commerce metrics have not been configured for this retailer.
        </p>
      </div>
    );
  }

  const kpiCards = [
    {
      title: 'Avg Order Value',
      value: kpis?.aov != null ? `$${kpis.aov.toFixed(2)}` : 'N/A',
      icon: DollarSign,
      color: theme.colors.primary,
    },
    {
      title: 'Avg Selling Price',
      value: kpis?.asp != null ? `$${kpis.asp.toFixed(2)}` : 'N/A',
      icon: Target,
      color: theme.colors.chartColors[1],
    },
    {
      title: 'Total Orders',
      value: kpis?.totalOrders != null ? kpis.totalOrders.toLocaleString() : 'N/A',
      icon: ShoppingCart,
      color: theme.colors.chartColors[3],
    },
    {
      title: 'Total Revenue',
      value: kpis?.totalRevenue != null ? formatCurrency(kpis.totalRevenue) : 'N/A',
      icon: TrendingUp,
      color: theme.colors.chartColors[4],
    },
    {
      title: 'Total Units',
      value: kpis?.totalUnits != null ? kpis.totalUnits.toLocaleString() : 'N/A',
      icon: Package,
      color: theme.colors.chartColors[5],
    },
    {
      title: 'Conversion Rate',
      value: kpis?.conversion != null ? `${kpis.conversion.toFixed(2)}%` : 'N/A',
      icon: Users,
      color: theme.colors.chartColors[6],
    },
  ].filter(card => card.value !== 'N/A');

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
        E-commerce Metrics
      </h2>

      {/* KPI cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: theme.spacing.md,
          marginBottom: theme.spacing.xl,
        }}
      >
        {kpiCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div
              key={i}
              style={{
                background: theme.colors.cardBg,
                borderRadius: theme.borderRadius.lg,
                boxShadow: theme.shadows.sm,
                padding: theme.spacing.xl,
                borderTop: `3px solid ${card.color}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.sm }}>
                <span
                  style={{
                    fontFamily: theme.fonts.body,
                    fontSize: '0.75rem',
                    color: theme.colors.textLight,
                    fontWeight: 500,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  {card.title}
                </span>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: theme.borderRadius.md,
                    background: `${card.color}18`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon size={16} style={{ color: card.color }} />
                </div>
              </div>
              <div
                style={{
                  fontFamily: theme.fonts.heading,
                  fontSize: '1.6rem',
                  fontWeight: 700,
                  color: theme.colors.text,
                }}
              >
                {card.value}
              </div>
            </div>
          );
        })}
      </div>

      {/* Trend chart */}
      {trendData.length > 1 && (
        <div
          style={{
            background: theme.colors.cardBg,
            borderRadius: theme.borderRadius.lg,
            boxShadow: theme.shadows.sm,
            padding: theme.spacing.xl,
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
            E-commerce Trends
          </h3>
          <ResponsiveContainer width="100%" height={350}>
            <ComposedChart data={trendData} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme.colors.border} />
              <XAxis
                dataKey="period"
                tick={{ fontFamily: theme.fonts.body, fontSize: 11, fill: theme.colors.textLight }}
                tickLine={false}
              />
              <YAxis
                yAxisId="revenue"
                tickFormatter={v => {
                  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
                  return `$${v}`;
                }}
                tick={{ fontFamily: theme.fonts.body, fontSize: 11, fill: theme.colors.textLight }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                yAxisId="orders"
                orientation="right"
                tick={{ fontFamily: theme.fonts.body, fontSize: 11, fill: theme.colors.textLight }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  fontFamily: theme.fonts.body,
                  fontSize: '0.82rem',
                  borderRadius: theme.borderRadius.md,
                  border: `1px solid ${theme.colors.border}`,
                  boxShadow: theme.shadows.md,
                }}
                formatter={(value, name) => {
                  if (name === 'Revenue') return [`$${value.toLocaleString()}`, name];
                  if (name === 'AOV') return [`$${value.toFixed(2)}`, name];
                  return [value.toLocaleString(), name];
                }}
              />
              <Legend wrapperStyle={{ fontFamily: theme.fonts.body, fontSize: '0.8rem' }} />
              <Bar
                yAxisId="revenue"
                dataKey="revenue"
                name="Revenue"
                fill={`${theme.colors.primary}90`}
                radius={[3, 3, 0, 0]}
              />
              <Line
                yAxisId="orders"
                type="monotone"
                dataKey="orders"
                name="Orders"
                stroke={theme.colors.chartColors[1]}
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Products table if available */}
      {ecommerce.products && ecommerce.products.length > 0 && (
        <div
          style={{
            background: theme.colors.cardBg,
            borderRadius: theme.borderRadius.lg,
            boxShadow: theme.shadows.sm,
            overflow: 'hidden',
            marginTop: theme.spacing.lg,
          }}
        >
          <div style={{ padding: `${theme.spacing.lg} ${theme.spacing.xl} ${theme.spacing.sm}` }}>
            <h3 style={{ fontFamily: theme.fonts.heading, fontSize: '1rem', color: theme.colors.secondary }}>
              Product-Level E-commerce Data
            </h3>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Product', 'Revenue', 'Units', 'Orders', 'ASP'].map(col => (
                    <th
                      key={col}
                      style={{
                        textAlign: col === 'Product' ? 'left' : 'right',
                        padding: `${theme.spacing.sm} ${theme.spacing.sm}`,
                        borderBottom: `2px solid ${theme.colors.border}`,
                        fontWeight: 600,
                        color: theme.colors.secondary,
                        fontSize: '0.72rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.03em',
                        fontFamily: theme.fonts.body,
                      }}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ecommerce.products
                  .sort((a, b) => (b.revenue || b.dollars || 0) - (a.revenue || a.dollars || 0))
                  .slice(0, 25)
                  .map((p, i) => {
                    const rev = p.revenue || p.dollars || 0;
                    const units = p.units || 0;
                    const orders = p.orders || 0;
                    const asp = units > 0 ? rev / units : 0;
                    return (
                      <tr key={p.upc || i} style={{ background: i % 2 === 0 ? 'transparent' : theme.colors.backgroundAlt }}>
                        <td
                          style={{
                            padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                            borderBottom: `1px solid ${theme.colors.border}`,
                            fontFamily: theme.fonts.body,
                            fontSize: '0.82rem',
                            maxWidth: 280,
                          }}
                        >
                          <div style={{ fontWeight: 500 }}>{p.product_name || p.name || p.upc || 'Unknown'}</div>
                        </td>
                        <td style={{ padding: `${theme.spacing.xs} ${theme.spacing.sm}`, borderBottom: `1px solid ${theme.colors.border}`, textAlign: 'right', fontFamily: theme.fonts.body, fontSize: '0.82rem', fontWeight: 600 }}>
                          ${rev.toLocaleString()}
                        </td>
                        <td style={{ padding: `${theme.spacing.xs} ${theme.spacing.sm}`, borderBottom: `1px solid ${theme.colors.border}`, textAlign: 'right', fontFamily: theme.fonts.body, fontSize: '0.82rem' }}>
                          {units.toLocaleString()}
                        </td>
                        <td style={{ padding: `${theme.spacing.xs} ${theme.spacing.sm}`, borderBottom: `1px solid ${theme.colors.border}`, textAlign: 'right', fontFamily: theme.fonts.body, fontSize: '0.82rem' }}>
                          {orders.toLocaleString()}
                        </td>
                        <td style={{ padding: `${theme.spacing.xs} ${theme.spacing.sm}`, borderBottom: `1px solid ${theme.colors.border}`, textAlign: 'right', fontFamily: theme.fonts.body, fontSize: '0.82rem' }}>
                          ${asp.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
