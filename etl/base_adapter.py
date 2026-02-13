"""
Base adapter — abstract interface that every retailer adapter implements.
"""
import json
import os
from abc import ABC, abstractmethod
from datetime import datetime


class BaseAdapter(ABC):
    """Every retailer adapter must implement extract(), transform(), and load()."""

    retailer_key = ""       # e.g. "ngvc"
    display_name = ""       # e.g. "NGVC"

    def __init__(self, source_dir, output_dir):
        self.source_dir = source_dir
        self.output_dir = os.path.join(output_dir, self.retailer_key)
        os.makedirs(self.output_dir, exist_ok=True)
        self.raw_data = None
        self.pos_data = None      # universal schema dict
        self.supplemental = {}    # e.g. {"inventory": {...}, "ecommerce": {...}}

    # ── public API ────────────────────────────────────────────────────
    def run(self):
        """Full ETL pipeline."""
        print(f"[{self.display_name}] Extracting from {self.source_dir} ...")
        self.extract()
        print(f"[{self.display_name}] Transforming ...")
        self.transform()
        print(f"[{self.display_name}] Loading to {self.output_dir} ...")
        manifest_entry = self.load()
        print(f"[{self.display_name}] Done — {len(self.pos_data.get('products', []))} products, "
              f"{len(self.pos_data.get('periods', {}))} periods")
        return manifest_entry

    @abstractmethod
    def extract(self):
        """Read raw files into self.raw_data."""

    @abstractmethod
    def transform(self):
        """Normalize self.raw_data → self.pos_data (universal schema)."""

    def load(self):
        """Write JSON files and return a manifest entry dict."""
        # Write pos_data.json
        self._write_json("pos_data.json", self.pos_data)
        data_files = ["pos_data.json"]

        # Write supplemental files
        for name, payload in self.supplemental.items():
            fname = f"{name}.json"
            self._write_json(fname, payload)
            data_files.append(fname)

        # Determine features from the data
        features = self._detect_features()

        # Determine date range
        periods = sorted(self.pos_data.get("periods", {}).keys())
        date_range = {
            "start": periods[0] if periods else None,
            "end": periods[-1] if periods else None,
        }

        entry = {
            "display_name": self.display_name,
            "data_files": data_files,
            "date_range": date_range,
            "features": features,
            "product_count": len(self.pos_data.get("products", [])),
            "time_grain": self.pos_data.get("time_grain", "monthly"),
        }

        if self.pos_data.get("weekly_periods"):
            entry["has_weekly"] = True

        return entry

    # ── helpers ───────────────────────────────────────────────────────
    @staticmethod
    def normalize_upc(upc):
        """Zero-pad UPC to 13 digits."""
        s = str(upc).strip().replace(" ", "").replace("-", "")
        # Remove leading zeros beyond 13 digits, then pad
        s = s.lstrip("0") or "0"
        return s.zfill(13)

    @staticmethod
    def to_yyyy_mm(year, month):
        """Return 'YYYY-MM' string."""
        return f"{int(year):04d}-{int(month):02d}"

    def _write_json(self, filename, data):
        path = os.path.join(self.output_dir, filename)
        with open(path, "w") as f:
            json.dump(data, f, indent=2, default=str)

    def _detect_features(self):
        """Auto-detect which dashboard features this retailer supports."""
        features = []
        periods = self.pos_data.get("periods", {})

        # Check core data fields
        has_dollars = False
        has_units = False
        has_yago = False
        has_category = False

        for period_data in periods.values():
            for upc_data in period_data.values():
                if upc_data.get("dollars"):
                    has_dollars = True
                if upc_data.get("units"):
                    has_units = True
                if upc_data.get("dollars_yago") is not None:
                    has_yago = True
                if has_dollars and has_units and has_yago:
                    break
            if has_dollars and has_units and has_yago:
                break

        # Check products for category
        for prod in self.pos_data.get("products", []):
            if prod.get("category"):
                has_category = True
                break

        # Also check for units_yago (iHerb, TVS have units-only YoY)
        has_units_yago = False
        for period_data in periods.values():
            for upc_data in period_data.values():
                if upc_data.get("units_yago"):
                    has_units_yago = True
                    break
            if has_units_yago:
                break

        # Map to features — enable when dollars OR units available
        if has_dollars or has_units:
            features.extend(["executive_summary", "sales_overview", "product_performance"])
        if (has_dollars or has_units) and len(periods) >= 2:
            features.append("top_bottom_movers")
        if has_yago or has_units_yago:
            features.append("yoy_performance")
        if has_category:
            features.append("category_analytics")

        # Supplemental file features
        if "inventory" in self.supplemental:
            features.append("inventory_health")
        if "ltoos_history" in self.supplemental:
            features.append("ltoos_risk")
        if "forecast_data" in self.supplemental:
            features.append("forecast_vs_actual")
        if "ecommerce" in self.supplemental:
            features.append("ecommerce_metrics")

        # Check for special fields
        for prod in self.pos_data.get("products", []):
            if prod.get("set_status"):
                if "discontinuation_risk" not in features:
                    features.append("discontinuation_risk")
                break
            if prod.get("acv") is not None or prod.get("store_count") is not None:
                if "distribution_acv" not in features:
                    features.append("distribution_acv")
                break

        return features
