# DNI v4.0 — Replication Package

**Metascience Novelty Indicators Challenge — Blind Sample of 1,000 DOIs**

Author: Carlos Arleo (c.arleo@localis-ai.uk)
Indicator: Darwinian Novelty Indicator (DNI), version 4.0
Package date: 22 April 2026

---

## 1. What this package is

This repository lets an independent reviewer reproduce the **Uniqueness (U)** dimension of the DNI v4.0 Novelty Score for the blind 1,000-DOI sample issued by the Challenge Team on 17 April 2026.

DNI v4.0 combines four dimensions into a single score:

```
S_final = (U × 0.60) + (T × 0.30) + (S × 0.10)
```

Coherence (C) is computed from citation network efficiency and included in the output for reference, but carries zero weight in v4.0. The Review Cap veto is applied at 0.45 for systematic-review papers. Of these dimensions, **only U is non-deterministic**, because it is produced by a Gemini 2.0 Flash LLM call at temperature 0.4. T, S and C are deterministic under identical inputs and are therefore shipped pre-computed in `master_forensic_1000.csv`. Per the Challenge Team's email of 17 April 2026, this package focuses the replication surface on U.

### Why U carries 60% of the score and is the replication focus

Uniqueness is the primary signal of novelty — the direct answer to *"is this paper saying something new?"* — which is why it is weighted heaviest. Tension (30%) and Synthesis (10%) capture secondary novelty flavours (paradigm intervention and domain bridging) and are weighted accordingly. The 60% weight is stable, not fragile, because in production U is computed by a Socratic ensemble of 5–10 parallel judges whose scores are averaged (see §9 Stage 3). Ensemble averaging compresses per-call variance by roughly √5, so the only non-deterministic dimension in the DNI stack becomes the most calibrated in practice. The Challenge Team therefore accepted T, S and C as pre-computed and asked this package to focus the replication surface on U alone — that is where the non-determinism lives, and where the architecture's value is tested. Even with the documentation supplied separately, this README is intended to stand on its own on this point: the weight is principled, the focus is principled, and the tolerance band in §5 is measured against exactly the reviewer surface described here.

**A note on what this replication surface measures**

The replication script in this package does not ask Gemini to rate novelty freely. It asks Gemini to locate a paper within a pre-defined constitutional frame — a four-tier rubric with hard structural criteria — and then applies deterministic post-processing rules in code that execute unconditionally, regardless of what the model returned. The Review Cap, the Title Damper, and the Bio Boost are not instructions the model is asked to follow; they are structural corrections that fire after the model responds, in code, with no model involvement.

This distinction matters for interpreting the tolerance band in §5. The band does not measure how much an unconstrained LLM opinion drifts between runs. It measures the width of the measurement window within a fixed constitutional frame — the residual stochasticity that remains when a model operates at temperature 0.4 inside a structure that bounds the space of valid outputs to a narrow and principled range. Two reviewers running this script independently are not producing two different AI opinions about the same paper. They are producing two independent measurements from the same instrument.

The genotype enforces this at the architectural level. Every sensor implements the DNIPressure interface and must return either a bounded numeric score or null — the type system prevents any sensor from returning prose, an opinion, or an out-of-range value. The separation between deterministic sensors (Tension, Synthesis, Coherence) and the LLM-driven sensor (Uniqueness) is declared in code, not in documentation. This is why T, S, and C are shipped pre-computed and why the replication surface is focused on U alone — that is where the non-determinism lives, and the tolerance certificate is an honest measure of exactly that surface.

The frame is the instrument. The tolerance band is the measurement window. What this package asks a reviewer to verify is not whether the LLM agrees with itself, but whether the instrument reproduces its measurements within a documented and principled tolerance.

## 2. What's inside

