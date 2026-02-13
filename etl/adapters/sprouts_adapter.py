"""
Sprouts Farmers Market adapter.

Source:
    - Sprouts/45934e10-2794-4865-a52a-d2c5b10f6374.xlsx
      SPINS WEEK data with columns: TIME FRAME, TIME PERIOD, GEOGRAPHY,
      CATEGORY, SUBCATEGORY, BRAND, UPC, DESCRIPTION, Dollars, etc.
"""

import os
import re
from datetime import datetime

import pandas as pd

from etl.base_adapter import BaseAdapter


class SproutsAdapter(BaseAdapter):
    retailer_key = "sprouts"
    display_name = "Sprouts"

    # ── extract ─────────────────────────────────────────────────────────
    def extract(self):
        sprouts_dir = os.path.join(self.source_dir, "Sprouts")
        xlsx_path = os.path.join(sprouts_dir, "45934e10-2794-4865-a52a-d2c5b10f6374.xlsx")

        if not os.path.isfile(xlsx_path):
            raise FileNotFoundError(f"Sprouts data file not found: {xlsx_path}")

        try:
            self.raw_data = pd.read_excel(xlsx_path)
            print(f"  [Sprouts] Loaded {len(self.raw_data)} rows")
        except Exception as e:
            raise RuntimeError(f"Failed to read Sprouts file: {e}")

    # ── transform ───────────────────────────────────────────────────────
    def transform(self):
        df = self.raw_data.copy()

        # --- Parse month from TIME FRAME ---
        # Format: "WEEK End MM/DD/YYYY"
        df["parsed_date"] = df["TIME FRAME"].astype(str).apply(self._parse_time_frame)
        df = df.dropna(subset=["parsed_date"])
        df["year_month"] = df["parsed_date"].dt.strftime("%Y-%m")

        # --- Clean UPC ---
        df["upc_clean"] = df["UPC"].astype(str).apply(self.normalize_upc)

        # --- Numeric columns ---
        for col in ["Dollars", "Dollars, Yago", "Units", "Units, Yago"]:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

        # --- Aggregate by (UPC, YYYY-MM) ---
        grouped = df.groupby(["upc_clean", "year_month"]).agg({
            "Dollars": "sum",
            "Dollars, Yago": "sum",
            "Units": "sum",
            "Units, Yago": "sum",
        }).reset_index()

        # --- Build products ---
        product_info = (
            df.drop_duplicates(subset=["upc_clean"])
            .set_index("upc_clean")[["DESCRIPTION", "BRAND", "CATEGORY", "SUBCATEGORY"]]
        )

        products = {}
        for upc, row in product_info.iterrows():
            products[upc] = {
                "upc": upc,
                "product_name": str(row.get("DESCRIPTION", "")).strip(),
                "brand": str(row.get("BRAND", "")).strip(),
                "category": str(row.get("CATEGORY", "")).strip(),
                "subcategory": str(row.get("SUBCATEGORY", "")).strip(),
            }

        # --- Build periods ---
        periods = {}
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

            periods[ym][upc] = {
                "dollars": dollars,
                "units": units,
                "dollars_yago": dollars_yago,
                "units_yago": units_yago,
                "dollars_yoy_pct": dollars_yoy_pct,
                "units_yoy_pct": units_yoy_pct,
            }

        # --- Also aggregate by (UPC, week_end_date) for weekly view ---
        df["week_end_date"] = df["parsed_date"].dt.strftime("%Y-%m-%d")
        weekly_grouped = df.groupby(["upc_clean", "week_end_date"]).agg({
            "Dollars": "sum",
            "Dollars, Yago": "sum",
            "Units": "sum",
            "Units, Yago": "sum",
        }).reset_index()

        weekly_periods = {}
        for _, row in weekly_grouped.iterrows():
            upc = row["upc_clean"]
            wk = row["week_end_date"]
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

            if wk not in weekly_periods:
                weekly_periods[wk] = {}

            weekly_periods[wk][upc] = {
                "dollars": dollars,
                "units": units,
                "dollars_yago": dollars_yago,
                "units_yago": units_yago,
                "dollars_yoy_pct": dollars_yoy_pct,
                "units_yoy_pct": units_yoy_pct,
            }

        self.pos_data = {
            "retailer": "Sprouts",
            "last_updated": datetime.now().strftime("%Y-%m-%d"),
            "time_grain": "monthly",
            "products": list(products.values()),
            "periods": periods,
            "weekly_periods": weekly_periods,
        }

    # ── helpers ─────────────────────────────────────────────────────────
    @staticmethod
    def _parse_time_frame(tf):
        """Parse 'WEEK End MM/DD/YYYY' into a datetime, or return None."""
        match = re.search(r"(\d{2}/\d{2}/\d{4})", str(tf))
        if match:
            try:
                return pd.to_datetime(match.group(1), format="%m/%d/%Y")
            except Exception:
                return None
        return None
