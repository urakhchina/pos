#!/usr/bin/env python3
"""
Irwin Naturals POS Dashboard — ETL entry point.

Usage:
    python -m etl.run_etl --retailer all
    python -m etl.run_etl --retailer ngvc
    python -m etl.run_etl --retailer ngvc sprouts iherb
"""

import argparse
import json
import os
import sys
import traceback
from datetime import datetime

# Ensure the project root is on sys.path so `etl.*` imports work when run
# directly (python etl/run_etl.py) or as a module (python -m etl.run_etl).
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from etl.adapters.ngvc_adapter import NGVCAdapter
from etl.adapters.sprouts_adapter import SproutsAdapter
from etl.adapters.iherb_adapter import IHerbAdapter
from etl.adapters.tvs_adapter import TVSAdapter
from etl.adapters.freshthyme_adapter import FreshThymeAdapter
from etl.adapters.vitacost_adapter import VitacostAdapter

# Registry: key -> adapter class
ADAPTER_REGISTRY = {
    "ngvc": NGVCAdapter,
    "sprouts": SproutsAdapter,
    "iherb": IHerbAdapter,
    "tvs": TVSAdapter,
    "freshthyme": FreshThymeAdapter,
    "vitacost": VitacostAdapter,
}

# Default paths
DEFAULT_SOURCE_DIR = os.path.dirname(PROJECT_ROOT)  # /Users/natasha/Downloads/SharePoint_POS/
DEFAULT_OUTPUT_DIR = os.path.join(PROJECT_ROOT, "public", "data")


def run_adapter(adapter_key, source_dir, output_dir):
    """Run a single adapter and return its manifest entry (or None on failure)."""
    cls = ADAPTER_REGISTRY.get(adapter_key)
    if cls is None:
        print(f"ERROR: Unknown retailer '{adapter_key}'. "
              f"Available: {', '.join(ADAPTER_REGISTRY.keys())}")
        return None

    adapter = cls(source_dir=source_dir, output_dir=output_dir)
    try:
        manifest_entry = adapter.run()
        return manifest_entry
    except FileNotFoundError as e:
        print(f"ERROR [{adapter_key}]: {e}")
        return None
    except Exception as e:
        print(f"ERROR [{adapter_key}]: {e}")
        traceback.print_exc()
        return None


def write_manifest(manifest, output_dir):
    """Write data_manifest.json to the output directory."""
    manifest_path = os.path.join(output_dir, "data_manifest.json")
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2, default=str)
    print(f"\nManifest written to {manifest_path}")
    return manifest_path


def main():
    parser = argparse.ArgumentParser(
        description="Irwin Naturals POS Dashboard ETL"
    )
    parser.add_argument(
        "--retailer",
        nargs="+",
        default=["all"],
        help='Retailer key(s) to process, or "all". '
             f'Available: {", ".join(ADAPTER_REGISTRY.keys())}',
    )
    parser.add_argument(
        "--source-dir",
        default=DEFAULT_SOURCE_DIR,
        help=f"Root directory containing retailer folders (default: {DEFAULT_SOURCE_DIR})",
    )
    parser.add_argument(
        "--output-dir",
        default=DEFAULT_OUTPUT_DIR,
        help=f"Output directory for JSON files (default: {DEFAULT_OUTPUT_DIR})",
    )

    args = parser.parse_args()

    # Resolve retailer list
    retailer_keys = (
        list(ADAPTER_REGISTRY.keys())
        if "all" in args.retailer
        else args.retailer
    )

    source_dir = os.path.abspath(args.source_dir)
    output_dir = os.path.abspath(args.output_dir)
    os.makedirs(output_dir, exist_ok=True)

    print("=" * 60)
    print("  Irwin Naturals POS Dashboard — ETL Pipeline")
    print(f"  Source: {source_dir}")
    print(f"  Output: {output_dir}")
    print(f"  Retailers: {', '.join(retailer_keys)}")
    print("=" * 60)

    # Load existing manifest if present (for incremental runs)
    manifest_path = os.path.join(output_dir, "data_manifest.json")
    if os.path.isfile(manifest_path):
        with open(manifest_path, "r") as f:
            manifest = json.load(f)
    else:
        manifest = {
            "generated_at": None,
            "retailers": {},
        }

    # Run each adapter
    success_count = 0
    fail_count = 0
    for key in retailer_keys:
        print(f"\n{'─' * 50}")
        entry = run_adapter(key, source_dir, output_dir)
        if entry is not None:
            manifest["retailers"][key] = entry
            success_count += 1
        else:
            fail_count += 1

    manifest["generated_at"] = datetime.now().strftime("%Y-%m-%dT%H:%M:%S")

    # Write manifest
    write_manifest(manifest, output_dir)

    print(f"\n{'=' * 60}")
    print(f"  ETL Complete: {success_count} succeeded, {fail_count} failed")
    print("=" * 60)

    return 0 if fail_count == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
