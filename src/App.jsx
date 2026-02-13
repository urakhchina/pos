import React, { useState, useEffect, useMemo } from 'react';
import { theme } from './styles/theme';
import { loadManifest, loadRetailerData } from './utils/dataLoader';
import { getAvailableFeatures } from './config/featureRegistry';
import {
  getAvailableMonths, getAvailableQuarters, getAvailableWeeks,
  computeMonthlySlice, computeQuarterlySlice, computeYTDSlice, computeWeeklySlice,
  detectPrimaryMetric, getAllQuarterOverview, periodToMonthName, weekKeyToLabel,
  getSortedPeriods, getQuarterMonths, aggregateProductData,
} from './utils/timePeriodUtils';
import RetailerSelector from './components/RetailerSelector';
import TabNavigation from './components/TabNavigation';
import TimePeriodSelector from './components/TimePeriodSelector';
import QuarterlyOverview from './components/QuarterlyOverview';
import YTDOverview from './components/YTDOverview';
import ExecutiveSummary from './components/ExecutiveSummary';
import SalesOverview from './components/SalesOverview';
import YoYPerformance from './components/YoYPerformance';
import ProductPerformance from './components/ProductPerformance';
import CategoryAnalytics from './components/CategoryAnalytics';
import TopBottomMovers from './components/TopBottomMovers';
import InventoryHealth from './components/InventoryHealth';
import LTOOSRisk from './components/LTOOSRisk';
import ForecastVsActual from './components/ForecastVsActual';
import DistributionACV from './components/DistributionACV';
import DiscontinuationRisk from './components/DiscontinuationRisk';
import EcommerceMetrics from './components/EcommerceMetrics';

const COMPONENT_MAP = {
  ExecutiveSummary,
  SalesOverview,
  YoYPerformance,
  ProductPerformance,
  CategoryAnalytics,
  TopBottomMovers,
  InventoryHealth,
  LTOOSRisk,
  ForecastVsActual,
  DistributionACV,
  DiscontinuationRisk,
  EcommerceMetrics,
};

const POS_AWARE_COMPONENTS = new Set([
  'ExecutiveSummary', 'SalesOverview', 'YoYPerformance',
  'ProductPerformance', 'CategoryAnalytics', 'TopBottomMovers',
]);

const globalStyles = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: ${theme.fonts.body};
    background: ${theme.colors.backgroundAlt};
    color: ${theme.colors.text};
    -webkit-font-smoothing: antialiased;
  }
  ::-webkit-scrollbar { height: 6px; width: 6px; }
  ::-webkit-scrollbar-track { background: ${theme.colors.backgroundAlt}; }
  ::-webkit-scrollbar-thumb { background: ${theme.colors.border}; border-radius: 3px; }
  @keyframes spin { to { transform: rotate(360deg); } }
