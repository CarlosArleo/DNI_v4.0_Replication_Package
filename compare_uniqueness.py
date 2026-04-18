#!/usr/bin/env python3
"""
DNI v4.0 — Uniqueness Comparison
---------------------------------
Compares judge-rederived Uniqueness (rederived_uniqueness.csv) against the
frozen Master_Forensic_1000 scores, and emits tolerance_comparison.md.

USAGE:
    python3 compare_uniqueness.py \
        --frozen    master_forensic_1000.csv \
        --rederived outputs/rederived_uniqueness.csv \
        --output    outputs/tolerance_comparison.md
"""

import argparse
import re
from pathlib import Path

import pandas as pd


def clean_doi(s):
    if pd.isna(s):
        return None
    x = str(s).strip()
    x = re.sub(r'^P\d+\s*', '', x)
    x = re.sub(r'^(?:https?://)?(?:dx\.)?doi\.org/', '', x, flags=re.IGNORECASE)
    x = x.strip().lower()
    return x if x.startswith('10.') else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--frozen', required=True)
    ap.add_argument('--rederived', required=True)
    ap.add_argument('--output', required=True)
    args = ap.parse_args()

    frozen = pd.read_csv(args.frozen, dtype=str)
    frozen['doi'] = frozen['DOI'].apply(clean_doi)
    frozen['U_frozen'] = pd.to_numeric(frozen['Uniqueness'], errors='coerce')
    frozen = frozen.dropna(subset=['doi', 'U_frozen'])[['doi', 'U_frozen']]

    rerun = pd.read_csv(args.rederived, dtype=str)
    rerun['doi'] = rerun['doi'].apply(clean_doi)
    rerun['U_rederived'] = pd.to_numeric(rerun['U_rederived'], errors='coerce')
    rerun = rerun.dropna(subset=['doi', 'U_rederived'])[['doi', 'U_rederived']]

    merged = frozen.merge(rerun, on='doi', how='inner')
    merged['delta'] = (merged['U_rederived'] - merged['U_frozen']).abs()

    n = len(merged)
    if n == 0:
        print("ERROR: no DOIs matched between frozen and rederived CSVs")
        print(f"  frozen columns:    {list(pd.read_csv(args.frozen, nrows=1, dtype=str).columns)}")
        print(f"  rederived columns: {list(pd.read_csv(args.rederived, nrows=1, dtype=str).columns)}")
        print(f"  frozen DOIs after cleaning (first 3):    {frozen['doi'].head(3).tolist()}")
        print(f"  rederived DOIs after cleaning (first 3): {rerun['doi'].head(3).tolist()}")
        return

    stats = {
        'n': n,
        'mean_abs_delta': merged['delta'].mean(),
        'median': merged['delta'].median(),
        'p90': merged['delta'].quantile(0.90),
        'p95': merged['delta'].quantile(0.95),
        'p99': merged['delta'].quantile(0.99),
        'max': merged['delta'].max(),
        'within_0.036': (merged['delta'] <= 0.036).sum() / n * 100,
        'within_0.068': (merged['delta'] <= 0.068).sum() / n * 100,
    }

    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)

    md = [
        "# DNI v4.0 — Tolerance Comparison (Judge Re-derivation)",
        "",
        f"**Matched DOIs:** {n}",
        "",
        "## Summary Statistics (|ΔU| = |U_rederived − U_frozen|)",
        "",
        f"| Metric | Value |",
        f"| --- | --- |",
        f"| Mean |ΔU|           | {stats['mean_abs_delta']:.4f} |",
        f"| Median |ΔU|         | {stats['median']:.4f} |",
        f"| p90                  | {stats['p90']:.4f} |",
        f"| p95                  | {stats['p95']:.4f} |",
        f"| p99                  | {stats['p99']:.4f} |",
        f"| Max                  | {stats['max']:.4f} |",
        f"| % within ±0.036      | {stats['within_0.036']:.1f}% |",
        f"| % within ±0.068      | {stats['within_0.068']:.1f}% |",
        "",
        "## Pass / Fail Against Published Tolerance Certificate",
        "",
        "The Tolerance Certificate (README §5) claims:",
        "- 95% of |ΔU| within ±0.036",
        "- 99% of |ΔU| within ±0.068",
        "",
        "Replication result:",
        f"- 95th percentile:  {stats['p95']:.4f}  "
            + ("✅ PASS" if stats['p95'] <= 0.036 else "⚠ OUTSIDE BAND"),
        f"- 99th percentile:  {stats['p99']:.4f}  "
            + ("✅ PASS" if stats['p99'] <= 0.068 else "⚠ OUTSIDE BAND"),
        "",
        "Variance is driven by Gemini temperature=0.4 and the absence of ",
        "response seeding. See README §5 for the full certificate.",
        "",
    ]
    out.write_text('\n'.join(md), encoding='utf-8')

    print(f"Matched DOIs: {n}")
    print(f"p95 |ΔU|:     {stats['p95']:.4f}")
    print(f"p99 |ΔU|:     {stats['p99']:.4f}")
    print(f"Max |ΔU|:     {stats['max']:.4f}")
    print(f"Written:      {out}")


if __name__ == '__main__':
    main()