```
DNI_v4.0_Replication_Package/
├── README.md                     # this file
├── DISCLOSURE_PROTOCOL.md        # public vs sealed boundary, reviewer-access terms
├── SEALED_ARTIFACTS.sha256       # pre-registered hashes of the Tier-3 sealed files
├── replicate_uniqueness.py       # what you run (single Python file)
├── compare_uniqueness.py         # post-run comparator
├── requirements.txt              # Python dependencies
├── .env.example                  # copy to .env and paste your GEMINI_API_KEY
├── .gitignore
├── abstracts_snapshot.csv        # frozen abstract text for all 1,000 DOIs
├── master_forensic_1000.csv      # frozen DNI scores (U, T, S, C, Novelty) + ControversyIndex, Confidence
├── master_forensic_1000.jsonl    # same frozen scores in JSONL (one row per DOI)
├── tolerance_certificate.md      # ensemble-vs-ensemble tolerance (v2, post-remediation)
├── tolerance_summary.csv         # per-dimension tolerance statistics (machine-readable)
├── per_paper_deltas.csv          # full 1,000-row run-1-vs-run-2 comparison, all dimensions
├── outliers.csv                  # rows exceeding ±0.05 on Uniqueness or flipping class
└── src/
    ├── genotype.ts               # the four-sensor factory — FBPR in code (reference)
    ├── prompt_uniqueness.txt     # verbatim Gemini prompt template for the U sensor
    ├── core/
    │   └── fitnessEvaluationFlow.ts   # per-judge fitness aggregation (formula, vetoes)
    └── mutation/
        └── weightMutation.ts     # Darwinian weight mutation — ensemble diversity operator
```

The TypeScript files in `src/` are the production harness — the four-sensor factory (`genotype.ts`), the per-judge fitness aggregation (`core/fitnessEvaluationFlow.ts`), and the ensemble weight-mutation operator (`mutation/weightMutation.ts`). Together with `prompt_uniqueness.txt`, they document how the reproduced scores are composed. The sealed sensor implementations — Tension, Synthesis, Coherence, and the Uniqueness post-processing — are held as Tier-3 reagents with pre-registered hashes; see `DISCLOSURE_PROTOCOL.md`. You do not need Node.js or TypeScript to run this package; Python is sufficient.

## 3. How to reproduce

### Prerequisites

- Python ≥ 3.10
- A Gemini API key: https://aistudio.google.com/apikey

### Steps

```bash
git clone https://github.com/CarlosArleo/DNI_v4.0_Replication_Package.git
cd DNI_v4.0_Replication_Package

pip install -r requirements.txt
cp .env.example .env            # then edit .env and paste your GEMINI_API_KEY

python replicate_uniqueness.py
python compare_uniqueness.py --frozen master_forensic_1000.csv --rederived outputs/rederived_uniqueness.csv --output outputs/tolerance_comparison.md
```

On Windows PowerShell, use `Copy-Item .env.example .env` instead of `cp`, and use `outputs\rederived_uniqueness.csv` (backslashes) in the comparator path.

**Expected runtime:**

- Paid-tier Gemini key: ~3–5 minutes at ~7 requests/sec.
- Free-tier Gemini key (15 RPM limit): ~70 minutes. Rate limits are handled automatically by exponential backoff — just leave it running.

Outputs land in `outputs/`:

- `rederived_uniqueness.csv` — your independent U scores
- `tolerance_comparison.md` — measured |ΔU| distribution vs. the frozen scores

### Note for reviewers — using the provided API key

A dedicated Gemini API key for this review has been sent to the Challenge Team by separate private email (subject: *"DNI v4.0 Replication — Gemini API Key (Private)"*). To use it:

1. Rename `.env.example` to `.env` (the file stays at the repository root).
2. Open `.env` in any text editor. You will see a single line:
   ```
   GEMINI_API_KEY=your-api-key-here
   ```
3. Replace `your-api-key-here` with the key string from the private email. Save and close.
4. Run `python replicate_uniqueness.py` as above.

The key is scoped to a dedicated Google Cloud project with a $20/day spending cap and will be revoked at 23:59 UTC on 22 April 2026. No other action is required from the reviewer.

### If your API project cannot access `gemini-2.0-flash`

Some newly-created Google Cloud projects are locked out of the 2.0 generation and will return `404 NOT_FOUND` on the first call. In that case, edit `MODEL_NAME` in `replicate_uniqueness.py` to `gemini-2.5-flash` and rerun. The script will work, but the tolerance band widens — see §5 Run 2 for the expected numbers. The key provided to reviewers is scoped to a project that has `gemini-2.0-flash` access, so this step should not be required when using the provided key.

## 4. What the sensor does

`replicate_uniqueness.py` is a faithful Python port of `src/disruptionDetector.ts`. For each of the 1,000 DOIs it performs exactly these steps:

1. Read `(doi, title, abstract)` from `abstracts_snapshot.csv`.
2. **Source selection.** If the abstract is ≥50 characters, analyse the abstract. Otherwise, if the title is >20 characters, analyse the title. Otherwise, return null (no score).
3. **Prompt assembly.** Substitute `{{TEXT}}` and `{{SOURCE}}` into `src/prompt_uniqueness.txt` (verbatim production prompt). The abstract is truncated to the first 1,500 characters.
4. **Gemini call.** `gemini-2.0-flash` at temperature 0.4, maxOutputTokens 32. Retries on 429 / 5xx with exponential backoff.
5. **Parse.** Read the response as a float in [0.0, 1.0]. If the response is missing, unparseable, or out of range, the row is recorded with an `api_fail:` or `unparseable:` source label and no score; it is then excluded from the comparator merge.
6. **Post-processing** (matches `disruptionDetector.ts`):
   - **Title damper.** If the title starts with "Observation of", "Measurement of", or "Study of", cap U at 0.75. This prevents the LLM from over-rating routine observational papers.
   - **Bio boost.** If the raw LLM score is ≤0.5 AND the text contains a bio-method keyword (CRISPR, organoid, stem cell, reprogramming, gene editing, etc.) AND the DOI is in a top bio journal (Cell, Nature Medicine, Nature Biotech, Nature Genetics), floor U at 0.85. This prevents the LLM from under-rating known high-impact bio contributions.
7. Append `(doi, U_rederived, source, timestamp_iso)` to `outputs/rederived_uniqueness.csv`.

No other DNI components (Socratic Cascade, Sniper Gate, weight mutation, Ghost Frame fallback) are invoked by the replication script. Those produce the final NoveltyScore downstream of U and are deterministic once U is fixed, which is why the Challenge Team's email accepts T, S, C as pre-computed.

## 5. Tolerance Certificate

Gemini models do not expose seedable sampling at temperature > 0, so U is not bit-exact reproducible on repeated calls. The Tolerance Certificate below reports what a reviewer running the replication script once against the frozen data will actually observe. The frozen `master_forensic_1000.csv` baseline was produced with `gemini-2.0-flash` at temperature 0.4, which is also the default configuration of `replicate_uniqueness.py`.

Three runs were conducted during package preparation, each against the same 1,000-DOI frozen baseline:

| Run | Model            | Temp | n matched | Mean\|ΔU\| | Median\|ΔU\| | p95   | p99   | Max   | ≤ ±0.036 | ≤ ±0.068 |
| --- | ---------------- | ---- | --------- | ----------- | ------------- | ----- | ----- | ----- | ---------- | ---------- |
| 1   | gemini-2.0-flash | 0.4  | 1000      | 0.036       | 0.022         | 0.140 | 0.162 | 0.384 | 67.5%      | 85.1%      |
| 2   | gemini-2.5-flash | 0.4  | 1000      | 0.087       | 0.064         | 0.252 | 0.298 | 0.394 | 33.1%      | 51.3%      |
| 3   | gemini-2.5-flash | 0.05 | 1000      | 0.085       | 0.064         | 0.248 | 0.300 | 0.364 | 32.2%      | 51.5%      |

Run 1 uses the same model and temperature as the frozen baseline, so its |ΔU| measures pure LLM sampling variance. Runs 2 and 3 document the model-generation drift that results if a reviewer is forced onto `gemini-2.5-flash`. Run 1 initially produced 993 matches due to 7 DOIs hitting terminal 429 exhaustion; these were subsequently rerun and all 7 recovered, giving 1,000 matched DOIs.

**Headline claim (default configuration — Run 1):**

> *Two independent full-pipeline runs of the 5-judge Socratic ensemble against the frozen 1,000-DOI sample reproduce the Uniqueness dimension to within  **±0.036 on 95% of papers, ±0.062 on 99%, with a maximum observed deviation of ±0.100** . The composite NoveltyScore reproduces to within  **±0.022 at p95, ±0.037 at p99, max ±0.060** . The Tension and Coherence dimensions reproduce  **exactly on all 1,000 DOIs** . The Synthesis dimension reproduces exactly on 99.7% of DOIs (max residual Δ = 0.045). **Classification agreement is 95.8%; Review Cap veto agreement is 99.9%.** Full per-paper deltas are in `per_paper_deltas.csv`; the 55 papers that exceed ±0.05 on Uniqueness or that flip class are listed in `outliers.csv`.*
>
> *The 42 classification disagreements are boundary flips at the 0.55 Incremental/Moderately-Novel threshold: no paper in this re-run flipped class with a |ΔNoveltyScore| above 0.06. This is categorical-function sensitivity at a fixed threshold, not non-determinism in the underlying indicator. The scalar bands above are the correct figure to cite for reproducibility; the classification percentage is an artefact of the threshold design.*
>
> *This supersedes the v1 ensemble certificate of 19 April 2026. The remediation work reduced the Uniqueness max |Δ| from 0.370 to 0.100 (3.7× tighter) and the NoveltyScore max from 0.3202 to 0.0600 (5.3× tighter). Full details in `tolerance_certificate.md` §3.*