`;

export default function App() {
  const [manifest, setManifest] = useState(null);
  const [activeRetailer, setActiveRetailer] = useState(null);
  const [retailerData, setRetailerData] = useState(null);
  const [features, setFeatures] = useState([]);
  const [activeTab, setActiveTab] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Time period state
  const [timePeriod, setTimePeriod] = useState('monthly');
  const [metricMode, setMetricMode] = useState('auto'); // 'auto' | 'dollars' | 'units'
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [selectedQuarter, setSelectedQuarter] = useState(null);
  const [selectedWeek, setSelectedWeek] = useState(null);

  // Load manifest on mount
  useEffect(() => {
    loadManifest()
      .then(data => {
        if (!data) {
          setError('Failed to load data manifest. Make sure data_manifest.json exists in public/data/.');
          setLoading(false);
          return;
        }
        setManifest(data);
        const keys = Object.keys(data.retailers || {});
        if (keys.length > 0) setActiveRetailer(keys[0]);
        setLoading(false);
      })
      .catch(err => {
        setError(`Error loading manifest: ${err.message}`);
        setLoading(false);
      });
  }, []);

  // Load retailer data when selected
  useEffect(() => {
    if (!activeRetailer || !manifest) return;
    setLoading(true);
    setError(null);
    loadRetailerData(activeRetailer)
      .then(data => {
        if (!data) {
          setError(`Failed to load data for ${activeRetailer}.`);
          setLoading(false);
          return;
        }
        setRetailerData(data);
        const avail = getAvailableFeatures(manifest.retailers[activeRetailer]);
        setFeatures(avail);
        setActiveTab(avail.length > 0 ? avail[0].id : null);
        setLoading(false);
      })
      .catch(err => {
        setError(`Error loading retailer data: ${err.message}`);
        setLoading(false);
      });
  }, [activeRetailer, manifest]);

  // Reset time period selections when switching retailers
  useEffect(() => {
    setSelectedMonth(null);
    setSelectedQuarter(null);
    setSelectedWeek(null);
    setTimePeriod('monthly');
    setMetricMode('auto');
  }, [activeRetailer]);

  // Auto-select latest month/quarter/week when data loads or time period changes
  useEffect(() => {
    if (!retailerData?.posData?.periods) return;
    const periods = retailerData.posData.periods;

    if (timePeriod === 'monthly' && !selectedMonth) {
      const months = getAvailableMonths(periods);
      if (months.length > 0) setSelectedMonth(months[months.length - 1]);
    }
    if (timePeriod === 'quarterly' && !selectedQuarter) {
      const quarters = getAvailableQuarters(periods);
      if (quarters.length > 0) setSelectedQuarter(quarters[quarters.length - 1]);
    }
    if (timePeriod === 'weekly' && !selectedWeek) {
      const weeks = getAvailableWeeks(retailerData.posData.weekly_periods);
      if (weeks.length > 0) setSelectedWeek(weeks[weeks.length - 1]);
    }
  }, [retailerData, timePeriod, selectedMonth, selectedQuarter, selectedWeek]);

  // Detect weekly data availability
  const hasWeekly = !!(retailerData?.posData?.weekly_periods &&
    Object.keys(retailerData.posData.weekly_periods).length > 0);

  // Detect if retailer has both dollars and units (for metric toggle)
  const hasBothMetrics = useMemo(() => {
    if (!retailerData?.posData?.periods) return false;
    return detectPrimaryMetric(retailerData.posData.periods) === 'dollars';
  }, [retailerData]);

  // Pre-aggregate data based on time period selection
  const timePeriodData = useMemo(() => {
    if (!retailerData?.posData?.periods) return null;
    const periods = retailerData.posData.periods;

    const detectedMetric = detectPrimaryMetric(periods);
    const primaryMetric = metricMode === 'auto' ? detectedMetric : metricMode;
    const availableMonths = getAvailableMonths(periods);
    const availableQuarters = getAvailableQuarters(periods);
    const availableWeeks = hasWeekly
      ? getAvailableWeeks(retailerData.posData.weekly_periods) : [];

    let slice = null;
    if (timePeriod === 'weekly' && selectedWeek && hasWeekly) {
      slice = computeWeeklySlice(retailerData.posData.weekly_periods, selectedWeek);
    } else if (timePeriod === 'monthly' && selectedMonth) {
      slice = computeMonthlySlice(periods, selectedMonth);
    } else if (timePeriod === 'quarterly' && selectedQuarter) {
      slice = computeQuarterlySlice(periods, selectedQuarter);
    } else if (timePeriod === 'ytd') {
      slice = computeYTDSlice(periods);
    }

    const quarterOverview = timePeriod === 'quarterly'
      ? getAllQuarterOverview(periods) : null;

    return {
      ...slice,
      primaryMetric,
      availableMonths,
      availableQuarters,
      availableWeeks,
      quarterOverview,
    };
  }, [retailerData, timePeriod, selectedMonth, selectedQuarter, selectedWeek, hasWeekly, metricMode]);

  // Prior sequential period data (for MoM/WoW/QoQ comparisons)
  const selectedPeriodKey = timePeriod === 'weekly' ? selectedWeek :
    timePeriod === 'monthly' ? selectedMonth :
    timePeriod === 'quarterly' ? selectedQuarter : null;

  const priorSequentialData = useMemo(() => {
    if (!retailerData?.posData || !selectedPeriodKey) return null;
    const posData = retailerData.posData;

    if (timePeriod === 'weekly') {
      const wp = posData.weekly_periods;
      if (!wp) return null;
      const sorted = Object.keys(wp).sort();
      const idx = sorted.indexOf(selectedPeriodKey);
      if (idx <= 0) return null;
      return wp[sorted[idx - 1]] || null;
    }
    if (timePeriod === 'monthly') {
      const periods = posData.periods;
      if (!periods) return null;
      const sorted = getSortedPeriods(periods);
      const idx = sorted.indexOf(selectedPeriodKey);
      if (idx <= 0) return null;
      return periods[sorted[idx - 1]] || null;
    }
    if (timePeriod === 'quarterly') {
      const periods = posData.periods;
      if (!periods) return null;
      const year = parseInt(selectedPeriodKey.slice(0, 4), 10);
      const qNum = parseInt(selectedPeriodKey.slice(6), 10);
      const priorYear = qNum === 1 ? year - 1 : year;
      const priorQ = qNum === 1 ? 'Q4' : `Q${qNum - 1}`;
      const priorMonths = getQuarterMonths(priorQ);
      const priorKeys = priorMonths.map(mm => `${priorYear}-${mm}`).filter(k => periods[k]);
      if (priorKeys.length === 0) return null;
      return aggregateProductData(periods, priorKeys);
    }
    return null;
  }, [retailerData, selectedPeriodKey, timePeriod]);

  // Full prior year product data (for PY column — always the complete prior year)
  const fullPriorYearProductData = useMemo(() => {
    if (!retailerData?.posData?.periods) return null;
    const periods = retailerData.posData.periods;
    const years = [...new Set(Object.keys(periods).map(k => k.slice(0, 4)))].sort();
    if (years.length < 2) return null;
    const priorYear = years[years.length - 2];
    const priorKeys = Object.keys(periods).filter(k => k.startsWith(priorYear));
    return aggregateProductData(periods, priorKeys);
  }, [retailerData]);

  const handleTimePeriodChange = (newPeriod) => {
    setTimePeriod(newPeriod);
    if (newPeriod === 'weekly') { setSelectedMonth(null); setSelectedQuarter(null); }
    if (newPeriod === 'monthly') { setSelectedQuarter(null); setSelectedWeek(null); }
    if (newPeriod === 'quarterly') { setSelectedMonth(null); setSelectedWeek(null); }
    if (newPeriod === 'ytd') { setSelectedWeek(null); }
  };

  const renderActiveTab = () => {
    if (!activeTab || !retailerData) return null;
    const feature = features.find(f => f.id === activeTab);
    if (!feature) return null;
    const Component = COMPONENT_MAP[feature.component];
    if (!Component) return null;

    if (POS_AWARE_COMPONENTS.has(feature.component) && timePeriodData?.currentData) {
      return (
        <Component
          posData={retailerData.posData}
          currentData={timePeriodData.currentData}
          comparisonData={timePeriodData.comparisonData}
          trendData={timePeriodData.trendData}
          periodLabel={timePeriodData.periodLabel}
          timePeriod={timePeriod}
          primaryMetric={timePeriodData.primaryMetric}
          fullPrevYearData={timePeriodData.fullPrevYearData}
          comparableMonths={timePeriodData.comparableMonths}
          monthsWithData={timePeriodData.monthsWithData}
          isComplete={timePeriodData.isComplete}
          qepDollars={timePeriodData.qepDollars}
          qepUnits={timePeriodData.qepUnits}
          yepDollars={timePeriodData.yepDollars}
          yepUnits={timePeriodData.yepUnits}
          paceDollarsPct={timePeriodData.paceDollarsPct}
          paceUnitsPct={timePeriodData.paceUnitsPct}
          inventory={retailerData.inventory}
          ltoos={retailerData.ltoos}
          forecast={retailerData.forecast}
          ecommerce={retailerData.ecommerce}
          selectedPeriodKey={selectedPeriodKey}
          priorSequentialData={priorSequentialData}
          fullPriorYearProductData={fullPriorYearProductData}
        />
      );
    }

    return (
      <Component
        posData={retailerData.posData}
        inventory={retailerData.inventory}
        ltoos={retailerData.ltoos}
        forecast={retailerData.forecast}
        ecommerce={retailerData.ecommerce}
      />
    );
  };

  const hasPeriods = retailerData?.posData?.periods && Object.keys(retailerData.posData.periods).length > 0;

  return (
    <>
      <style>{globalStyles}</style>
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <header style={{
          background: theme.colors.secondary,
          padding: `${theme.spacing.md} ${theme.spacing.xl}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          boxShadow: theme.shadows.md, position: 'sticky', top: 0, zIndex: 100,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.md }}>
            <img
              src="/irwin_logo.png"
              alt="Irwin Naturals"
              style={{ height: 40, objectFit: 'contain' }}
            />
            <h1 style={{
              fontFamily: theme.fonts.heading, color: '#ffffff',
              fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.02em',
            }}>
              POS Dashboard
            </h1>
          </div>
          {manifest && (
            <span style={{
              color: 'rgba(255,255,255,0.6)', fontFamily: theme.fonts.body, fontSize: '0.8rem',
            }}>
              {Object.keys(manifest.retailers || {}).length} Retailers
            </span>
          )}
        </header>

        {/* Retailer Selector */}
        {manifest && (
          <RetailerSelector
            manifest={manifest}
            activeRetailer={activeRetailer}
            setActiveRetailer={setActiveRetailer}
          />
        )}

        {/* Tab Navigation */}
        {features.length > 0 && !loading && (
          <TabNavigation
            features={features}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
          />
        )}

        {/* Time Period Controls */}
        {hasPeriods && !loading && (
          <div style={{
            background: theme.colors.cardBg,
            borderBottom: `1px solid ${theme.colors.border}`,
            padding: `${theme.spacing.sm} ${theme.spacing.xl}`,
            display: 'flex', alignItems: 'center', gap: theme.spacing.md, flexWrap: 'wrap',
          }}>
            <TimePeriodSelector timePeriod={timePeriod} setTimePeriod={handleTimePeriodChange} hasWeekly={hasWeekly} />

            {/* Week sub-selector */}
            {timePeriod === 'weekly' && timePeriodData?.availableWeeks?.length > 0 && (() => {
              const weeks = timePeriodData.availableWeeks;
              // Show last 20 weeks for usability, with horizontal scroll
              const displayWeeks = weeks.slice(-20);
              return (
                <div style={{
                  display: 'flex', gap: '4px', alignItems: 'center',
                  overflowX: 'auto', maxWidth: '800px', paddingBottom: '2px',
                }}>
                  {displayWeeks.map(wk => (
                    <button
                      key={wk}
                      onClick={() => setSelectedWeek(wk)}
                      style={{
                        padding: '4px 8px',
                        border: selectedWeek === wk
                          ? `2px solid ${theme.colors.primary}`
                          : `1px solid ${theme.colors.border}`,
                        borderRadius: theme.borderRadius.sm,
                        background: selectedWeek === wk ? theme.colors.primary : theme.colors.cardBg,
                        color: selectedWeek === wk ? '#fff' : theme.colors.text,
                        fontFamily: theme.fonts.body, fontSize: '0.72rem',
                        fontWeight: selectedWeek === wk ? 600 : 400,
                        cursor: 'pointer', transition: 'all 0.15s',
                        whiteSpace: 'nowrap', flexShrink: 0,
                      }}
                    >
                      {weekKeyToLabel(wk)}
                    </button>
                  ))}
                </div>
              );
            })()}

            {/* Month sub-selector */}
            {timePeriod === 'monthly' && timePeriodData?.availableMonths && (() => {
              const months = timePeriodData.availableMonths;
              const years = [...new Set(months.map(m => m.slice(0, 4)))];
              const multiYear = years.length > 1;
              return (
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                  {months.map((mk, i) => {
                    const yr = mk.slice(0, 4);
                    const prevYr = i > 0 ? months[i - 1].slice(0, 4) : null;
                    const showYearDivider = multiYear && prevYr && yr !== prevYr;
                    return (
                      <React.Fragment key={mk}>
                        {showYearDivider && (
                          <span style={{
                            width: '1px', height: '20px', background: theme.colors.border,
                            margin: '0 4px',
                          }} />
                        )}
                        <button
                          onClick={() => setSelectedMonth(mk)}
                          style={{
                            padding: '4px 10px',
                            border: selectedMonth === mk
                              ? `2px solid ${theme.colors.primary}`
                              : `1px solid ${theme.colors.border}`,
                            borderRadius: theme.borderRadius.sm,
                            background: selectedMonth === mk ? theme.colors.primary : theme.colors.cardBg,
                            color: selectedMonth === mk ? '#fff' : theme.colors.text,
                            fontFamily: theme.fonts.body, fontSize: '0.78rem',
                            fontWeight: selectedMonth === mk ? 600 : 400,
                            cursor: 'pointer', transition: 'all 0.15s',
                          }}
                        >
                          {periodToMonthName(mk)}{multiYear ? ` '${mk.slice(2, 4)}` : ''}
                        </button>
                      </React.Fragment>
                    );
                  })}
                </div>
              );
            })()}

            {/* Quarter sub-selector */}
            {timePeriod === 'quarterly' && timePeriodData?.availableQuarters && (
              <div style={{ display: 'flex', gap: '4px' }}>
                {timePeriodData.availableQuarters.map(q => (
                  <button
                    key={q}
                    onClick={() => setSelectedQuarter(q)}
                    style={{
                      padding: '4px 14px',
                      border: selectedQuarter === q
                        ? `2px solid ${theme.colors.primary}`
                        : `1px solid ${theme.colors.border}`,
                      borderRadius: theme.borderRadius.sm,
                      background: selectedQuarter === q ? theme.colors.primary : theme.colors.cardBg,
                      color: selectedQuarter === q ? '#fff' : theme.colors.text,
                      fontFamily: theme.fonts.body, fontSize: '0.78rem',
                      fontWeight: selectedQuarter === q ? 600 : 400,
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            {/* Metric toggle ($ / Units) */}
            {hasBothMetrics && (
              <div style={{
                display: 'flex', marginLeft: 'auto',
                border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.sm,
                overflow: 'hidden',
              }}>
                {[
                  { key: 'dollars', label: '$' },
                  { key: 'units', label: 'Units' },
                ].map(opt => {
                  const isActive = (metricMode === 'auto' ? 'dollars' : metricMode) === opt.key;
                  return (
                    <button key={opt.key} onClick={() => setMetricMode(opt.key)} style={{
                      padding: '4px 12px', border: 'none', cursor: 'pointer',
                      fontFamily: theme.fonts.body, fontSize: '0.75rem', fontWeight: isActive ? 600 : 400,
                      background: isActive ? theme.colors.primary : theme.colors.cardBg,
                      color: isActive ? '#fff' : theme.colors.text,
                      transition: 'all 0.15s',
                    }}>
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Period label */}
            {timePeriodData?.periodLabel && (
              <span style={{
                fontFamily: theme.fonts.body, fontSize: '0.82rem',
                color: theme.colors.textLight, ...(!hasBothMetrics ? { marginLeft: 'auto' } : {}),
              }}>
                {timePeriodData.periodLabel}
              </span>
            )}
          </div>
        )}

        {/* Main content */}
        <main style={{
          flex: 1, padding: theme.spacing.xl,
          maxWidth: '1440px', width: '100%', margin: '0 auto',
        }}>
          {loading && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', padding: theme.spacing.xxl, gap: theme.spacing.md,
            }}>
              <div style={{
                width: 48, height: 48,
                border: `4px solid ${theme.colors.border}`,
                borderTopColor: theme.colors.primary,
                borderRadius: '50%', animation: 'spin 0.8s linear infinite',
              }} />
              <p style={{ color: theme.colors.textLight, fontFamily: theme.fonts.body }}>
                Loading data...
              </p>
            </div>
          )}

          {error && (
            <div style={{
              background: '#fff5f5', border: `1px solid ${theme.colors.danger}`,
              borderRadius: theme.borderRadius.lg, padding: theme.spacing.xl,
              color: theme.colors.danger, fontFamily: theme.fonts.body, textAlign: 'center',
            }}>
              <p style={{ fontWeight: 600, marginBottom: theme.spacing.sm }}>Error</p>
              <p>{error}</p>
            </div>
          )}

          {!loading && !error && (
            <>
              {/* Quarterly Overview — shown above active tab */}
              {timePeriod === 'quarterly' && timePeriodData?.quarterOverview && (
                <QuarterlyOverview
                  quarters={timePeriodData.quarterOverview}
                  selectedQuarter={selectedQuarter}
                  setSelectedQuarter={setSelectedQuarter}
                  primaryMetric={timePeriodData.primaryMetric}
                />
              )}

              {/* YTD Overview — shown above active tab */}
              {timePeriod === 'ytd' && timePeriodData?.currentData && (
                <YTDOverview
                  trendData={timePeriodData.trendData}
                  currentData={timePeriodData.currentData}
                  comparisonData={timePeriodData.comparisonData}
                  fullPrevYearData={timePeriodData.fullPrevYearData}
                  primaryMetric={timePeriodData.primaryMetric}
                  comparableMonths={timePeriodData.comparableMonths}
                  yepDollars={timePeriodData.yepDollars}
                  yepUnits={timePeriodData.yepUnits}
                  paceDollarsPct={timePeriodData.paceDollarsPct}
                  paceUnitsPct={timePeriodData.paceUnitsPct}
                  yearA={timePeriodData.yearA}
                  yearB={timePeriodData.yearB}
                  periodLabel={timePeriodData.periodLabel}
                />
              )}

              {renderActiveTab()}
            </>
          )}
        </main>

        {/* Footer */}
        <footer style={{
          background: theme.colors.secondary,
          padding: `${theme.spacing.sm} ${theme.spacing.xl}`,
          textAlign: 'center', color: 'rgba(255,255,255,0.5)',
          fontFamily: theme.fonts.body, fontSize: '0.75rem',
        }}>
          Irwin Naturals &copy; {new Date().getFullYear()} &mdash; Internal POS Analytics
        </footer>
      </div>
    </>
  );
}
