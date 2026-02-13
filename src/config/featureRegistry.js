/**
 * Feature Registry — Maps dashboard features to their data requirements.
 * The app reads data_manifest.json at startup, cross-references each feature's
 * `requires` list, and only renders tabs/components for which data exists.
 */

export const FEATURES = {
  executive_summary: {
    id: 'executive_summary',
    label: 'Executive Summary',
    requires: ['dollars', 'units'],
    component: 'ExecutiveSummary',
    order: 0,
  },
  sales_overview: {
    id: 'sales_overview',
    label: 'Sales Overview',
    requires: ['dollars', 'units'],
    component: 'SalesOverview',
    order: 1,
  },
  yoy_performance: {
    id: 'yoy_performance',
    label: 'Year-over-Year',
    requires: ['dollars_yago'],
    component: 'YoYPerformance',
    order: 2,
  },
  product_performance: {
    id: 'product_performance',
    label: 'Product Performance',
    requires: ['dollars', 'units'],
    component: 'ProductPerformance',
    order: 3,
  },
  category_analytics: {
    id: 'category_analytics',
    label: 'Category Analytics',
    requires: ['category'],
    component: 'CategoryAnalytics',
    order: 4,
  },
  brand_performance: {
    id: 'brand_performance',
    label: 'Brand Performance',
    requires: ['brand'],
    component: 'BrandPerformance',
    order: 5,
  },
  top_bottom_movers: {
    id: 'top_bottom_movers',
    label: 'Top/Bottom Movers',
    requires: ['dollars'],
    component: 'TopBottomMovers',
    order: 6,
  },
  inventory_health: {
    id: 'inventory_health',
    label: 'Inventory Health',
    requires: ['inventory.json'],
    component: 'InventoryHealth',
    order: 7,
  },
  ltoos_risk: {
    id: 'ltoos_risk',
    label: 'LTOOS Risk',
    requires: ['ltoos_history.json'],
    component: 'LTOOSRisk',
    order: 8,
  },
  forecast_vs_actual: {
    id: 'forecast_vs_actual',
    label: 'Forecast vs Actual',
    requires: ['forecast_data.json'],
    component: 'ForecastVsActual',
    order: 9,
  },
  distribution_acv: {
    id: 'distribution_acv',
    label: 'Distribution / ACV',
    requires: ['acv', 'store_count'],
    component: 'DistributionACV',
    order: 10,
  },
  discontinuation_risk: {
    id: 'discontinuation_risk',
    label: 'Discontinuation Risk',
    requires: ['set_status'],
    component: 'DiscontinuationRisk',
    order: 11,
  },
  ecommerce_metrics: {
    id: 'ecommerce_metrics',
    label: 'E-commerce Metrics',
    requires: ['ecommerce.json'],
    component: 'EcommerceMetrics',
    order: 12,
  },
};

/**
 * Given a manifest entry for a retailer, return the ordered list of features
 * that should be displayed.
 */
export function getAvailableFeatures(retailerManifest) {
  if (!retailerManifest || !retailerManifest.features) return [];
  return Object.values(FEATURES)
    .filter(f => retailerManifest.features.includes(f.id))
    .sort((a, b) => a.order - b.order);
}
