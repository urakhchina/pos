import React from 'react';
import { theme } from '../styles/theme';
import {
  LayoutDashboard,
  TrendingUp,
  ArrowUpDown,
  Package,
  PieChart,
  Activity,
  Warehouse,
  AlertTriangle,
  Target,
  MapPin,
  XCircle,
  ShoppingCart,
} from 'lucide-react';

const ICON_MAP = {
  executive_summary: LayoutDashboard,
  sales_overview: TrendingUp,
  yoy_performance: ArrowUpDown,
  product_performance: Package,
  category_analytics: PieChart,
  top_bottom_movers: Activity,
  inventory_health: Warehouse,
  ltoos_risk: AlertTriangle,
  forecast_vs_actual: Target,
  distribution_acv: MapPin,
  discontinuation_risk: XCircle,
  ecommerce_metrics: ShoppingCart,
};

export default function TabNavigation({ features, activeTab, setActiveTab }) {
  if (!features || features.length === 0) return null;

  return (
    <nav
      style={{
        background: theme.colors.cardBg,
        borderBottom: `1px solid ${theme.colors.border}`,
        padding: `0 ${theme.spacing.xl}`,
        display: 'flex',
        alignItems: 'stretch',
        overflowX: 'auto',
        gap: '2px',
      }}
    >
      {features.map(feature => {
        const isActive = feature.id === activeTab;
        const Icon = ICON_MAP[feature.id] || LayoutDashboard;
        return (
          <button
            key={feature.id}
            onClick={() => setActiveTab(feature.id)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: theme.spacing.xs,
              padding: `${theme.spacing.sm} ${theme.spacing.md}`,
              border: 'none',
              borderBottom: isActive ? `3px solid ${theme.colors.primary}` : '3px solid transparent',
              background: isActive ? `${theme.colors.primary}15` : 'transparent',
              color: isActive ? theme.colors.primary : theme.colors.textLight,
              fontFamily: theme.fonts.body,
              fontSize: '0.82rem',
              fontWeight: isActive ? 600 : 400,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
            onMouseEnter={e => {
              if (!isActive) {
                e.currentTarget.style.background = `${theme.colors.primary}08`;
                e.currentTarget.style.color = theme.colors.text;
              }
            }}
            onMouseLeave={e => {
              if (!isActive) {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = theme.colors.textLight;
              }
            }}
          >
            <Icon size={15} />
            {feature.label}
          </button>
        );
      })}
    </nav>
  );
}
