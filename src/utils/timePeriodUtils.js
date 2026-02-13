/**
 * Utility functions for time period analysis — unified version.
 * Works with the universal schema where periods are keyed as "YYYY-MM".
 */

export const TIME_PERIODS = {
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  QUARTERLY: 'quarterly',
  YTD: 'ytd',
};

/**
 * Parse "YYYY-MM" period keys into sorted arrays by year.
 */
export function groupPeriodsByYear(periods) {
  const byYear = {};
  Object.keys(periods).forEach(key => {
    const year = key.slice(0, 4);
    if (!byYear[year]) byYear[year] = [];
    byYear[year].push(key);
  });
  // Sort each year's periods chronologically
  Object.values(byYear).forEach(arr => arr.sort());
  return byYear;
}

/**
 * Get sorted list of all period keys.
 */
export function getSortedPeriods(periods) {
  return Object.keys(periods).sort();
}

/**
 * Get the two most recent years in the data.
 * Returns [olderYear, newerYear].
 */
export function getYearPair(periods) {
  const years = [...new Set(Object.keys(periods).map(k => k.slice(0, 4)))].sort();
  if (years.length < 2) return [years[0], years[0]];
  return [years[years.length - 2], years[years.length - 1]];
}

const QUARTER_MAP = {
  '01': 'Q1', '02': 'Q1', '03': 'Q1',
  '04': 'Q2', '05': 'Q2', '06': 'Q2',
  '07': 'Q3', '08': 'Q3', '09': 'Q3',
  '10': 'Q4', '11': 'Q4', '12': 'Q4',
};

export const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

export function periodToMonthName(periodKey) {
  const month = parseInt(periodKey.slice(5, 7), 10);
  return MONTH_NAMES[month - 1] || periodKey;
}

export function periodToQuarter(periodKey) {
  const mm = periodKey.slice(5, 7);
  return QUARTER_MAP[mm] || 'Q1';
}

/**
 * Aggregate period data into quarters.
 * Returns { "2025-Q1": { upc: { dollars, units, ... }, ... }, ... }
 */
export function aggregateByQuarter(periods) {
  const result = {};
  Object.entries(periods).forEach(([periodKey, products]) => {
    const year = periodKey.slice(0, 4);
    const q = periodToQuarter(periodKey);
    const qKey = `${year}-${q}`;
    if (!result[qKey]) result[qKey] = {};
    Object.entries(products).forEach(([upc, metrics]) => {
      if (!result[qKey][upc]) {
        result[qKey][upc] = { dollars: 0, units: 0 };
      }
      result[qKey][upc].dollars += metrics.dollars || 0;
      result[qKey][upc].units += metrics.units || 0;
    });
  });
  return result;
}

/**
 * Aggregate all periods in a year into a single YTD bucket.
 * Only includes months that exist in BOTH years for fair comparison.
 */
export function aggregateYTD(periods) {
  const [yearA, yearB] = getYearPair(periods);
  const monthsA = Object.keys(periods).filter(k => k.startsWith(yearA)).map(k => k.slice(5));
  const monthsB = Object.keys(periods).filter(k => k.startsWith(yearB)).map(k => k.slice(5));
  const commonMonths = monthsA.filter(m => monthsB.includes(m));

  const sumYear = (year) => {
    const totals = {};
    commonMonths.forEach(mm => {
      const key = `${year}-${mm}`;
      const products = periods[key];
      if (!products) return;
      Object.entries(products).forEach(([upc, metrics]) => {
        if (!totals[upc]) totals[upc] = { dollars: 0, units: 0 };
        totals[upc].dollars += metrics.dollars || 0;
        totals[upc].units += metrics.units || 0;
      });
    });
    return totals;
  };

  return {
    [yearA]: sumYear(yearA),
    [yearB]: sumYear(yearB),
    comparableMonths: commonMonths.length,
  };
}

/**
 * Calculate total dollars and units for a single period's data.
 */
export function sumPeriod(periodData) {
  if (!periodData) return { dollars: 0, units: 0, productCount: 0 };
  let dollars = 0, units = 0, count = 0;
  Object.values(periodData).forEach(m => {
    dollars += m.dollars || 0;
    units += m.units || 0;
    if ((m.dollars || 0) > 0 || (m.units || 0) > 0) count++;
  });
  return { dollars, units, productCount: count };
}