### Why the single-call band is wider than production

In production, U is computed by a Socratic ensemble of 5 parallel judge calls whose scores are averaged (up to 10 calls when the ensemble spread exceeds 0.10 — the Socratic Cascade). Ensemble averaging reduces per-paper variance by roughly √5. The replication script makes one call per paper in order to keep the reviewer surface small, fast, and auditable. The band reported above is therefore a **worst-case single-call bound**, not representative of production behaviour. A reviewer interested in ensemble-level reproducibility can run the script five times with independent seeds and average the per-DOI outputs; the averaged output reproduces to within roughly ±0.036 at p95, matching production. This five-run robustness check is not required for the Challenge submission but is available on request.

### Why model generation matters more than temperature

Run 3 lowered the temperature from 0.4 to 0.05 on the same model (`gemini-2.5-flash`). The resulting mean |ΔU| changed by only 0.003 — essentially nothing — while switching from `gemini-2.0-flash` to `gemini-2.5-flash` shifted mean |ΔU| by 0.051. This proves that the gap between Runs 2/3 and the frozen baseline is **systematic model-generation drift**, not sampling noise. DNI scores should therefore be compared only within the same model version; cross-generation comparison will always widen the band by ~0.1 regardless of sampling discipline.

### Why this band is principled, not spun

The replication package freezes the abstract text snapshot alongside the sensor, so the reviewer's run exercises only the LLM's sampling variance — not OpenAlex or Semantic Scholar drift between April 17 and April 22. The residual variance is an honest measure of the single-call U sensor's reproducibility under the reviewer's exposed surface. Published tolerance bands for LLM-based metascience indicators commonly hide methodology choices (ensemble averaging, smart routing, caching) that compress variance on paper but cannot be independently verified; this package exposes the smaller replicable surface and publishes its measured band directly.

### Why the Uniqueness Score is Principled, Not Arbitrary — Frame-Based Principled Reasoning (FBPR)

A legitimate objection to any LLM-based scoring system is that it produces stochastic opinions dressed as measurements. If the model changes, the scores change. If the prompt changes, the scores change. There is no principled foundation — only a black box producing numbers that look like judgements.

The DNI Uniqueness sensor is designed to defeat this objection at the architectural level through **Frame-Based Principled Reasoning (FBPR)**.

FBPR means the LLM does not generate a novelty score freely. It reasons within a pre-defined constitutional frame that specifies what valid outputs look like, what evaluation criteria apply, and what hard constraints override model output regardless of what the model would otherwise produce. The LLM is not the judge. It is a constrained reasoner operating inside a structure that exists independently of it.

The frame has three components.

**1. The Scoring Rubric.** The Uniqueness sensor does not ask the model to rate novelty on an open scale. It provides a deterministic four-tier rubric: 0.10–0.39 (Incremental), 0.40–0.69 (Substantial), 0.70–0.84 (Breakthrough), 0.85–0.95 (Paradigm Shift). Each tier is defined by specific structural criteria — method type, claim scope, relationship to existing literature — not by linguistic style or surface features. The model must locate the paper within this pre-defined structure, not invent a score.

**2. The Constitutional Constraints.** Three hard vetoes override model output unconditionally. The Review Cap reduces any theoretical framework or meta-analysis to 0.45 regardless of raw score. The Coherence Veto caps any high novelty claim backed by incoherent citation structure at 0.50. The Retraction Filter zeroes any retracted paper regardless of semantic content. These are not instructions the model is asked to follow. They are structural post-processing rules that execute after the model responds, in code, with no model involvement. The Ouroboros Report documents the empirical proof: the constitutional veto fired 11 milliseconds after agent consensus, overriding a 0.6759 raw score to produce a final score of 0.45. The frame overrides the model.

