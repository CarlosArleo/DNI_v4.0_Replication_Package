# DNI v4.0 — Disclosure Protocol

**Version:** 1.0
**Date:** 22 April 2026
**Author:** Carlos Arleo — c.arleo@localis-ai.uk
**Indicator:** Darwinian Novelty Indicator (DNI), version 4.0
**Context:** Metascience Novelty Indicators Challenge — Replication Package for the Blind Sample of 1,000 DOIs

---

## 1. Principle

DNI v4.0 is an experimental scientific instrument. Its replication contract follows the conventional split used in experimental science for proprietary reagents: the **assay protocol** is public and reviewable; the **reagent specification** is sealed, hash-pre-registered, and available under controlled access to accredited reviewers. This lets an independent reviewer verify the mechanics of the indicator without uncontrolled reuse of the sealed components.

This document states, explicitly, what this replication package publishes, what it holds in sealed deposit, and how a reviewer can verify both.

---

## 2. Tier 1 — Public harness (in this repository)

The following files constitute the "harness" — the orchestration, scoring, and determinism-bearing code. They are published under the MIT licence and are sufficient to verify the reproducibility claims in `tolerance_certificate.md`.

| File                                          | Role                                                             |
| --------------------------------------------- | ---------------------------------------------------------------- |
| `replicate_uniqueness.py`                   | Single-call Uniqueness reproduction script                       |
| `compare_uniqueness.py`                     | Tolerance comparator                                             |
| `runReplication.ts`, `run_replication.sh` | Full-pipeline runner (reference)                                 |
| `src/genotype.ts`                           | Four-sensor factory — orchestration spine                       |
| `src/mutation/weightMutation.ts`            | Darwinian weight mutation — ensemble diversity operator         |
| `src/core/fitnessEvaluationFlow.ts`         | Per-judge fitness aggregation — formula, thresholds, veto logic |
| `prompt_uniqueness.txt`                     | Verbatim Gemini prompt template for the Uniqueness sensor        |
| `master_forensic_1000.csv`, `.jsonl`      | Frozen ensemble scores for the 1,000-DOI sample                  |
| `tolerance_certificate.md`                  | Ensemble-vs-ensemble tolerance distribution (v2)                 |
| `tolerance_summary.csv`                     | Machine-readable tolerance summary                               |
| `outliers.csv`                              | Papers exceeding ±0.05 on Uniqueness or flipping class          |
| `per_paper_deltas.csv`                      | Full 1,000-row run-1-vs-run-2 comparison                         |

Together these files publish: the composite scoring formula, the four-sensor interface, the Socratic weight-mutation mechanism, the fitness aggregation rules, the veto thresholds (Coherence veto, Retraction veto, Review Cap), the single-call replication surface, the ensemble tolerance band, and every per-paper measurement that supports those claims.

A reviewer with Tier 1 alone can independently verify determinism, tolerance, and the internal consistency of the reported numbers.

---

## 3. Tier 2 — Behavioural cards (in the README)

The README contains behavioural specifications of each sealed component: what it consumes, what it produces, what fallbacks it uses on data blindness, and what known failure modes exist. Specifically:

- **Tension sensor** — README §9 Stage 2 — cold-start fallback = 0.40 when `citation_count = 0`
- **Synthesis sensor** — README §9 Stage 2 — Entropy fallback when `embedding_vector` is missing
- **Coherence sensor** — README §9 Stage 2 — graph-efficiency-based, bit-exact under identical inputs (confirmed 100% exact-match in `tolerance_certificate.md` §1)
- **Uniqueness sensor** — README §4 and §9 Stage 3 — Gemini 2.0 Flash @ temperature 0.4 via the public `prompt_uniqueness.txt`
- **Review Cap veto** — README §9 Stage 4 — caps Uniqueness at 0.45 for systematic-review papers
- **Title Damper** — README §9 Stage 4 — caps Uniqueness at 0.75 for papers titled "Observation of X" or "Measurement of X"
- **Bio Boost** — README §9 Stage 4 — applies Uniqueness floor of 0.85 to papers with bio-method keywords in top bio journals when the LLM underscores them
- **Coherence veto** — `src/core/fitnessEvaluationFlow.ts` Phase 7 — caps composite score at 0.5 when NoveltyScore > 0.75 and Coherence < 0.40
- **Retraction veto** — `src/core/fitnessEvaluationFlow.ts` Phase 8 — forces score to 0.0 when `is_retracted = true`

These cards are falsifiable: a reviewer can verify that the published behaviour matches the tolerance certificate without access to the underlying implementation.

---

## 4. Tier 3 — Sealed reagents (under controlled access)

The following are **not** in this public repository. They are held as the scientific reagent:

- `src/detectors/citationAnalyzer.ts` — Tension sensor implementation
- `src/detectors/synthesisDetector.ts` — Synthesis sensor implementation
- `src/detectors/coherenceDetector.ts` — Coherence sensor graph construction
- `src/detectors/disruptionDetector.ts` — Uniqueness sensor post-processing, Review Cap application, Title Damper, Bio Boost
- Any retrieval corpus, cached embeddings, or fine-tuned weights used inside those detectors

SHA-256 hashes of the sealed artefacts are listed in `SEALED_ARTIFACTS.sha256` and are timestamped publicly at https://doi.org/10.5281/zenodo.19652301
(deposited 2026-04-19).

---

## 5. Reviewer access to sealed artefacts

Accredited reviewers — including the Challenge panel — may request read-only access to the Tier 3 artefacts under a short Replication MTA covering non-redistribution and non-derivative-work use for the duration of review.

**Request:** email `c.arleo@localis-ai.uk` with subject line `DNI v4.0 Tier 3 access request`. Replies within 48 hours. Access is granted via a time-limited encrypted bundle matching the pre-registered hash.

---

## 6. Post-competition

After the Challenge decision is announced, Tier 3 will be released under one of the following regimes, at the author's discretion:

- Full open-source (MIT or Apache-2.0), matching Tier 1
- Open-source under a scientific-use licence (e.g. CC-BY-NC for non-commercial research use)
- Retained as proprietary with a commercial-licence pathway

This protocol is explicit that **Tier 1 + Tier 2 are sufficient for the replication contract** as stated by the Challenge Team. Tier 3 is the reagent, not the protocol.

---

## 7. Verifying this document

Any reviewer can independently verify the following, without trusting the author:

1. **That Tier 1 files produce the tolerance band reported in `tolerance_certificate.md`** — by running `replicate_uniqueness.py` and `compare_uniqueness.py` as described in README §3.
2. **That Tier 2 behavioural cards match the tolerance band** — by running the scripts on cold-start inputs (papers with no citations, no embeddings) and confirming the documented fallback values appear in the output.
3. **That Tier 3 sealed artefacts match the pre-registered hashes in `SEALED_ARTIFACTS.sha256`** — on access request under MTA, by re-hashing the received bundle with any standard SHA-256 implementation.

No claim in this document requires trust in the author. Every claim is locally verifiable against the published artefacts or against the reviewer's own inspection under MTA.
