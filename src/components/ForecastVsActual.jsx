import React, { useMemo } from 'react';
import { theme } from '../styles/theme';
import { useResponsive } from '../hooks/useResponsive';
import { getSortedPeriods, periodToMonthName, sumPeriod } from '../utils/timePeriodUtils';
import { Target, AlertCircle } from 'lucide-react';
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
  ReferenceLine,
} from 'recharts';

function formatDollar(val) {
  if (val >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
  if (val >= 1e3) return `$${(val / 1e3).toFixed(0)}K`;
  return `$${val.toFixed(0)}`;
}

export default function ForecastVsActual({ forecast, posData }) {
  const chartData = useMemo(() => {
    if (!forecast || !forecast.periods || !posData || !posData.periods) return [];

    const posPeriods = getSortedPeriods(posData.periods);
    const forecastPeriods = Object.keys(forecast.periods).sort();
    const allPeriods = [...new Set([...posPeriods, ...forecastPeriods])].sort();

    return allPeriods.map(key => {
      const actualData = posData.periods[key] ? sumPeriod(posData.periods[key]) : null;
      const forecastData = forecast.periods[key] || null;

      let forecastDollars = null;
      if (forecastData) {
        if (typeof forecastData === 'number') {
          forecastDollars = forecastData;
        } else if (forecastData.dollars != null) {
          forecastDollars = forecastData.dollars;
        } else {
          // Sum UPC-level forecast
          forecastDollars = Object.values(forecastData).reduce((s, v) => {
            if (typeof v === 'number') return s + v;
            return s + (v.dollars || 0);
          }, 0);
        }
      }

      const month = periodToMonthName(key);
      const year = key.slice(2, 4);
      const actualDollars = actualData ? actualData.dollars : null;
      const variance = (actualDollars != null && forecastDollars != null && forecastDollars > 0)
        ? ((actualDollars - forecastDollars) / forecastDollars) * 100
        : null;

      return {
        period: `${month} '${year}`,
        periodKey: key,
        actual: actualDollars,
        forecast: forecastDollars,
        variance,
      };
    });
  }, [forecast, posData]);

  const { isMobile } = useResponsive();

  if (!forecast) {
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
        <AlertCircle size={48} style={{ color: theme.colors.textLight }} />
        <p style={{ fontFamily: theme.fonts.heading, fontSize: '1.1rem', color: theme.colors.textLight }}>
          No forecast data available
        </p>
        <p style={{ fontFamily: theme.fonts.body, fontSize: '0.85rem', color: theme.colors.textLight }}>
          Forecast data has not been configured for this retailer.
        </p>
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div style={{ padding: theme.spacing.xl, textAlign: 'center', color: theme.colors.textLight }}>
        No matching periods found between forecast and actual data.
      </div>
    );
  }

  // Summary stats
  const periodsWithBoth = chartData.filter(d => d.actual != null && d.forecast != null);
  const totalActual = periodsWithBoth.reduce((s, d) => s + (d.actual || 0), 0);
  const totalForecast = periodsWithBoth.reduce((s, d) => s + (d.forecast || 0), 0);
  const overallVariance = totalForecast > 0 ? ((totalActual - totalForecast) / totalForecast) * 100 : null;
  const mape = periodsWithBoth.length > 0
    ? periodsWithBoth.reduce((s, d) => s + Math.abs((d.actual - d.forecast) / d.forecast), 0) / periodsWithBoth.length * 100
    : null;

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
        Forecast vs Actual
      </h2>

      {/* Summary cards */}
      <div
        style={{
          display: 'flex',
          gap: theme.spacing.lg,
          marginBottom: theme.spacing.lg,
          flexWrap: 'wrap',
        }}
      >
        {[
          { label: 'Total Actual', value: formatDollar(totalActual), color: theme.colors.primary },
          { label: 'Total Forecast', value: formatDollar(totalForecast), color: theme.colors.chartColors[1] },
          {
            label: 'Overall Variance',
            value: overallVariance != null ? `${overallVariance >= 0 ? '+' : ''}${overallVariance.toFixed(1)}%` : 'N/A',
            color: overallVariance != null && overallVariance >= 0 ? theme.colors.success : theme.colors.danger,
          },
          {
            label: 'MAPE',
            value: mape != null ? `${mape.toFixed(1)}%` : 'N/A',
            color: theme.colors.chartColors[4],
          },
        ].map((item, i) => (
          <div
            key={i}
            style={{
              flex: '1 1 180px',
              background: theme.colors.cardBg,
              borderRadius: theme.borderRadius.md,
              boxShadow: theme.shadows.sm,
              padding: isMobile ? theme.spacing.md : theme.spacing.lg,
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

      {/* Chart */}
      <div
        style={{
          background: theme.colors.cardBg,
          borderRadius: theme.borderRadius.lg,
          boxShadow: theme.shadows.sm,
          padding: theme.spacing.xl,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.md }}>
          <Target size={16} style={{ color: theme.colors.secondary }} />
          <h3
            style={{
              fontFamily: theme.fonts.heading,
              fontSize: '1rem',
              color: theme.colors.secondary,
            }}
          >
            Forecast vs Actual by Period
          </h3>
        </div>
        <ResponsiveContainer width="100%" height={isMobile ? 280 : 400}>
          <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={theme.colors.border} />
            <XAxis
              dataKey="period"
              tick={{ fontFamily: theme.fonts.body, fontSize: 11, fill: theme.colors.textLight }}
              tickLine={false}
            />
            <YAxis
              yAxisId="dollars"
              tickFormatter={formatDollar}
              tick={{ fontFamily: theme.fonts.body, fontSize: 11, fill: theme.colors.textLight }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              yAxisId="pct"
              orientation="right"
              tickFormatter={v => `${v.toFixed(0)}%`}
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
                if (name === 'Variance %') return [value != null ? `${value.toFixed(1)}%` : 'N/A', name];
                return [value != null ? `$${value.toLocaleString()}` : 'N/A', name];
              }}
            />
            <Legend wrapperStyle={{ fontFamily: theme.fonts.body, fontSize: '0.8rem' }} />
            <ReferenceLine yAxisId="pct" y={0} stroke={theme.colors.border} strokeDasharray="3 3" />
            <Bar
              yAxisId="dollars"
              dataKey="actual"
              name="Actual"
              fill={theme.colors.primary}
              radius={[3, 3, 0, 0]}
            />
            <Line
              yAxisId="dollars"
              type="monotone"
              dataKey="forecast"
              name="Forecast"
              stroke={theme.colors.chartColors[1]}
              strokeWidth={2.5}
              strokeDasharray="6 3"
              dot={{ r: 4, fill: theme.colors.chartColors[1] }}
              connectNulls
            />
            <Line
              yAxisId="pct"
              type="monotone"
              dataKey="variance"
              name="Variance %"
              stroke={theme.colors.chartColors[2]}
              strokeWidth={1.5}
              dot={{ r: 3 }}
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