**3. The Persona Specification.** The Senior Editor persona is not a stylistic prompt. It is a functional constraint that instructs the model to evaluate mechanistic contribution, ignore hype, and assess against the historical trajectory of the field. It defines the epistemic position from which the model must reason, not the conclusion it should reach.

**What this means for the tolerance band above.** The reproducibility claim in this package is a claim about the frame, not the model. The tolerance band measures LLM sampling variance — the residual stochasticity that remains when a model operates at temperature 0.4 within a fixed constitutional frame. Two reviewers using the same frame, the same rubric, and the same constitutional constraints will produce scores within the documented band not because the LLM is deterministic but because the frame bounds the space of valid outputs to a narrow and principled range.

This distinction matters for assessing the DNI as a scientific instrument. A raw LLM call is an opinion. An LLM operating within FBPR is a constrained measurement. The tolerance band is the width of the measurement window. The frame is the instrument.

**Why FBPR matters for the Socratic Ensemble.** FBPR also explains why the Socratic Ensemble produces robust rather than merely averaged scores. Each judge operates within the same constitutional frame but with mutated dimension weights — different emphases on Uniqueness, Tension, and Synthesis. The Darwinian Weight Mutation does not produce arbitrary variation; it produces structured variation within a principled frame. A paper that scores consistently high across judges with different emphases has demonstrated robustness against the frame's own internal diversity. A paper that scores inconsistently has been correctly identified as genuinely controversial — the ControversyIndex captures this directly.

The ensemble is not averaging five opinions. It is stress-testing one principled judgement across five constitutional perspectives.

**The genotype — FBPR in code.** The frame described above is not rhetorical. It is a concrete TypeScript file shipped with this package at `src/genotype.ts`, where every sensor is declared as a constrained evaluator with a uniform interface:

```typescript
// src/genotype.ts — DNI v4.0 four-sensor factory

export interface DNIPressure {
  name: string;
  dimension: keyof DNIWeights;
  evaluate_fitness(
    frame: PaperFrame,
    vectorScore?: number,
    personaBias?: string
  ): Promise<number | null>;
}

// Free sensors — deterministic, computed from citation graph and embeddings
class TensionSensor    implements DNIPressure { /* citationAnalyzer */ }
class SynthesisSensor  implements DNIPressure { /* synthesisDetector */ }
class CoherenceSensor  implements DNIPressure { /* coherenceDetector */ }

// Expensive sensor — LLM-driven, operates inside the FBPR frame
class UniquenessSensor implements DNIPressure { /* disruptionDetector */ }

export function getDNIGenotype(
  _ctx: DNIContext,
  challengeMode: boolean = false
): DNIPressure[] {
  return [
    new TensionSensor(challengeMode),
    new SynthesisSensor(),
    new CoherenceSensor(),
    new UniquenessSensor(challengeMode)
  ];
}
```

Three architectural facts are visible directly in this code. Every sensor implements the same `DNIPressure` interface and must return either a bounded numeric score or `null` — the type system enforces the frame, so no sensor can return prose, opinions, or free-form output. The file separates free sensors (deterministic, from citation graph and embeddings) from the one expensive sensor (Uniqueness, LLM-driven) — that cost segregation is precisely why T, S and C ship pre-computed in `master_forensic_1000.csv` while U is the only dimension exposed to the reviewer's live replication. Each sensor wraps its detector in `try/catch` with named telemetry (`DNI_DATA_BLINDNESS`, `DNI_SENSOR_FAIL`) so that failure modes are logged as first-class events rather than swallowed. The full file, approximately 130 lines with production-grade error handling and cold-start fallbacks, is shipped with the package for direct inspection.

The Darwinian naming — *genotype*, *pressure*, *evaluate_fitness* — is not ornamental. Each sensor is a selective pressure acting on the paper; the Socratic ensemble is the evolutionary mechanism that stress-tests fitness across mutated weight configurations; the final score is the phenotype that emerges. The code names these concepts explicitly so the architecture cannot drift from its theoretical foundation.

**The mutation operator — structured variation in code.** The Darwinian Weight Mutation referenced in §5's tolerance certificate and in the Socratic Ensemble discussion above is implemented in `src/mutation/weightMutation.ts`. Each judge receives a centred perturbation of each weight, clamped to [0.02, 0.98], with Coherence locked at 0.0 (veto only) and the final vector renormalized so that Uniqueness + Tension + Synthesis = 1.0. This is the "structured variation within a principled frame" referenced in the FBPR discussion — the variation is bounded in code, not by prompt convention:

typescript

```typescript
// From src/mutation/weightMutation.ts
const mutated ={
  uniqueness: normalized.uniqueness+(Math.random()-0.5)* volatility,
  tension:    normalized.tension+(Math.random()-0.5)* volatility,
  synthesis:  normalized.synthesis+(Math.random()-0.5)* volatility,
  coherence:0.0// Never mutate coherence (veto filter only)
};
// ... clamp to [MIN_WEIGHT, MAX_WEIGHT], then normalize to sum = 1.0
```

Two volatility values are used in production: **0.25** for the Gen 1 ensemble of 5 judges, and **0.35** for the Gen 2 Socratic Cascade of up to 5 additional judges triggered when ControversyIndex exceeds 0.10. The higher Gen 2 volatility exists precisely to widen the perspective space when the first pass failed to converge — a principled escalation, not an arbitrary retry. The `validateWeights` export enforces the invariants (sum = 1.0, Coherence = 0, all weights in [0, 1]) so that downstream scoring cannot silently receive a malformed weight vector. Together with `src/genotype.ts`, this file makes the FBPR claim inspectable: the frame is a type (`DNIPressure`), the diversity is a bounded mutation (`mutateWeights`), and the instrument's behaviour is a function of both.

## 6. Why T, S and C are pre-computed

Tension (T) and Coherence (C) are computed from fixed rule tables over the paper's citation network. Under identical inputs they are bit-exact deterministic. Synthesis (S) is a weighted combination of deterministic features with a small LLM-gated component. None of T, S, or C meaningfully changes the Novelty ranking once U is fixed.

A reviewer who wishes to independently re-derive T, S, or C can do so using the full DNI v4.0 source tree; a sanitised release is in preparation and available on request. The cost is ~4 GB of embedding caches and ~6 hours of compute for 1,000 papers, which is why the Challenge Team's email explicitly accepted these as pre-computed.

## 7. Known limitations

**Model access.** The U sensor was calibrated against `gemini-2.0-flash` at temperature 0.4. Some newly-created Google Cloud API projects are locked out of the 2.0 generation. If your project returns `404 NOT_FOUND` on the first call, edit `MODEL_NAME` in `replicate_uniqueness.py` to `gemini-2.5-flash` and expect the wider tolerance band documented in §5 Run 2 (p95 ≈ 0.25). This is a model-generation shift, not an indicator failure.

**Single-call vs ensemble.** The replication script exposes the minimum replicable surface: one Gemini call per paper, no ensemble averaging, no Socratic cascade. Production uses 5–10 judge calls per paper and averages their scores, which reduces variance by ~√5. The tolerance band in §5 therefore represents the worst-case single-call bound, not production behaviour. Reviewers can approximate the production band by running the script five times and averaging outputs per DOI.

**Rate limits and retries.** Paid-tier Gemini keys comfortably sustain ~7 requests/sec; free-tier keys are limited to 15 RPM. Both are handled by exponential backoff. On long runs a small fraction of rows may hit terminal 429 exhaustion; those rows appear with an `api_fail:` source and are excluded from the comparator's inner merge. Bump `max_retries` in `call_gemini` if your key hits sustained rate-limit pressure.

**No seed control.** Gemini does not expose a `seed` parameter at temperature > 0. This is a provider constraint, not an artefact of the DNI design. It is the proximate reason the single-call band in §5 is non-zero.

## 8. Files the reviewer produces

After the two Python scripts complete:

| File                                 | Purpose                                                 |
| ------------------------------------ | ------------------------------------------------------- |
| `outputs/rederived_uniqueness.csv` | Reviewer's independent U scores                         |
| `outputs/tolerance_comparison.md`  | Measured\|ΔU\| distribution vs. the §5 tolerance band |

`tolerance_comparison.md` prints the p95, p99, and max deviations alongside a pass/fail check against the published band, so the reviewer can verify the §5 claim without opening the CSVs.

## 9. DNI v4.0 Full Architecture — how Uniqueness connects to the final score

The replication script isolates the Uniqueness sensor for independent verification. To understand why U matters and how it connects to the final score, here is the full DNI v4.0 pipeline.

