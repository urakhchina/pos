"""
Vitacost adapter.

Sources:
    - Vitacost/History/Vitacost - Vendor Report-OMNI for * - MM-DD-YYYY.xlsx
      Monthly files with sheets: YesterDay-, WTD-, MTD-, YTD-, Current Inventory-, Glossary-
    - Vitacost/History/Vitacost - Vendor Report-OMNIw for * - MM-DD-YYYY.xlsx
      Weekly files (same sheet structure)

The MTD- sheet has merged headers:
    Row 0: title row (merged across all columns)
    Row 1: "IRWIN NATURALS" label (merged)
    Row 2: empty row
    Row 3: actual column headers:
        Category Name, Secondary Category, Third Category, Vendor ID,
        Product, Brand ID, Kroger GTIN, Product Name, UPC,
        Net Sales, Units, Orders, AOV, ASP, Avg Cost, Product Margin%

The Current Inventory- sheet has columns:
    UPC, GTIN, Description, BrandName, Primary Vendor, VITACOST Status,
    STH Status, NC OnHand, LV OnHand, MZ OnHand, NC PO On Order,
    LV PO On Order, MZ PO On Order, Inventory Date
"""

import os
import re
from datetime import datetime

import pandas as pd

from etl.base_adapter import BaseAdapter


