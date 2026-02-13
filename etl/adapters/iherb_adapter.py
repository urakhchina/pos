"""
iHerb adapter.

Sources:
    - iHerb/2024/*.csv and iHerb/2025/*.csv
      Named like 202501_IRW.csv with rolling 14-month unit columns.
      CSV columns: Part Number, UPCCode, Vendor_Code, Vendor Name,
      Brand Code, Brand Name, Product Description, Status Name, LTOOS,
      Days on LTOOS, Quantity Available, then monthly columns (YYYY-MM).

Notes:
    - iHerb data is units-only (no dollar amounts).
    - LTOOS (Long-Term Out of Stock) info is extracted to ltoos_history.json.
    - Inventory (Quantity Available, Status Name) is extracted to inventory.json.
"""

import json
import os
import re
from datetime import datetime

import pandas as pd

from etl.base_adapter import BaseAdapter


class IHerbAdapter(BaseAdapter):
    retailer_key = "iherb"
    display_name = "iHerb"

    def _load_category_mapping(self):
        """Load the IN brand category mapping from etl/category_mapping.json.

        The mapping is built from the Irwin Naturals Promotional Calendar
        and maps UPCs and iHerb SKUs (Part Numbers) to official IN categories.
        """
        mapping_path = os.path.join(
            os.path.dirname(os.path.dirname(__file__)), "category_mapping.json"
        )
        if os.path.exists(mapping_path):
            with open(mapping_path, "r") as f:
                data = json.load(f)
            print(f"  [iHerb] Loaded category mapping: {len(data.get('by_upc', {}))} UPCs, {len(data.get('by_sku', {}))} SKUs")
            return data
        print("  [iHerb] WARNING: category_mapping.json not found, categories will be empty")
        return {"by_upc": {}, "by_sku": {}}

    # ── extract ─────────────────────────────────────────────────────────
    def extract(self):
        iherb_dir = os.path.join(self.source_dir, "iHerb")
        csv_files = []

        for year_dir in ["2024", "2025"]:
            dirpath = os.path.join(iherb_dir, year_dir)
            if not os.path.isdir(dirpath):
                continue
            for fname in os.listdir(dirpath):
                if fname.endswith("_IRW.csv") and not fname.endswith("_edited.csv"):
                    csv_files.append(os.path.join(dirpath, fname))

        if not csv_files:
            raise FileNotFoundError(f"No iHerb CSV files found under {iherb_dir}")

        # Sort by filename so newest comes last
        csv_files.sort()

        self.raw_data = {"csv_files": csv_files, "frames": []}
        for fpath in csv_files:
            try:
                df = pd.read_csv(fpath)
                self.raw_data["frames"].append((fpath, df))
                print(f"  [iHerb] Loaded {os.path.basename(fpath)}: {len(df)} rows")
            except Exception as e:
                print(f"  [iHerb] WARNING: Could not read {fpath}: {e}")

    # ── transform ───────────────────────────────────────────────────────
    def transform(self):
        cat_map = self._load_category_mapping()
        upc_cats = cat_map.get("by_upc", {})
        sku_cats = cat_map.get("by_sku", {})

        products_map = {}      # upc -> product dict
        units_timeline = {}    # (upc, YYYY-MM) -> units
        ltoos_records = []     # for ltoos_history.json
        inventory_records = [] # for inventory.json

        # Metadata columns (non-month columns)
        meta_cols = {
            "Part Number", "UPCCode", "Vendor_Code", "Vendor Name",
            "Brand Code", "Brand Name", "Product Description",
            "Status Name", "LTOOS", "Days on LTOOS", "Quantity Available",
        }

        for fpath, df in self.raw_data["frames"]:
            df = df.copy()

            # Parse the file date from filename: e.g. 202501_IRW.csv -> 2025-01
            basename = os.path.basename(fpath)
            file_match = re.match(r"(\d{4})(\d{2})_IRW\.csv", basename)
            file_year_month = None
            if file_match:
                file_year_month = f"{file_match.group(1)}-{file_match.group(2)}"

            # Normalize UPC
            df["upc_clean"] = (
                df["UPCCode"]
                .astype(str)
                .str.strip()
                .str.replace(r"\.0$", "", regex=True)
                .apply(self.normalize_upc)
            )

            # Identify monthly columns (format YYYY-MM)
            month_cols = [
                c for c in df.columns
                if re.match(r"^\d{4}-\d{2}$", str(c).strip())
            ]

            # Build products from this file
            for _, row in df.iterrows():
                upc = row["upc_clean"]
                if upc == "0000000000000":
                    continue

                if upc not in products_map:
                    # Look up category: try UPC first, then iHerb Part Number (SKU)
                    part_num = str(row.get("Part Number", "")).strip()
                    category = upc_cats.get(upc) or sku_cats.get(part_num, "")
                    products_map[upc] = {
                        "upc": upc,
                        "product_name": str(row.get("Product Description", "")).strip(),
                        "brand": str(row.get("Brand Name", "")).strip(),
                        "category": category,
                        "subcategory": "",
                    }

                # Extract monthly units
                for mc in month_cols:
                    val = pd.to_numeric(row.get(mc), errors="coerce")
                    if pd.notna(val):
                        key = (upc, str(mc).strip())
                        # Later files overwrite earlier ones (more accurate)
                        units_timeline[key] = int(val)

            # LTOOS and inventory from the LATEST file only
            if fpath == self.raw_data["csv_files"][-1]:
                for _, row in df.iterrows():
                    upc = row["upc_clean"]
                    if upc == "0000000000000":
                        continue

                    # LTOOS
                    ltoos_flag = str(row.get("LTOOS", "")).strip()
                    days_ltoos = pd.to_numeric(row.get("Days on LTOOS"), errors="coerce")
                    if ltoos_flag.lower() == "yes":
                        ltoos_records.append({
                            "upc": upc,
                            "product_name": str(row.get("Product Description", "")).strip(),
                            "ltoos": True,
                            "days_on_ltoos": int(days_ltoos) if pd.notna(days_ltoos) else 0,
                            "as_of": file_year_month or datetime.now().strftime("%Y-%m"),
                        })

                    # Inventory
                    qty = pd.to_numeric(row.get("Quantity Available"), errors="coerce")
                    status = str(row.get("Status Name", "")).strip()
                    inventory_records.append({
                        "upc": upc,
                        "product_name": str(row.get("Product Description", "")).strip(),
                        "quantity_available": int(qty) if pd.notna(qty) else 0,
                        "status": status if status != "nan" else "",
                        "ltoos": ltoos_flag.lower() == "yes",
                        "days_on_ltoos": int(days_ltoos) if pd.notna(days_ltoos) else 0,
                        "as_of": file_year_month or datetime.now().strftime("%Y-%m"),
                    })

        # --- Build periods ---
        periods = {}
        for (upc, ym), units in units_timeline.items():
            if ym not in periods:
                periods[ym] = {}
            periods[ym][upc] = {
                "dollars": 0,          # iHerb data is units-only
                "units": units,
                "dollars_yago": 0,
                "units_yago": 0,
                "dollars_yoy_pct": 0.0,
                "units_yoy_pct": 0.0,
            }

        # Compute YoY for units where possible (month - 12 months)
        all_months = sorted(periods.keys())
        for ym in all_months:
            # Derive YAGO month
            try:
                dt = datetime.strptime(ym, "%Y-%m")
                yago_dt = dt.replace(year=dt.year - 1)
                yago_ym = yago_dt.strftime("%Y-%m")
            except Exception:
                continue

            if yago_ym in periods:
                for upc, metrics in periods[ym].items():
                    yago_units = periods[yago_ym].get(upc, {}).get("units", 0)
                    metrics["units_yago"] = yago_units
                    if yago_units:
                        metrics["units_yoy_pct"] = round(
                            (metrics["units"] - yago_units) / yago_units * 100, 2
                        )

        self.pos_data = {
            "retailer": "iHerb",
            "last_updated": datetime.now().strftime("%Y-%m-%d"),
            "time_grain": "monthly",
            "products": list(products_map.values()),
            "periods": periods,
        }

        # Supplemental files
        if ltoos_records:
            self.supplemental["ltoos_history"] = {
                "retailer": "iHerb",
                "last_updated": datetime.now().strftime("%Y-%m-%d"),
                "records": ltoos_records,
            }

        if inventory_records:
            self.supplemental["inventory"] = {
                "retailer": "iHerb",
                "last_updated": datetime.now().strftime("%Y-%m-%d"),
                "records": inventory_records,
            }