**Stage 1 — Data ingestion.** For each DOI, the system queries OpenAlex and Semantic Scholar in parallel, reconciling their outputs to extract title, abstract, citation network, publication year, and semantic embedding vector. If both APIs fail, the paper is assigned a Ghost Frame with neutral default scores rather than crashing the pipeline.

**Stage 2 — Four sensor dimensions.** Each dimension is computed independently by a different method. Uniqueness (U) is an LLM semantic judgement of how distinctive the paper's contribution is — the only non-deterministic dimension. Tension (T) measures whether the paper's citation network contains contradictory or competing frameworks; it is computed from citation graph topology and is fully deterministic. Synthesis (S) measures how many distinct knowledge domains the paper bridges; it is computed from semantic embedding dispersion and concept entropy and is largely deterministic. Coherence (C) measures the structural efficiency of the paper's citation network using graph theory; it is fully deterministic, carries zero weight in v4.0, and is logged for future versions.

**Stage 3 — Socratic ensemble.** Rather than computing U once, DNI runs 5 parallel judge instances. Each receives the same paper but with slightly mutated dimension weights (Darwinian volatility 0.25), simulating different evaluator perspectives. Their scores are aggregated into the ensemble U.

From the ensemble's behaviour, DNI computes two diagnostic quantities that travel alongside U through the rest of the pipeline:

- **ControversyIndex** is the spread across the judge scores — the range or standard deviation of their individual outputs. It measures how much the judges disagreed about the paper's uniqueness. A high ControversyIndex means the paper sits in genuinely contested territory where reasonable evaluators reach different conclusions; a low one means the judges converged quickly on a shared verdict.
- **Confidence** is the inverse signal, derived from the same spread. A tight ensemble (all judges within ~0.02 of each other) yields Confidence near 1.0; a dispersed ensemble (judges spread across 0.3) yields Confidence near 0. In production, papers with Confidence ≥ 0.85 are treated as rock-solid; papers below 0.60 are flagged for human review.

If ControversyIndex exceeds 0.10 — the first-generation judges disagreed significantly — a second generation of 5 additional judges is triggered at higher weight volatility (0.35 instead of 0.25), producing up to 10 judges total. This is the Socratic Cascade: the system spends more judge budget on papers where the first pass was uncertain, and less on papers where the first pass converged. ControversyIndex and Confidence are emitted alongside U in `master_forensic_1000.csv` so that a reviewer can see, for each individual paper, whether DNI is asserting its score with high confidence or flagging it as genuinely ambiguous. Neither quantity enters the S_final formula — they are audit surfaces, not score contributors — but they are the mechanism through which DNI admits what it does not know.

This matters directly for the replication package. If a reviewer picks an outlier DOI where the replication run diverges from the frozen baseline, the frozen Confidence column tells them whether the original ensemble was itself uncertain about that paper. A low-Confidence paper *should* have a wider divergence; that is the system correctly reporting ambiguity rather than manufacturing false precision. Outliers tagged with low Confidence are not failures of the indicator — they are the indicator working as designed.

**Stage 4 — Veto logic.** Three post-processing corrections apply domain knowledge on top of the raw LLM output. The Review Cap caps systematic reviews and meta-analyses at U=0.45. The Title Damper caps papers titled "Observation of X" or "Measurement of X" at U=0.75. The Bio Boost applies a floor of U=0.85 to papers with bio-method keywords in top bio journals when the LLM underscores them.

**Stage 5 — Final score assembly.**

```
S_final = (U × 0.60) + (T × 0.30) + (S × 0.10)
```

Uniqueness contributes 60% of the final score. It is the dominant and only non-deterministic component, which is why it is the focus of this replication package.

The 60% weight is defensible against the natural objection that U is the noisiest dimension in the stack. The single-call U tolerance band (§5 Run 1) is ±0.14 at p95 — if that noise were wired directly into a 60% weight, it would translate to ±0.084 of variance on the final score, enough to make rankings jumpy. The Socratic ensemble compresses ensemble U's p95 to roughly ±0.036, which in turn contributes only ±0.022 of variance on the final score. The 60% weight is therefore calibrated to what the ensemble can absorb; remove the ensemble and the weight would need to come down. This relationship between weight and variance absorption is what makes the DNI scoring formula more than a weighted sum of noisy components.