// ── Time Period Slice Functions ──────────────────────────────────────

const QUARTER_MONTHS = {
  Q1: ['01', '02', '03'],
  Q2: ['04', '05', '06'],
  Q3: ['07', '08', '09'],
  Q4: ['10', '11', '12'],
};

export function getQuarterMonths(quarter) {
  return QUARTER_MONTHS[quarter] || [];
}

/**
 * Get months available for selection, sorted chronologically.
 * Shows both latest two years so retailers with sparse latest-year data
 * (e.g. Sprouts with only Jan 2026) still show the full prior year.
 */
export function getAvailableMonths(periods) {
  const [yearA, yearB] = getYearPair(periods);
  const sorted = getSortedPeriods(periods);
  if (yearA === yearB) return sorted; // single year — show all
  return sorted.filter(k => k.startsWith(yearA) || k.startsWith(yearB));
}

/**
 * Get quarters that have data in the latest two years.
 * Returns quarter labels prefixed with year, e.g. "2025-Q3", "2026-Q1".
 */
export function getAvailableQuarters(periods) {
  const [yearA, yearB] = getYearPair(periods);
  const result = [];
  const years = yearA === yearB ? [yearB] : [yearA, yearB];
  years.forEach(year => {
    ['Q1', 'Q2', 'Q3', 'Q4'].forEach(q => {
      const qMonths = getQuarterMonths(q);
      const hasData = qMonths.some(mm => periods[`${year}-${mm}`]);
      if (hasData) result.push(`${year}-${q}`);
    });
  });
  return result;
}

/**
 * Sum product-level metrics across multiple period keys.
 * Returns { upc: { dollars, units } }
 */
export function aggregateProductData(periods, periodKeys) {
  const result = {};
  periodKeys.forEach(key => {
    const products = periods[key];
    if (!products) return;
    Object.entries(products).forEach(([upc, metrics]) => {
      if (!result[upc]) result[upc] = { dollars: 0, units: 0 };
      result[upc].dollars += metrics.dollars || 0;
      result[upc].units += metrics.units || 0;
    });
  });
  return result;
}

/**
 * Detect whether this retailer has meaningful dollar data.
 * Returns 'dollars' or 'units'.
 */
export function detectPrimaryMetric(periods) {
  let totalDollars = 0;
  const sorted = getSortedPeriods(periods);
  const sample = sorted.slice(-3);
  sample.forEach(key => {
    Object.values(periods[key] || {}).forEach(m => {
      totalDollars += m.dollars || 0;
    });
  });
  return totalDollars > 0 ? 'dollars' : 'units';
}

/**
 * Format a value based on whether it's dollars or units.
 */
