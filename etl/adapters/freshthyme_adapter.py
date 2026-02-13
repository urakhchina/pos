"""
FreshThyme adapter.

Sources:
    - FreshThyme/FreshThyme_*.xlsx — monthly POS reports

Column layout (22 columns total):
    0  Unnamed: 0  — product description (group header, often NaN for sub-rows)
    1  Unnamed: 1  — UPC + short name, e.g. "71036359201 MEGA D3+K2"
    2  Unnamed: 2  — Category
    3  Unnamed: 3  — Subcategory
    4  Unnamed: 4  — Sub-subcategory / department
    5  Unnamed: 5  — Brand
    6  Unnamed: 6  — another grouping (e.g. "Natural Living")
    7  Items Selling TY
    8  Stores Selling TY
    9  ACV
    10 Sales TY                   -> dollars
    11 Sales vs LY %              -> dollars_yoy_pct
    12 Sales Trend vs Category Trend
    13 % of Total Sales ...
    14 Volume TY                  -> units
    15 Volume vs LY %             -> units_yoy_pct
    16 Volume Trend vs Category Trend
    17 % of Total Volume ...
    18 My Sales LY                -> dollars_yago
    19 My Sales TY                -> (duplicate of Sales TY)
    20 My Volume LY               -> units_yago
    21 My Volume TY               -> (duplicate of Volume TY)

Row 0 = Grand Total.  The UPC is embedded in "Unnamed: 1" as "NNNNNNNNNNN NAME".
"""

import os
import re
from datetime import datetime

import pandas as pd

from etl.base_adapter import BaseAdapter

# Month name -> number
MONTH_MAP = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
    "january": 1, "february": 2, "march": 3, "april": 4,
    "june": 6, "july": 7, "august": 8, "september": 9,
    "october": 10, "november": 11, "december": 12,
}


