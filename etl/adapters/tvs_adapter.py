"""
TVS (The Vitamin Shoppe) adapter.

Sources:
    - TVS/Irwin Naturals_All In Stock *.xlsx
      Snapshot files with columns: SKU ID, SKU DESC, Department DESC,
      Sub Department DESC, Class DESC, UPC ID, ..., Store Counts,
      Avg 08 Weeks Sales Units, InStock %, OH Units, etc.

Notes:
    - These are point-in-time inventory/distribution snapshots, not POS sales.
    - "Avg 08 Weeks Sales Units" is used as a proxy for units in that period.
    - Multiple files per month — the latest file date wins for each month.
    - Inventory data (InStock %, Store WOS, OH Units) goes to inventory.json.
"""

import os
import re
from datetime import datetime

import pandas as pd

from etl.base_adapter import BaseAdapter


class TVSAdapter(BaseAdapter):
    retailer_key = "tvs"
    display_name = "TVS"

    # ── extract ─────────────────────────────────────────────────────────
    def extract(self):
        tvs_dir = os.path.join(self.source_dir, "TVS")
        if not os.path.isdir(tvs_dir):
            raise FileNotFoundError(f"TVS directory not found: {tvs_dir}")

        pattern = re.compile(
            r"Irwin Naturals_All In Stock (\d{1,2})\.(\d{1,2})\.(\d{2,4})(?:\[\d+\])?\.xlsx$"
        )

        file_entries = []
        for fname in os.listdir(tvs_dir):
            m = pattern.match(fname)
            if m:
                month_val = int(m.group(1))
                day_val = int(m.group(2))
                year_val = int(m.group(3))
                # Handle 2-digit year
                if year_val < 100:
                    year_val += 2000
                try:
                    file_date = datetime(year_val, month_val, day_val)
                    file_entries.append((file_date, os.path.join(tvs_dir, fname)))
                except ValueError:
                    print(f"  [TVS] WARNING: Could not parse date from {fname}")

        if not file_entries:
            raise FileNotFoundError(f"No TVS snapshot files found in {tvs_dir}")

        # Sort by date
        file_entries.sort(key=lambda x: x[0])

        # Group by year-month, take the latest file per month
        monthly_files = {}
        for file_date, fpath in file_entries:
            ym = file_date.strftime("%Y-%m")
            # Overwrite — since sorted ascending, the last one per month wins
            monthly_files[ym] = (file_date, fpath)

        self.raw_data = {"monthly_files": monthly_files}
        print(f"  [TVS] Found {len(monthly_files)} monthly snapshots "
              f"from {len(file_entries)} files")

    # ── transform ───────────────────────────────────────────────────────
    def transform(self):
        products_map = {}
        periods = {}
        inventory_records = []

        for ym, (file_date, fpath) in sorted(self.raw_data["monthly_files"].items()):
            try:
                df = pd.read_excel(fpath)
            except Exception as e:
                print(f"  [TVS] WARNING: Could not read {fpath}: {e}")
                continue

            print(f"  [TVS] Processing {os.path.basename(fpath)}: {len(df)} rows -> {ym}")

            # Column name mapping — TVS files have inconsistent column names
            col_map = {}
            cols_lower = {c.lower().strip(): c for c in df.columns}
            def find_col(*candidates):
                for c in candidates:
                    if c in df.columns:
                        return c
                    if c.lower() in cols_lower:
                        return cols_lower[c.lower()]
                return None

            upc_col = find_col("UPC ID", "UPC")
            desc_col = find_col("SKU DESC", "Description")
            brand_col = find_col("Brand Name ID", "Brand")
            dept_col = find_col("Department DESC", "Dept")
            subdept_col = find_col("Sub Department DESC", "Sub-Dept")
            status_col = find_col("Overall Status ID", "Item Status")
            store_ct_col = find_col("Store Counts", "Store Ct")
            instock_col = find_col("InStock %", "Instock %")
            avg_units_col = find_col("Avg 08 Weeks Sales Units", "Last 8 Wks Avg Sales ", "Last 8 Wks Avg Sales")
            store_wos_col = find_col("Store WOS (8 Weeks) Units", "Store WOS")
            oh_store_col = find_col("OH Units Store", "Store OH")
            oh_dc_col = find_col("OH Units DC", "DC OH")
            oh_total_col = find_col("OH Units")

            if not upc_col:
                print(f"  [TVS] WARNING: No UPC column found in {os.path.basename(fpath)}, skipping")
                continue

            # Normalize UPC
            df["upc_clean"] = (
                df[upc_col]
                .astype(str)
                .str.strip()
                .str.replace(r"\.0$", "", regex=True)
                .apply(self.normalize_upc)
            )

            # Numeric columns
            for col in [avg_units_col, store_ct_col, instock_col,
                        store_wos_col, oh_store_col, oh_dc_col, oh_total_col]:
                if col and col in df.columns:
                    df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

            period_data = {}
            for _, row in df.iterrows():
                upc = row["upc_clean"]
                if upc == "0000000000000":
                    continue

                # Product info
                if upc not in products_map:
                    products_map[upc] = {
                        "upc": upc,
                        "product_name": str(row.get(desc_col, "")).strip() if desc_col else "",
                        "brand": str(row.get(brand_col, "")).strip() if brand_col else "Irwin Naturals",
                        "category": str(row.get(dept_col, "")).strip() if dept_col else "",
                        "subcategory": str(row.get(subdept_col, "")).strip() if subdept_col else "",
                    }

                # Units — use avg 8 weeks sales as proxy
                avg_units = float(row.get(avg_units_col, 0)) if avg_units_col else 0
                period_data[upc] = {
                    "dollars": 0,
                    "units": round(avg_units, 2),
                    "dollars_yago": 0,
                    "units_yago": 0,
                    "dollars_yoy_pct": 0.0,
                    "units_yoy_pct": 0.0,
                }

                # Inventory record
                instock_val = float(row.get(instock_col, 0)) if instock_col else 0
                inventory_records.append({
                    "upc": upc,
                    "product_name": str(row.get(desc_col, "")).strip() if desc_col else "",
                    "period": ym,
                    "store_counts": int(row.get(store_ct_col, 0)) if store_ct_col else 0,
                    "instock_pct": round(instock_val * 100, 2) if instock_val <= 1 else round(instock_val, 2),
                    "store_wos_8wk": round(float(row.get(store_wos_col, 0)), 2) if store_wos_col else 0,
                    "oh_units_store": int(row.get(oh_store_col, 0)) if oh_store_col else 0,
                    "oh_units_dc": int(row.get(oh_dc_col, 0)) if oh_dc_col else 0,
                    "oh_units_total": int(row.get(oh_total_col, 0)) if oh_total_col else 0,
                    "overall_status": str(row.get(status_col, "")).strip() if status_col else "",
                    "as_of": file_date.strftime("%Y-%m-%d"),
                })

            if period_data:
                periods[ym] = period_data

        # Compute YoY where we have data 12 months apart
        all_months = sorted(periods.keys())
        for ym in all_months:
            try:
                dt = datetime.strptime(ym, "%Y-%m")
                yago_dt = dt.replace(year=dt.year - 1)
                yago_ym = yago_dt.strftime("%Y-%m")
            except Exception:
                continue

            if yago_ym in periods:
                for upc, metrics in periods[ym].items():
                    yago_units = periods[yago_ym].get(upc, {}).get("units", 0)
                    metrics["units_yago"] = round(yago_units, 2)
                    if yago_units:
                        metrics["units_yoy_pct"] = round(
                            (metrics["units"] - yago_units) / yago_units * 100, 2
                        )

        self.pos_data = {
            "retailer": "TVS",
            "last_updated": datetime.now().strftime("%Y-%m-%d"),
            "time_grain": "monthly",
            "products": list(products_map.values()),
            "periods": periods,
        }

        if inventory_records:
            self.supplemental["inventory"] = {
                "retailer": "TVS",
                "last_updated": datetime.now().strftime("%Y-%m-%d"),
                "records": inventory_records,
            }
