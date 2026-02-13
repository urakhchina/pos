/**
 * Data loader — fetches and caches retailer JSON files from public/data/
 */

const cache = new Map();

async function fetchJSON(url) {
  if (cache.has(url)) return cache.get(url);
  const res = await fetch(url);
  if (!res.ok) return null;
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) return null;
  const data = await res.json();
  cache.set(url, data);
  return data;
}

export async function loadManifest() {
  return fetchJSON('/data/data_manifest.json');
}

export async function loadRetailerData(retailerKey) {
  const base = `/data/${retailerKey}`;
  const posData = await fetchJSON(`${base}/pos_data.json`);
  if (!posData) return null;

  // Attempt to load supplemental files (may not exist for every retailer)
  const [inventory, ltoos, forecast, ecommerce] = await Promise.all([
    fetchJSON(`${base}/inventory.json`),
    fetchJSON(`${base}/ltoos_history.json`),
    fetchJSON(`${base}/forecast_data.json`),
    fetchJSON(`${base}/ecommerce.json`),
  ]);

  return {
    posData,
    inventory,
    ltoos,
    forecast,
    ecommerce,
  };
}

export function clearCache() {
  cache.clear();
}
