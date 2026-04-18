# DNI v4.0 — Tolerance Certificate

**Matched DOIs:** 1000
**Classification agreement:** 960/1000 (96.0%)
**Review Cap veto agreement:** 996/1000 (99.6%)

## Per-Dimension Tolerance Distribution

| dimension | n | mean_abs_delta | median | p90 | p95 | p99 | max | exact_match_% | within_0.01_% | within_0.03_% | within_0.05_% |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| NoveltyScore | 1000 | 0.0083 | 0.0050 | 0.0180 | 0.0233 | 0.0387 | 0.3202 | 12.6000 | 72.3000 | 97.7000 | 99.4000 |
| Uniqueness | 1000 | 0.0141 | 0.0100 | 0.0310 | 0.0360 | 0.0680 | 0.3700 | 14.3000 | 46.3000 | 89.3000 | 98.0000 |
| Tension | 1000 | 0.0014 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.3000 | 99.5000 | 99.5000 | 99.5000 | 99.5000 |
| Synthesis | 1000 | 0.0223 | 0.0216 | 0.0461 | 0.0481 | 0.0630 | 0.0853 | 9.5000 | 16.1000 | 67.2000 | 96.0000 |
| Coherence | 1000 | 0.0005 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.2500 | 99.3000 | 99.4000 | 99.7000 | 99.8000 |

**Outliers** (|ΔU| > 0.05 or classification mismatch): 57 papers — see `outliers.csv`

## Suggested README Language

> *Under identical inputs, the Uniqueness sensor reproduces to within ±0.036 on 95% of papers, ±0.068 on 99%, with a maximum observed deviation of ±0.370 across 1000 DOIs. Variance is driven by Gemini temperature=0.4 and Monte-Carlo weight mutation (volatility 0.25 / 0.35).*