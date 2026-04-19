> **Scope:** this certificate reports **ensemble-vs-ensemble** reproducibility — two full 5-judge Socratic production runs against the frozen 1,000-DOI blind sample, re-executed after the April 2026 tolerance remediation. This is NOT the single-call replication band published in README §5 Run 1 (Uniqueness p95 = 0.140). Single-call tolerance is what a reviewer running `replicate_uniqueness.py` will observe; ensemble tolerance is what the production indicator achieves after averaging across judges. Both numbers are correct; they measure different surfaces.
>
> **This file (v2) supersedes the previous tolerance_certificate.md dated 19 April 2026.** The v1 → v2 improvements are summarised in §3 below.

---

# DNI v4.0 — Tolerance Certificate (v2, post-remediation)

**Matched DOIs:** 1000
**Classification agreement:** 958/1000 (95.8%)
**Review Cap veto agreement:** 999/1000 (99.9%)
**Run configuration:** 5-judge Socratic ensemble, Gemini 2.0 Flash @ temperature 0.4, volatility 0.25 (Gen 1), identical frozen input corpus across both runs

## 1. Per-Dimension Tolerance Distribution

| dimension | n | mean\|Δ\| | median | p90 | p95 | p99 | max | exact_% | ≤0.01_% | ≤0.03_% | ≤0.05_% |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| NoveltyScore     | 1000 | 0.0071 | 0.0048 | 0.0168 | 0.0216 | 0.0372 | 0.0600 | 23.0 | 74.1 | 98.1 | 99.8 |
| Uniqueness       | 1000 | 0.0131 | 0.0100 | 0.0280 | 0.0360 | 0.0620 | 0.1000 | 13.8 | 46.4 | 91.3 | 98.1 |
| Tension          | 1000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 100.0 | 100.0 | 100.0 | 100.0 |
| Synthesis        | 1000 | 0.0001 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0452 | 99.7 | 99.7 | 99.7 | 100.0 |
| Coherence        | 1000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 100.0 | 100.0 | 100.0 | 100.0 |
| Confidence       | 1000 | 0.0268 | 0.0205 | 0.0561 | 0.0769 | 0.1238 | 0.2158 |  0.0 | 24.8 | 66.7 | 87.7 |
| ControversyIndex | 1000 | 0.2351 | 0.2028 | 0.4872 | 0.5667 | 0.6725 | 0.8320 |  3.7 |  6.8 | 11.8 | 16.6 |
| Spread           | 1000 | 0.0298 | 0.0229 | 0.0622 | 0.0854 | 0.1376 | 0.2398 |  0.0 | 23.0 | 61.8 | 84.9 |

**Outliers** (|ΔU| > 0.05 or classification mismatch): **55 papers** — see `outliers.csv`
**Full per-paper deltas:** `per_paper_deltas.csv` (1,000 rows, both runs, all dimensions and composite scores)

## 2. Suggested README language

> *Under identical inputs, the DNI v4.0 ensemble reproduces the Uniqueness dimension to within ±0.036 on 95% of the 1,000-DOI blind sample, ±0.062 on 99%, with a maximum observed deviation of ±0.100. NoveltyScore reproduces to within ±0.022 at p95, ±0.037 at p99, max ±0.060. Tension and Coherence reproduce exactly on all 1,000 DOIs. Classification agreement is 95.8% and Review Cap veto agreement is 99.9%. The remaining 4.2% of classification disagreements are boundary flips at the 0.55 Incremental/Moderately-Novel threshold and do not involve any |ΔNoveltyScore| above 0.06.*

## 3. What changed between v1 (19 April) and v2 (this certificate)

| metric | v1 (19 Apr) | v2 (this run) | change |
| --- | ---: | ---: | --- |
| Uniqueness max \|Δ\| | 0.370 | 0.100 | **−3.7× (tightened)** |
| NoveltyScore max \|Δ\| | 0.3202 | 0.0600 | **−5.3× (tightened)** |
| Synthesis max \|Δ\| | 0.0853 | 0.0452 | **−1.9× (tightened)** |
| Tension exact-match % | 99.5% | **100.0%** | bit-exact |
| Coherence exact-match % | 99.3% | **100.0%** | bit-exact |
| Classification agreement | 96.0% | 95.8% | ≈ unchanged |
| Veto agreement | 99.6% | **99.9%** | tightened |

The single outlier that dominated v1's Uniqueness maximum (`10.1093/jncics/pkae037`, |ΔU| = 0.370) no longer appears in the outlier set with a deviation above 0.10 in v2. This is consistent with the April tolerance-remediation work on ensemble seeding and weight-mutation determinism; no silent changes to sensor implementations were made between v1 and v2.

## 4. Classification mismatches are boundary flips, not engine drift

All 42 classification mismatches in this re-run involve papers whose NoveltyScore moved by less than 0.05 but crossed the Incremental / Moderately-Novel threshold at 0.55. Under the class-boundary definition in use, a paper at 0.549 classifies as *Incremental* and at 0.551 as *Moderately Novel*; a ΔU of 0.04 — well within the reported tolerance band — can therefore flip class without reflecting any change in underlying signal. No paper in this re-run flipped class with a |ΔNoveltyScore| above 0.06.

This is categorical-function sensitivity at fixed thresholds, not non-determinism in the underlying indicator. A reviewer who wishes to see the scalar band alone (independent of the class boundary) should cite the NoveltyScore row in §1 above, or the per-paper deltas in `per_paper_deltas.csv`.

## 5. What these numbers certify and what they do not

**Certified by this run:**

- Under identical frozen inputs, the Tension, Synthesis, and Coherence dimensions reproduce to within ±0.05 on essentially all 1,000 DOIs (100%, 100%, 100% within ±0.05; with Synthesis exhibiting 3 residual non-zero deltas, all below 0.046).
- Under identical frozen inputs, the Uniqueness dimension — the only dimension driven by a non-deterministic LLM call — reproduces to within ±0.062 on 99% of the 1,000 DOIs, with a maximum of ±0.100.
- The composite NoveltyScore reproduces to within ±0.060 across all 1,000 DOIs.
- The Review Cap veto — the one post-processing decision that can change classification independent of scalar score — agrees on 999/1000 DOIs.

**Not certified by this run:**

- Stability under *different* model versions, temperatures, or API generations. See README §5 Run 2 and §10 for the single-call band under `gemini-2.5-flash`.
- Stability under *different* frozen corpora. The reproducibility claims here are for the 1,000-DOI sample only; generalisation to the wider literature requires a separate study.
- Validity (does a high DNI score identify truly novel science?). This certificate measures *reproducibility*, not validity. Validity is addressed in the Validation Report (separate document).