export function formatValue(val, useDollars) {
  if (val == null || isNaN(val)) return useDollars ? '$0' : '0';
  if (useDollars) {
    if (Math.abs(val) >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
    if (Math.abs(val) >= 1e3) return `$${(val / 1e3).toFixed(1)}K`;
    return `$${val.toFixed(0)}`;
  }
  return val.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

/**
 * Build trend data array from periods (all periods, for charting).
 */
function buildTrendData(periods, periodKeys) {
  return periodKeys.map(key => {
    const agg = sumPeriod(periods[key]);
    return {
      period: key,
      label: `${periodToMonthName(key)} '${key.slice(2, 4)}`,
      year: key.slice(0, 4),
      month: key.slice(5, 7),
      dollars: agg.dollars,
      units: agg.units,
      productCount: agg.productCount,
    };
  });
}

/**
 * Compute monthly time slice for a selected month.
 */
export function computeMonthlySlice(periods, monthKey) {
  const selectedYear = monthKey.slice(0, 4);
  const mm = monthKey.slice(5, 7);
  const comparisonYear = String(Number(selectedYear) - 1);
  const comparisonKey = `${comparisonYear}-${mm}`;

  const currentData = periods[monthKey] || {};
  // Use same month from the prior year for YoY comparison
  const comparisonData = periods[comparisonKey] ? periods[comparisonKey] : {};

  // Trend: all sorted periods for the full timeline chart
  const sorted = getSortedPeriods(periods);
  const trendData = buildTrendData(periods, sorted);

  // Full previous year for Pace % baseline
  const prevYearKeys = sorted.filter(k => k.startsWith(comparisonYear));
  const fullPrevYearData = aggregateProductData(periods, prevYearKeys);

  const periodLabel = `${periodToMonthName(monthKey)} ${monthKey.slice(0, 4)}`;

  return {
    currentData,
    comparisonData,
    trendData,
    periodLabel,
    fullPrevYearData,
    comparableMonths: 1,
    monthsWithData: 1,
    isComplete: true,
  };
}

/**
 * Compute quarterly time slice for a selected quarter.
 * Quarter format: "YYYY-QN" (e.g. "2025-Q3").
 * Uses comparable months (present in both years) for fair YoY.
 */
export function computeQuarterlySlice(periods, quarterKey) {
  // Parse "YYYY-QN" format
  const selectedYear = quarterKey.slice(0, 4);
  const qLabel = quarterKey.slice(5); // "Q1", "Q2", etc.
  const qMonths = getQuarterMonths(qLabel);

  // Find the year-ago year for comparison
  const allYears = [...new Set(Object.keys(periods).map(k => k.slice(0, 4)))].sort();
  const yearIdx = allYears.indexOf(selectedYear);
  const prevYear = yearIdx > 0 ? allYears[yearIdx - 1] : null;

  // Current year months in this quarter
  const currentKeys = qMonths
    .map(mm => `${selectedYear}-${mm}`)
    .filter(k => periods[k]);

  // Previous year months in this quarter (only comparable ones)
  const comparisonKeys = prevYear
    ? qMonths
        .map(mm => `${prevYear}-${mm}`)
        .filter(k => periods[k] && currentKeys.some(ck => ck.slice(5, 7) === k.slice(5, 7)))
    : [];

  const currentData = aggregateProductData(periods, currentKeys);
  const comparisonData = aggregateProductData(periods, comparisonKeys);

  // Full previous year quarter (all available months) for Pace %
  const fullPrevQuarterKeys = prevYear
    ? qMonths.map(mm => `${prevYear}-${mm}`).filter(k => periods[k])
    : [];
  const fullPrevYearData = aggregateProductData(periods, fullPrevQuarterKeys);

  // Trend: monthly within this quarter for both years
  const trendKeys = [];
  qMonths.forEach(mm => {
    if (prevYear) {
      const keyA = `${prevYear}-${mm}`;
      if (periods[keyA]) trendKeys.push(keyA);
    }
    const keyB = `${selectedYear}-${mm}`;
    if (periods[keyB]) trendKeys.push(keyB);
  });
  trendKeys.sort();
  const trendData = buildTrendData(periods, trendKeys);

  const monthsWithData = currentKeys.length;
  const isComplete = monthsWithData === 3;
  const currentTotals = sumPeriod(currentData);
  const qepDollars = monthsWithData > 0 ? (currentTotals.dollars / monthsWithData) * 3 : 0;
  const qepUnits = monthsWithData > 0 ? (currentTotals.units / monthsWithData) * 3 : 0;

  const periodLabel = `${qLabel} ${selectedYear}`;

  return {
    currentData,
    comparisonData,
    trendData,
    periodLabel,
    fullPrevYearData,
    comparableMonths: comparisonKeys.length,
    monthsWithData,
    isComplete,
    qepDollars,
    qepUnits,
  };
}

/**
 * Compute YTD (annual) time slice.
 * Uses only comparable months for fair YoY. Calculates YEP and Pace %.
 */
export function computeYTDSlice(periods) {
  const [yearA, yearB] = getYearPair(periods);
  const sorted = getSortedPeriods(periods);

  const yearBKeys = sorted.filter(k => k.startsWith(yearB));
  const yearAKeys = sorted.filter(k => k.startsWith(yearA));

  const yearBMonths = yearBKeys.map(k => k.slice(5, 7));
  const yearAMonths = yearAKeys.map(k => k.slice(5, 7));
  const commonMonths = (yearA !== yearB)
    ? yearBMonths.filter(mm => yearAMonths.includes(mm))
    : [];

  const currentKeys = commonMonths.length > 0
    ? commonMonths.map(mm => `${yearB}-${mm}`)
    : yearBKeys;
  const comparisonKeys = commonMonths.map(mm => `${yearA}-${mm}`);

  const currentData = aggregateProductData(periods, currentKeys);
  const comparisonData = aggregateProductData(periods, comparisonKeys);

  // Full previous year for Pace % baseline
  const fullPrevYearData = aggregateProductData(periods, yearAKeys);

  // Trend: monthly for both years
  const allMonths = [...new Set([...yearAMonths, ...yearBMonths])].sort();
  const trendKeys = [];
  allMonths.forEach(mm => {
    if (yearA !== yearB) {
      const keyA = `${yearA}-${mm}`;
      if (periods[keyA]) trendKeys.push(keyA);
    }
    const keyB = `${yearB}-${mm}`;
    if (periods[keyB]) trendKeys.push(keyB);
  });
  trendKeys.sort();
  const trendData = buildTrendData(periods, trendKeys);

  const comparableMonths = commonMonths.length || yearBKeys.length;
  const currentTotals = sumPeriod(currentData);
  const yepDollars = comparableMonths > 0 ? (currentTotals.dollars / comparableMonths) * 12 : 0;
  const yepUnits = comparableMonths > 0 ? (currentTotals.units / comparableMonths) * 12 : 0;

  const fullPrevTotals = sumPeriod(fullPrevYearData);
  const paceDollarsPct = fullPrevTotals.dollars > 0
    ? ((yepDollars - fullPrevTotals.dollars) / fullPrevTotals.dollars) * 100 : 0;
  const paceUnitsPct = fullPrevTotals.units > 0
    ? ((yepUnits - fullPrevTotals.units) / fullPrevTotals.units) * 100 : 0;

  const firstMM = (commonMonths.length > 0 ? commonMonths : yearBMonths)[0];
  const lastMM = (commonMonths.length > 0 ? commonMonths : yearBMonths).slice(-1)[0];
  const firstMonth = firstMM ? MONTH_NAMES[parseInt(firstMM, 10) - 1] : '';
  const lastMonth = lastMM ? MONTH_NAMES[parseInt(lastMM, 10) - 1] : '';
  const periodLabel = `${yearB} YTD (${firstMonth}–${lastMonth})`;

  return {
    currentData,
    comparisonData,
    trendData,
    periodLabel,
    fullPrevYearData,
    comparableMonths,
    monthsWithData: currentKeys.length,
    isComplete: currentKeys.length === 12,
    yepDollars,
    yepUnits,
    paceDollarsPct,
    paceUnitsPct,
    yearA,
    yearB,
  };
}

/**
 * Build quarter-over-quarter overview for the quarterly summary cards.
 * Covers both years (yearA and yearB) so retailers with sparse latest-year
 * data still show a full set of quarters.
 */
export function getAllQuarterOverview(periods) {
  const [yearA, yearB] = getYearPair(periods);
  const primaryMetric = detectPrimaryMetric(periods);
  const useDollars = primaryMetric === 'dollars';
  const allYears = [...new Set(Object.keys(periods).map(k => k.slice(0, 4)))].sort();

  const years = yearA === yearB ? [yearB] : [yearA, yearB];
  const result = [];

  years.forEach(year => {
    ['Q1', 'Q2', 'Q3', 'Q4'].forEach(q => {
      const qMonths = getQuarterMonths(q);
      const currentKeys = qMonths.map(mm => `${year}-${mm}`).filter(k => periods[k]);
      if (currentKeys.length === 0) return;

      const currentAgg = aggregateProductData(periods, currentKeys);
      const currentTotals = sumPeriod(currentAgg);

      // Find year-ago for comparison
      const yearIdx = allYears.indexOf(year);
      const prevYear = yearIdx > 0 ? allYears[yearIdx - 1] : null;

      const fairCompKeys = prevYear
        ? qMonths.map(mm => `${prevYear}-${mm}`).filter(k =>
            periods[k] && currentKeys.some(ck => ck.slice(5, 7) === k.slice(5, 7)))
        : [];
      const compTotals = sumPeriod(aggregateProductData(periods, fairCompKeys));

      const fullPrevKeys = prevYear
        ? qMonths.map(mm => `${prevYear}-${mm}`).filter(k => periods[k])
        : [];
      const fullPrevTotals = sumPeriod(aggregateProductData(periods, fullPrevKeys));

      const val = useDollars ? currentTotals.dollars : currentTotals.units;
      const compVal = useDollars ? compTotals.dollars : compTotals.units;
      const fullPrevVal = useDollars ? fullPrevTotals.dollars : fullPrevTotals.units;

      const monthsWithData = currentKeys.length;
      const isComplete = monthsWithData === 3;
      const qep = monthsWithData > 0 ? (val / monthsWithData) * 3 : 0;
      const yoyPct = compVal > 0 ? ((val - compVal) / compVal) * 100 : null;
      const pacePercent = fullPrevVal > 0 ? ((qep - fullPrevVal) / fullPrevVal) * 100 : null;

      result.push({
        quarter: `${year}-${q}`,
        displayLabel: `${q} ${year}`,
        currentTotal: val,
        comparisonTotal: compVal,
        qep,
        monthsWithData,
        isComplete,
        yoyPct,
        pacePercent,
        monthCount: `${monthsWithData} of 3 months`,
        productCount: currentTotals.productCount,
      });
    });
  });

  return result;
}

// ── Weekly Period Functions ──────────────────────────────────────────

/**
 * Get sorted week keys from the latest ~2 years of weekly data.
 * Weekly keys are "YYYY-MM-DD" (week-ending dates).
 */
export function getAvailableWeeks(weeklyPeriods) {
  if (!weeklyPeriods) return [];
  const sorted = Object.keys(weeklyPeriods).sort();
  if (sorted.length === 0) return sorted;
  const latestDate = new Date(sorted[sorted.length - 1]);
  const cutoff = new Date(latestDate);
  cutoff.setFullYear(cutoff.getFullYear() - 2);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return sorted.filter(k => k >= cutoffStr);
}

/**
 * Format a week key "YYYY-MM-DD" to a short display label.
 */
export function weekKeyToLabel(weekKey) {
  const d = new Date(weekKey + 'T00:00:00');
  const mon = MONTH_NAMES[d.getMonth()];
  return `${mon} ${d.getDate()}, '${String(d.getFullYear()).slice(2)}`;
}

/**
 * Compute weekly time slice for a selected week.
 * Comparison = same week# from prior year (closest date ±7 days from 52 weeks ago).
 * Trend = recent 12-week rolling window ending at the selected week.
 */
export function computeWeeklySlice(weeklyPeriods, weekKey) {
  const sorted = Object.keys(weeklyPeriods).sort();
  const weekIdx = sorted.indexOf(weekKey);

  const currentData = weeklyPeriods[weekKey] || {};

  // Find year-ago comparison week (closest date ±7 days from exactly 52 weeks ago)
  const selectedDate = new Date(weekKey + 'T00:00:00');
  const yagoTarget = new Date(selectedDate);
  yagoTarget.setDate(yagoTarget.getDate() - 364); // 52 weeks
  const yagoTargetMs = yagoTarget.getTime();

  let bestCompKey = null;
  let bestDiff = Infinity;
  sorted.forEach(k => {
    const kDate = new Date(k + 'T00:00:00');
    const diff = Math.abs(kDate.getTime() - yagoTargetMs);
    if (diff < bestDiff && diff <= 7 * 86400000) {
      bestDiff = diff;
      bestCompKey = k;
    }
  });

  const comparisonData = bestCompKey ? (weeklyPeriods[bestCompKey] || {}) : {};

  // Trend: 12-week rolling window ending at selected week
  const trendStartIdx = Math.max(0, weekIdx - 11);
  const trendKeys = sorted.slice(trendStartIdx, weekIdx + 1);
  const trendData = trendKeys.map(k => {
    const agg = sumPeriod(weeklyPeriods[k]);
    const d = new Date(k + 'T00:00:00');
    const mon = MONTH_NAMES[d.getMonth()];
    return {
      period: k,
      label: `${mon} ${d.getDate()}`,
      year: k.slice(0, 4),
      month: k.slice(5, 7),
      dollars: agg.dollars,
      units: agg.units,
      productCount: agg.productCount,
    };
  });

  const periodLabel = `Week ending ${weekKeyToLabel(weekKey)}`;

  return {
    currentData,
    comparisonData,
    trendData,
    periodLabel,
    fullPrevYearData: comparisonData,
    comparableMonths: 1,
    monthsWithData: 1,
    isComplete: true,
  };
}