class VitacostAdapter(BaseAdapter):
    retailer_key = "vitacost"
    display_name = "Vitacost"

    # ── extract ─────────────────────────────────────────────────────────
    def extract(self):
        history_dir = os.path.join(self.source_dir, "Vitacost", "History")
        if not os.path.isdir(history_dir):
            raise FileNotFoundError(f"Vitacost History directory not found: {history_dir}")

        # Pattern for monthly: Vitacost - Vendor Report-OMNI for <day> - MM-DD-YYYY.xlsx
        # Pattern for weekly:  Vitacost - Vendor Report-OMNIw for <day> - MM-DD-YYYY.xlsx
        date_pattern = re.compile(r"(\d{2})-(\d{2})-(\d{4})\.xlsx$")

        monthly_files = {}  # ym -> (date, filepath)
        weekly_files = []   # [(date, filepath)]

        for fname in os.listdir(history_dir):
            if not fname.endswith(".xlsx"):
                continue
            if "ROAS" in fname:
                continue

            m = date_pattern.search(fname)
            if not m:
                continue

            month_val = int(m.group(1))
            day_val = int(m.group(2))
            year_val = int(m.group(3))
            try:
                file_date = datetime(year_val, month_val, day_val)
            except ValueError:
                print(f"  [Vitacost] WARNING: Could not parse date from {fname}")
                continue

            fpath = os.path.join(history_dir, fname)
            ym = file_date.strftime("%Y-%m")

            if "OMNIw" in fname:
                weekly_files.append((file_date, fpath))
            elif "OMNI" in fname:
                # For monthly: keep the latest file per month
                if ym not in monthly_files or file_date > monthly_files[ym][0]:
                    monthly_files[ym] = (file_date, fpath)

        if not monthly_files and not weekly_files:
            raise FileNotFoundError(
                f"No Vitacost OMNI files found in {history_dir}"
            )

        weekly_files.sort()
        self.raw_data = {
            "monthly_files": monthly_files,
            "weekly_files": weekly_files,
        }
        print(f"  [Vitacost] Found {len(monthly_files)} monthly, "
              f"{len(weekly_files)} weekly files")

    # ── transform ───────────────────────────────────────────────────────
    def transform(self):
        products_map = {}
        periods = {}
        inventory_records = []

        # --- Process monthly files (primary) ---
        for ym, (file_date, fpath) in sorted(self.raw_data["monthly_files"].items()):
            mtd_data = self._read_mtd_sheet(fpath, ym)
            if mtd_data is not None:
                for rec in mtd_data:
                    upc = rec["upc"]
                    if upc not in products_map:
                        products_map[upc] = {
                            "upc": upc,
                            "product_name": rec["product_name"],
                            "brand": rec["brand"],
                            "category": rec["category"],
                            "subcategory": rec["subcategory"],
                        }
                    if ym not in periods:
                        periods[ym] = {}
                    periods[ym][upc] = {
                        "dollars": rec["dollars"],
                        "units": rec["units"],
                        "dollars_yago": 0,
                        "units_yago": 0,
                        "dollars_yoy_pct": 0.0,
                        "units_yoy_pct": 0.0,
                    }

            # Read inventory from latest monthly file
            inv = self._read_inventory_sheet(fpath, ym)
            if inv:
                inventory_records.extend(inv)

        # --- Process weekly files: aggregate into monthly ---
        weekly_by_month = {}   # ym -> [(date, fpath)]
        for file_date, fpath in self.raw_data["weekly_files"]:
            ym = file_date.strftime("%Y-%m")
            if ym not in weekly_by_month:
                weekly_by_month[ym] = []
            weekly_by_month[ym].append((file_date, fpath))

        for ym, files in sorted(weekly_by_month.items()):
            if ym in periods:
                # Monthly file already covers this month — skip weekly
                continue

            month_accum = {}  # upc -> {dollars, units}
            for file_date, fpath in files:
                mtd_data = self._read_mtd_sheet(fpath, ym)
                if mtd_data is None:
                    continue
                for rec in mtd_data:
                    upc = rec["upc"]
                    if upc not in products_map:
                        products_map[upc] = {
                            "upc": upc,
                            "product_name": rec["product_name"],
                            "brand": rec["brand"],
                            "category": rec["category"],
                            "subcategory": rec["subcategory"],
                        }
                    if upc not in month_accum:
                        month_accum[upc] = {"dollars": 0, "units": 0}
                    month_accum[upc]["dollars"] += rec["dollars"]
                    month_accum[upc]["units"] += rec["units"]

            # For weekly MTD sheets: the MTD value in the latest weekly file
            # of the month is the cumulative MTD — use that instead of summing
            latest_file = sorted(files)[-1]
            mtd_data = self._read_mtd_sheet(latest_file[1], ym)
            if mtd_data:
                period_data = {}
                for rec in mtd_data:
                    upc = rec["upc"]
                    period_data[upc] = {
                        "dollars": rec["dollars"],
                        "units": rec["units"],
                        "dollars_yago": 0,
                        "units_yago": 0,
                        "dollars_yoy_pct": 0.0,
                        "units_yoy_pct": 0.0,
                    }
                if period_data:
                    periods[ym] = period_data

            # Read inventory from latest weekly file of the month
            latest_weekly = sorted(files)[-1]
            inv = self._read_inventory_sheet(latest_weekly[1], ym)
            if inv:
                inventory_records.extend(inv)

        # Compute YoY where possible
        all_months = sorted(periods.keys())
        for ym in all_months:
            try:
                dt = datetime.strptime(ym, "%Y-%m")
                yago_ym = dt.replace(year=dt.year - 1).strftime("%Y-%m")
            except Exception:
                continue
            if yago_ym in periods:
                for upc, metrics in periods[ym].items():
                    yago_data = periods[yago_ym].get(upc, {})
                    yago_dollars = yago_data.get("dollars", 0)
                    yago_units = yago_data.get("units", 0)
                    metrics["dollars_yago"] = round(yago_dollars, 2)
                    metrics["units_yago"] = round(yago_units, 2)
                    if yago_dollars:
                        metrics["dollars_yoy_pct"] = round(
                            (metrics["dollars"] - yago_dollars) / yago_dollars * 100, 2
                        )
                    if yago_units:
                        metrics["units_yoy_pct"] = round(
                            (metrics["units"] - yago_units) / yago_units * 100, 2
                        )

        self.pos_data = {
            "retailer": "Vitacost",
            "last_updated": datetime.now().strftime("%Y-%m-%d"),
            "time_grain": "monthly",
            "products": list(products_map.values()),
            "periods": periods,
        }

        if inventory_records:
            self.supplemental["inventory"] = {
                "retailer": "Vitacost",
                "last_updated": datetime.now().strftime("%Y-%m-%d"),
                "records": inventory_records,
            }

    # ── sheet readers ───────────────────────────────────────────────────
    def _read_mtd_sheet(self, fpath, ym):
        """
        Read the MTD- sheet.  Header row is at row index 3 (0-indexed).
        Columns: Category Name, Secondary Category, Third Category, Vendor ID,
                 Product, Brand ID, Kroger GTIN, Product Name, UPC,
                 Net Sales, Units, Orders, AOV, ASP, Avg Cost, Product Margin%
        """
        try:
            df = pd.read_excel(fpath, sheet_name="MTD-", header=None)
        except Exception as e:
            print(f"  [Vitacost] WARNING: No MTD- sheet in {os.path.basename(fpath)}: {e}")
            return None

        # Find header row — look for a row containing "UPC" and "Net Sales"
        header_idx = None
        for i in range(min(10, len(df))):
            row_vals = [str(v).strip() for v in df.iloc[i].values]
            if "UPC" in row_vals and ("Net Sales" in row_vals or "Net Sales " in row_vals):
                header_idx = i
                break

        if header_idx is None:
            # Fallback: assume row 3
            header_idx = 3

        # Set header and slice data
        headers = [str(v).strip() for v in df.iloc[header_idx].values]
        data_df = df.iloc[header_idx + 1:].copy()
        data_df.columns = headers

        # Clean up
        if "UPC" not in data_df.columns:
            print(f"  [Vitacost] WARNING: No UPC column found in {os.path.basename(fpath)}")
            return None

        data_df["upc_clean"] = (
            data_df["UPC"]
            .astype(str)
            .str.strip()
            .str.replace(r"\.0$", "", regex=True)
            .apply(self.normalize_upc)
        )

        # Find Net Sales and Units columns
        net_sales_col = None
        units_col = None
        brand_col = None
        product_name_col = None
        cat_col = None
        subcat_col = None

        for c in data_df.columns:
            cl = str(c).strip().lower()
            if cl == "net sales" or cl == "net sales ":
                net_sales_col = c
            elif cl == "units":
                units_col = c
            elif cl == "brand id":
                brand_col = c
            elif cl == "product name":
                product_name_col = c
            elif cl == "category name":
                cat_col = c
            elif cl == "secondary category":
                subcat_col = c

        records = []
        for _, row in data_df.iterrows():
            upc = row.get("upc_clean", "")
            if not upc or upc == "0000000000000":
                continue

            dollars = pd.to_numeric(row.get(net_sales_col), errors="coerce") if net_sales_col else 0
            units = pd.to_numeric(row.get(units_col), errors="coerce") if units_col else 0

            records.append({
                "upc": upc,
                "product_name": str(row.get(product_name_col, "")).strip()
                    if product_name_col else "",
                "brand": str(row.get(brand_col, "")).strip()
                    if brand_col else "Irwin Naturals",
                "category": str(row.get(cat_col, "")).strip()
                    if cat_col else "",
                "subcategory": str(row.get(subcat_col, "")).strip()
                    if subcat_col else "",
                "dollars": round(float(dollars), 2) if pd.notna(dollars) else 0,
                "units": int(units) if pd.notna(units) else 0,
            })

        print(f"  [Vitacost] MTD {ym}: {len(records)} products from "
              f"{os.path.basename(fpath)}")
        return records if records else None

    def _read_inventory_sheet(self, fpath, ym):
        """
        Read Current Inventory- sheet.
        Columns: UPC, GTIN, Description, BrandName, Primary Vendor,
                 VITACOST Status, STH Status, NC OnHand, LV OnHand, MZ OnHand,
                 NC PO On Order, LV PO On Order, MZ PO On Order, Inventory Date
        """
        try:
            df = pd.read_excel(fpath, sheet_name="Current Inventory-", header=0)
        except Exception as e:
            print(f"  [Vitacost] WARNING: No Current Inventory- sheet in "
                  f"{os.path.basename(fpath)}: {e}")
            return None

        if "UPC" not in df.columns:
            return None

        df["upc_clean"] = (
            df["UPC"]
            .astype(str)
            .str.strip()
            .str.replace(r"\.0$", "", regex=True)
            .apply(self.normalize_upc)
        )

        records = []
        for _, row in df.iterrows():
            upc = row.get("upc_clean", "")
            if not upc or upc == "0000000000000":
                continue

            nc = pd.to_numeric(row.get("NC OnHand"), errors="coerce")
            lv = pd.to_numeric(row.get("LV OnHand"), errors="coerce")
            mz = pd.to_numeric(row.get("MZ OnHand"), errors="coerce")
            nc = int(nc) if pd.notna(nc) else 0
            lv = int(lv) if pd.notna(lv) else 0
            mz = int(mz) if pd.notna(mz) else 0

            records.append({
                "upc": upc,
                "product_name": str(row.get("Description", "")).strip(),
                "brand": str(row.get("BrandName", "")).strip(),
                "vitacost_status": str(row.get("VITACOST Status", "")).strip(),
                "sth_status": str(row.get("STH Status", "")).strip(),
                "on_hand_nc": nc,
                "on_hand_lv": lv,
                "on_hand_mz": mz,
                "on_hand_total": nc + lv + mz,
                "period": ym,
            })

        return records if records else None