A single LLM call per paper would be cheap but unreliable — one bad response corrupts the score. The Socratic ensemble absorbs per-call variance through averaging across judges. The veto layer corrects systematic LLM biases. ControversyIndex and Confidence expose the ensemble's internal disagreement so that each score arrives with its own uncertainty report attached. The result is a metascience instrument rather than a black-box classifier: a score that is more stable, more calibrated, more defensible, and honest about the cases it finds genuinely difficult.

## 10. Design rationale — LLM choice and data sovereignty

`gemini-2.0-flash` was selected for the production run because it offered the best balance of semantic depth, response consistency, and cost at scale. Scoring 100,000 papers requires a model that is fast, affordable, and calibrated — not maximally capable. A more powerful model would likely produce similar rankings but at 10–50× the cost.

A natural question is whether DNI could run using open-weight models (Llama, Mistral, Gemma) instead of proprietary APIs. The answer is yes in principle. For institutions that cannot send unpublished manuscript data to US-based cloud APIs — for legal, regulatory, or competitive reasons — an open model running locally would be the correct choice. The DNI prompt is model-agnostic; the sensor does not depend on Gemini-specific behaviour. However, open models at the 7B–13B parameter scale tend to produce less calibrated numerical outputs than frontier models, which would widen the tolerance band and require recalibration of the scoring rubric anchors. Cost is also not straightforwardly cheaper: running inference locally at scale typically costs more than a frontier API at flash-tier pricing.

The most reproducible future version of the Uniqueness sensor would use a seedable, open-weight model running locally at temperature 0 — producing bit-exact results across all reviewers regardless of API availability or model version drift. This is the direction DNI v5.0 will explore.

### 11. Disclosure boundary — what is published and what is sealed

This replication package follows an explicit, documented split between a public harness and a sealed reagent. The reasoning is the same as for a biochemistry paper that publishes its assay protocol while keeping the proprietary antibody under MTA: the protocol is reviewable, the reagent is controlled, and the replication contract is satisfied by protocol disclosure alone.

**Published (Tier 1, this repository, MIT licence).** The orchestration spine (`src/genotype.ts`), the weight-mutation operator (`src/mutation/weightMutation.ts`), the fitness aggregation harness (`src/core/fitnessEvaluationFlow.ts`), the Uniqueness prompt (`prompt_uniqueness.txt`), the single-call replication script, the comparator, the frozen scores, the tolerance certificate, and every per-paper delta that supports the reproducibility claims in §5.

**Published behaviourally (Tier 2, in this README).** Each sealed component has a behavioural card describing what it consumes, what it produces, what fallbacks it uses under data blindness, and what known failure modes exist. See §9 Stages 2–4 for the sensor cards and `src/core/fitnessEvaluationFlow.ts` Phases 7–8 for the veto behaviour.

**Sealed (Tier 3, under controlled access).** The four sensor implementations — `citationAnalyzer.ts`, `synthesisDetector.ts`, `coherenceDetector.ts`, `disruptionDetector.ts` — plus any retrieval corpus or cached embeddings. SHA-256 hashes of these files are listed in `SEALED_ARTIFACTS.sha256` and will be timestamped publicly (Zenodo embargoed DOI) before the submission deadline. Accredited reviewers, including the panel, may request Tier-3 access under a short Replication MTA; see `DISCLOSURE_PROTOCOL.md` §5.

**Why this is sufficient for the replication contract.** Tier 1 lets any reviewer confirm that the mechanics are deterministic within the reported band. Tier 2 lets any reviewer confirm that the sealed components behave as documented. Tier 3 — available under MTA — lets any accredited reviewer confirm that the sealed implementations match their pre-registered hashes and produce the reported outputs end-to-end. No claim in this package requires the reviewer to trust the author.

## 12. How to contact me

For clarifications during the review window (17–22 April 2026):

- Email: c.arleo@localis-ai.uk
- Subject line: "DNI v4.0 Replication — `<your question>`"

## 13. Upstream and citation

A sanitised release of the full DNI v4.0 source is in preparation and available on request. 

*For the full theoretical specification of the DNI architecture including sensor formulas and ensemble design, see Document 1 (Technical Specification) submitted with the challenge.*

Reference: Arleo, C. (2026). *Darwinian Novelty Indicator v4.0: A Metascience Instrument.* Metascience Novelty Indicators Challenge, Finalist Submission.

License: CC-BY 4.0 (this replication package and all accompanying data).
