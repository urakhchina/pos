"""
NGVC (Natural Grocers by Vitamin Cottage) adapter.

Sources:
    - NGVC/Irwin_Naturals_NGVC.xlsx          SPINS QUAD data
    - NGVC/P12 - Irwin_Naturals_Pull.xlsx    SPINS WEEK data
    - NGVC/Irwin Naturals Units JAN 2026.xlsx  units + set_status
"""

import os
import re
from datetime import datetime

import pandas as pd

from etl.base_adapter import BaseAdapter


class NGVCAdapter(BaseAdapter):
    retailer_key = "ngvc"
    display_name = "NGVC"

    # ── extract ─────────────────────────────────────────────────────────
    def extract(self):
        ngvc_dir = os.path.join(self.source_dir, "NGVC")
        self.raw_data = {}

        # QUAD file
        quad_path = os.path.join(ngvc_dir, "Irwin_Naturals_NGVC.xlsx")
        if os.path.isfile(quad_path):
            try:
                self.raw_data["quad"] = pd.read_excel(quad_path)
                print(f"  [NGVC] Loaded QUAD file: {len(self.raw_data['quad'])} rows")
            except Exception as e:
                print(f"  [NGVC] WARNING: Could not read QUAD file: {e}")

        # WEEK file
        week_path = os.path.join(ngvc_dir, "P12 - Irwin_Naturals_Pull.xlsx")
        if os.path.isfile(week_path):
            try:
                self.raw_data["week"] = pd.read_excel(week_path)
                print(f"  [NGVC] Loaded WEEK file: {len(self.raw_data['week'])} rows")
            except Exception as e:
                print(f"  [NGVC] WARNING: Could not read WEEK file: {e}")

        # Units / set_status file — find any matching file
        units_files = [
            f for f in os.listdir(ngvc_dir)
            if f.startswith("Irwin Naturals Units") and f.endswith(".xlsx")
        ] if os.path.isdir(ngvc_dir) else []
        if units_files:
            units_path = os.path.join(ngvc_dir, sorted(units_files)[-1])  # latest
            try:
                self.raw_data["units"] = pd.read_excel(units_path)
                print(f"  [NGVC] Loaded units file: {units_path}")
            except Exception as e:
                print(f"  [NGVC] WARNING: Could not read units file: {e}")

        if not self.raw_data.get("quad") is not None and not self.raw_data.get("week") is not None:
            raise FileNotFoundError(
                f"No NGVC data files found in {ngvc_dir}. "
                "Need at least Irwin_Naturals_NGVC.xlsx or P12 - Irwin_Naturals_Pull.xlsx"
            )

    # ── transform ───────────────────────────────────────────────────────
    def transform(self):
        products_map = {}   # upc -> product dict
        periods = {}        # YYYY-MM -> {upc -> metrics}

        # --- Process QUAD data (primary) ---
        if "quad" in self.raw_data and self.raw_data["quad"] is not None:
            self._process_spins_data(self.raw_data["quad"], products_map, periods)

        # --- Process WEEK data (fills gaps / adds granularity) ---
        if "week" in self.raw_data and self.raw_data["week"] is not None:
            self._process_spins_data(self.raw_data["week"], products_map, periods)

        # --- Merge set_status + units data from units file ---
        if "units" in self.raw_data and self.raw_data["units"] is not None:
            self._merge_set_status(products_map, periods)

        # --- Build universal schema ---
        self.pos_data = {
            "retailer": "NGVC",
            "last_updated": datetime.now().strftime("%Y-%m-%d"),
            "time_grain": "monthly",
            "products": list(products_map.values()),
            "periods": periods,
        }

    def _process_spins_data(self, df, products_map, periods):
        """Process a SPINS dataframe (QUAD or WEEK) into products_map and periods."""
        df = df.copy()

        # Clean UPC
        df["upc_clean"] = df["UPC"].astype(str).apply(self.normalize_upc)

        # Parse month from Time Period End Date
        df["Time Period End Date"] = pd.to_datetime(
            df["Time Period End Date"], errors="coerce"
        )
        df = df.dropna(subset=["Time Period End Date"])
        df["year_month"] = df["Time Period End Date"].dt.strftime("%Y-%m")

        # Numeric columns
        for col in ["Dollars", "Dollars, Yago", "Units", "Units, Yago",
                     "Dollars % Chg, Yago", "Units % Chg, Yago"]:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

        # Aggregate by (upc_clean, year_month): sum dollars/units
        grouped = df.groupby(["upc_clean", "year_month"]).agg({
            "Dollars": "sum",
            "Dollars, Yago": "sum",
            "Units": "sum",
            "Units, Yago": "sum",
        }).reset_index()

        # Build products from the raw data (take first occurrence per UPC)
        product_info = (
            df.drop_duplicates(subset=["upc_clean"])
            .set_index("upc_clean")[["Description", "Brand", "Category", "Subcategory"]]
        )

        for _, row in product_info.iterrows():
            upc = row.name
            if upc not in products_map:
                products_map[upc] = {
                    "upc": upc,
                    "product_name": str(row.get("Description", "")).strip(),
                    "brand": str(row.get("Brand", "")).strip(),
                    "category": str(row.get("Category", "")).strip(),
                    "subcategory": str(row.get("Subcategory", "")).strip(),
                }

        # Build periods
        for _, row in grouped.iterrows():
            upc = row["upc_clean"]
            ym = row["year_month"]
            dollars = round(float(row["Dollars"]), 2)
            units = round(float(row["Units"]), 2)
            dollars_yago = round(float(row["Dollars, Yago"]), 2)
            units_yago = round(float(row["Units, Yago"]), 2)

            dollars_yoy_pct = (
                round((dollars - dollars_yago) / dollars_yago * 100, 2)
                if dollars_yago else 0.0
            )
            units_yoy_pct = (
                round((units - units_yago) / units_yago * 100, 2)
                if units_yago else 0.0
            )

            if ym not in periods:
                periods[ym] = {}

            if upc in periods[ym]:
                # Accumulate if already present (e.g. QUAD + WEEK overlap)
                existing = periods[ym][upc]
                existing["dollars"] = round(existing["dollars"] + dollars, 2)
                existing["units"] = round(existing["units"] + units, 2)
                existing["dollars_yago"] = round(existing["dollars_yago"] + dollars_yago, 2)
                existing["units_yago"] = round(existing["units_yago"] + units_yago, 2)
            else:
                periods[ym][upc] = {
                    "dollars": dollars,
                    "units": units,
                    "dollars_yago": dollars_yago,
                    "units_yago": units_yago,
                    "dollars_yoy_pct": dollars_yoy_pct,
                    "units_yoy_pct": units_yoy_pct,
                }

    def _merge_set_status(self, products_map, periods):
        """Merge set_status and units data from the units file into products/periods."""
        df = self.raw_data["units"].copy()

        # The UPC column has leading/trailing spaces and is numeric
        upc_col = [c for c in df.columns if "UPC" in c.upper()][0]
        df["upc_clean"] = (
            df[upc_col]
            .astype(str)
            .str.strip()
            .str.replace(r"\.0$", "", regex=True)
            .apply(self.normalize_upc)
        )

        # Drop NaN UPCs
        df = df.dropna(subset=[upc_col])
        df = df[df["upc_clean"] != "0000000000000"]

        # Detect units column and parse period from its name
        # e.g. "Units sold in January 2026" → "2026-01"
        units_col = None
        units_period = None
        month_names = {
            "january": "01", "february": "02", "march": "03", "april": "04",
            "may": "05", "june": "06", "july": "07", "august": "08",
            "september": "09", "october": "10", "november": "11", "december": "12",
        }
        for col in df.columns:
            col_lower = str(col).lower().strip()
            if "units" in col_lower and ("sold" in col_lower or "jan" in col_lower or "feb" in col_lower):
                match = re.search(r"(" + "|".join(month_names.keys()) + r")\s+(\d{4})", col_lower)
                if match:
                    units_col = col
                    units_period = f"{match.group(2)}-{month_names[match.group(1)]}"
                    print(f"  [NGVC] Found units column '{col}' → period {units_period}")
                    break

        for _, row in df.iterrows():
            upc = row["upc_clean"]
            set_status = str(row.get("Set Status", "")).strip()
            if not set_status or set_status == "nan":
                set_status = None

            if upc in products_map:
                if set_status:
                    products_map[upc]["set_status"] = set_status
            else:
                # Product exists in units file but not in SPINS data — add it
                desc = str(row.get("Description", "")).strip()
                brand = str(row.get("Brand Name", "")).strip()
                products_map[upc] = {
                    "upc": upc,
                    "product_name": desc if desc != "nan" else "",
                    "brand": brand if brand != "nan" else "",
                    "category": "",
                    "subcategory": "",
                }
                if set_status:
                    products_map[upc]["set_status"] = set_status

            # Add units data as a period if we detected a units column
            if units_col and units_period:
                units_val = pd.to_numeric(row.get(units_col, 0), errors="coerce")
                if pd.isna(units_val):
                    units_val = 0
                units_val = round(float(units_val), 2)
                if units_val > 0:
                    if units_period not in periods:
                        periods[units_period] = {}
                    periods[units_period][upc] = {
                        "dollars": 0,
                        "units": units_val,
                        "dollars_yago": 0,
                        "units_yago": 0,
                        "dollars_yoy_pct": 0,
                        "units_yoy_pct": 0,
                    }