class FreshThymeAdapter(BaseAdapter):
    retailer_key = "freshthyme"
    display_name = "FreshThyme"

    # ── extract ─────────────────────────────────────────────────────────
    def extract(self):
        ft_dir = os.path.join(self.source_dir, "FreshThyme")
        if not os.path.isdir(ft_dir):
            raise FileNotFoundError(f"FreshThyme directory not found: {ft_dir}")

        # Find FreshThyme_*.xlsx files
        pattern = re.compile(
            r"FreshThyme_(\w+)_(\d{4})\.xlsx$", re.IGNORECASE
        )
        file_entries = []
        for fname in os.listdir(ft_dir):
            m = pattern.match(fname)
            if m:
                month_str = m.group(1).lower()
                year_val = int(m.group(2))
                month_num = MONTH_MAP.get(month_str)
                if month_num:
                    ym = f"{year_val:04d}-{month_num:02d}"
                    file_entries.append((ym, os.path.join(ft_dir, fname)))

        if not file_entries:
            raise FileNotFoundError(f"No FreshThyme_*.xlsx files found in {ft_dir}")

        file_entries.sort()
        self.raw_data = {"file_entries": file_entries}
        print(f"  [FreshThyme] Found {len(file_entries)} monthly files")

    # ── transform ───────────────────────────────────────────────────────
    def transform(self):
        products_map = {}
        periods = {}

        for ym, fpath in self.raw_data["file_entries"]:
            try:
                df = pd.read_excel(fpath)
            except Exception as e:
                print(f"  [FreshThyme] WARNING: Could not read {fpath}: {e}")
                continue

            print(f"  [FreshThyme] Processing {os.path.basename(fpath)}: "
                  f"{len(df)} rows -> {ym}")

            # Skip Grand Total row (row 0 where Unnamed: 0 == "Grand Total")
            first_col = df.columns[0]
            df = df[df[first_col] != "Grand Total"].copy()

            # Parse UPC from "Unnamed: 1" — format "NNNNNNNNNNN PRODUCT NAME"
            upc_name_col = "Unnamed: 1"
            if upc_name_col not in df.columns:
                # Fallback: try second column
                upc_name_col = df.columns[1]

            df["upc_raw"] = df[upc_name_col].astype(str).apply(self._extract_upc)
            df["product_short_name"] = df[upc_name_col].astype(str).apply(
                self._extract_name
            )
            df = df[df["upc_raw"] != ""].copy()
            df["upc_clean"] = df["upc_raw"].apply(self.normalize_upc)

            # Map known column names (some have trailing spaces)
            col_map = {}
            for c in df.columns:
                cs = str(c).strip().lower()
                if cs == "sales ty":
                    col_map["dollars"] = c
                elif cs.startswith("sales vs ly"):
                    col_map["dollars_yoy_pct"] = c
                elif cs == "volume ty":
                    col_map["units"] = c
                elif cs.startswith("volume vs ly"):
                    col_map["units_yoy_pct"] = c
                elif cs == "my sales ly":
                    col_map["dollars_yago"] = c
                elif cs == "my volume ly":
                    col_map["units_yago"] = c
                elif cs == "acv":
                    col_map["acv"] = c
                elif cs == "stores selling ty":
                    col_map["store_count"] = c

            # Numeric conversion
            for key in ["dollars", "units", "dollars_yago", "units_yago",
                        "dollars_yoy_pct", "units_yoy_pct", "acv", "store_count"]:
                if key in col_map:
                    df[key] = pd.to_numeric(df[col_map[key]], errors="coerce").fillna(0)
                else:
                    df[key] = 0

            # Category columns
            cat_col = "Unnamed: 2" if "Unnamed: 2" in df.columns else df.columns[2]
            subcat_col = "Unnamed: 3" if "Unnamed: 3" in df.columns else df.columns[3]
            brand_col = "Unnamed: 5" if "Unnamed: 5" in df.columns else df.columns[5]

            period_data = {}
            for _, row in df.iterrows():
                upc = row["upc_clean"]
                if upc == "0000000000000":
                    continue

                # Product info — update with latest data
                brand_val = str(row.get(brand_col, "")).strip()
                cat_val = str(row.get(cat_col, "")).strip()
                subcat_val = str(row.get(subcat_col, "")).strip()
                desc = row.get("product_short_name", "")

                # Build full description from col 0 if available
                full_desc = str(row.get(df.columns[0], "")).strip()
                if full_desc == "nan" or not full_desc:
                    full_desc = desc

                acv_val = round(float(row.get("acv", 0)), 4)
                store_count_val = int(row.get("store_count", 0))

                if upc not in products_map:
                    products_map[upc] = {
                        "upc": upc,
                        "product_name": full_desc,
                        "brand": brand_val if brand_val != "nan" else "",
                        "category": cat_val if cat_val != "nan" else "",
                        "subcategory": subcat_val if subcat_val != "nan" else "",
                    }

                # Add ACV and store count if available (for distribution_acv feature)
                if acv_val:
                    products_map[upc]["acv"] = acv_val
                if store_count_val:
                    products_map[upc]["store_count"] = store_count_val

                dollars = round(float(row.get("dollars", 0)), 2)
                units = round(float(row.get("units", 0)), 2)
                dollars_yago = round(float(row.get("dollars_yago", 0)), 2)
                units_yago = round(float(row.get("units_yago", 0)), 2)

                # Compute YoY pct
                dollars_yoy_pct = round(float(row.get("dollars_yoy_pct", 0)) * 100, 2)
                units_yoy_pct = round(float(row.get("units_yoy_pct", 0)) * 100, 2)

                period_data[upc] = {
                    "dollars": dollars,
                    "units": units,
                    "dollars_yago": dollars_yago,
                    "units_yago": units_yago,
                    "dollars_yoy_pct": dollars_yoy_pct,
                    "units_yoy_pct": units_yoy_pct,
                }

            if period_data:
                periods[ym] = period_data

        self.pos_data = {
            "retailer": "FreshThyme",
            "last_updated": datetime.now().strftime("%Y-%m-%d"),
            "time_grain": "monthly",
            "products": list(products_map.values()),
            "periods": periods,
        }

    # ── helpers ─────────────────────────────────────────────────────────
    @staticmethod
    def _extract_upc(val):
        """Extract numeric UPC from 'NNNNNNNNNNN PRODUCT NAME' string."""
        val = str(val).strip()
        match = re.match(r"^(\d{5,14})\s", val)
        if match:
            return match.group(1)
        return ""

    @staticmethod
    def _extract_name(val):
        """Extract product name from 'NNNNNNNNNNN PRODUCT NAME' string."""
        val = str(val).strip()
        match = re.match(r"^\d{5,14}\s+(.*)", val)
        if match:
            return match.group(1).strip()
        return val
