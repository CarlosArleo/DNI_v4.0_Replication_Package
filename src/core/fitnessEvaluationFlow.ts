// src/core/fitnessEvaluationFlow.ts
// DNI v4.0 — per-judge fitness aggregation (the "harness")
//
// Reference file shipped with the replication package. This is the production
// TypeScript that orchestrates a single Socratic-judge scoring pass: it calls
// the four-sensor genotype (see src/genotype.ts), aggregates the dimensional
// scores under the published (U × 0.60) + (T × 0.30) + (S × 0.10) formula,
// and applies the Coherence veto and the Retraction veto. External imports
// below (wffLogger, DNIContext, etc.) reference the full DNI v4.0 source tree
// and are not resolvable against the minimal replication package. The four
// sensor implementations that produce the inputs (citationAnalyzer,
// synthesisDetector, coherenceDetector, disruptionDetector) are held as
// Tier-3 sealed artefacts — see DISCLOSURE_PROTOCOL.md. This file and
// src/genotype.ts and src/mutation/weightMutation.ts together document the
// full harness without exposing the sealed sensor specifications.
//
// This file is provided READ-ONLY as the fitness aggregation contract of
// the indicator, so that a reviewer can verify that:
//   - the scoring formula matches README §9 Stage 4 and the §1 equation
//   - Coherence is a veto (capped to 0.5 when Novelty > 0.75 and Coh < 0.40)
//     and is NOT included as a weighted term in the composite score
//   - retracted papers are forced to 0.0 independently of any sensor output
//   - error fallbacks return a neutral 0.5, not 0.0, so that downstream
//     averaging is not biased downward by partial failures

// FILE: functions/src/ai/flows/dni/core/fitnessEvaluationFlow.ts
// VERSION: DNI-30.0 (Red Team Compliant: Normalized Weight Handling)
// AUDIT: Handles both legacy and new weight formats
// CHANGES:
//   - Added weight normalization for backward compatibility
//   - Changed fallback score from 0.0001 to 0.5 (neutral)
//   - Added defensive checks for missing weights
//   - Improved logging for debugging
//   - Coherence veto now more lenient (threshold 0.4 instead of 0.5)

'use server';

import { defineFlow } from '@genkit-ai/flow';
import { z } from 'zod';
import { wffLogger } from '../../../../utils/wffLogger';
import { getDNIGenotype } from './genotype';
import { DNIWeights } from './types';
import { normalizeInputWeights, validateWeights } from '../mutation/weightMutation';

// ============================================================================
// PRODUCTION CONFIGURATION
// ============================================================================
const CHALLENGE_MODE = true;  // Always run expensive LLM analysis
const SNIPER_THRESHOLD = 0.35; // Trigger LLM if preliminary score > 0.35

const FITNESS = {
  DEFAULT: 0.5000,            // Neutral score when calculation fails
  VIABLE: 0.5500,             // Threshold for "viable" classification
  COHERENCE_THRESHOLD: 0.4000 // Lower threshold (was 0.5) - less aggressive veto
};

// ============================================================================
// UTILITY: Safe Weight Access
// ============================================================================
/**
 * Safely extracts weights from frame, handling both legacy and new formats
 * Returns normalized DNI-23.0 weights
 */
function getFrameWeights(frame: any): DNIWeights {
  const rawWeights = frame.metadata?.weights;

  if (!rawWeights) {
    wffLogger.warn('DNI_WEIGHT_MISSING',
      `${frame.frame_id}: No weights found, using defaults`
    );
    return {
      uniqueness: 0.6,
      tension: 0.3,
      synthesis: 0.1,
      coherence: 0.0
    };
  }

  // Normalize to DNI-23.0 format (handles legacy keys)
  const normalized = normalizeInputWeights(rawWeights);

  // Validate
  const error = validateWeights(normalized);
  if (error) {
    wffLogger.warn('DNI_WEIGHT_INVALID',
      `${frame.frame_id}: ${error}. Using defaults.`
    );
    return {
      uniqueness: 0.6,
      tension: 0.3,
      synthesis: 0.1,
      coherence: 0.0
    };
  }

  return normalized;
}

// ============================================================================
// MAIN FITNESS EVALUATION FLOW
// ============================================================================
export const fitnessEvaluationFlow = defineFlow(
  {
    name: 'fitnessEvaluationFlow_v30',
    inputSchema: z.object({
      frame: z.any(),
      context: z.any(),
      current_generation: z.number().default(1),
    }),
    outputSchema: z.any(),
  },
  async ({ frame, context, current_generation }) => {
    const shortDoi = frame.frame_id.split('/').pop()?.substring(0, 15) ?? 'unknown';

    wffLogger.info(
      'DNI_FITNESS_START',
      `Evaluating: ${shortDoi} (Gen ${current_generation}) [Mode: 🎯 SNIPER]`
    );

    try {
      // ======================================================================
      // PHASE 1: GET SENSORS
      // ======================================================================
      const genotype = getDNIGenotype(context, CHALLENGE_MODE);
      const scores: Partial<Record<keyof DNIWeights, number | null>> = {};
      let usedExpensiveLLM = false;

      // ======================================================================
      // PHASE 2: RUN FREE SENSORS (Tension, Synthesis, Coherence)
      // ======================================================================
      // These are fast, non-LLM sensors (indices 0-2)
      for (const sensor of genotype.slice(0, 3)) {
        const dimension = sensor.dimension as keyof DNIWeights;
        const score = await sensor.evaluate_fitness(frame);
        scores[dimension] = score;

        if (score === null) {
          wffLogger.warn('DNI_SENSOR_NULL',
            `${shortDoi}: ${sensor.name} sensor returned null`
          );
        }
      }

      // ======================================================================
      // PHASE 3: GET NORMALIZED WEIGHTS
      // ======================================================================
      const weights = getFrameWeights(frame);

      wffLogger.debug('DNI_WEIGHTS',
        `${shortDoi}: U:${weights.uniqueness.toFixed(3)} ` +
        `T:${weights.tension.toFixed(3)} ` +
        `S:${weights.synthesis.toFixed(3)}`
      );

      // ======================================================================
      // PHASE 4: PRELIMINARY SCORE (Decide if LLM is needed)
      // ======================================================================
      // Calculate a quick score using just synthesis + coherence
      // This helps us decide if the paper is worth expensive LLM analysis
      const synthesis = scores.synthesis ?? 0;
      const coherence = scores.coherence ?? 0;

      const prelimWeightSum = weights.synthesis + weights.coherence;
      const preliminaryVectorScore = prelimWeightSum > 0
        ? ((synthesis * weights.synthesis) + (coherence * weights.coherence)) / prelimWeightSum
        : FITNESS.DEFAULT;

      wffLogger.debug('DNI_PRELIM_SCORE',
        `${shortDoi}: Preliminary=${preliminaryVectorScore.toFixed(3)} (threshold=${SNIPER_THRESHOLD})`
      );

      // ======================================================================
      // PHASE 5: CONDITIONAL LLM (The Socratic Sniper)
      // ======================================================================
      // Trigger expensive LLM analysis if:
      // 1. Preliminary score looks promising (> 0.35), OR
      // 2. We're in Generation 2 (deep Socratic adjudication)
      const shouldRunLLM = CHALLENGE_MODE &&
                          (preliminaryVectorScore > SNIPER_THRESHOLD ||
                           current_generation > 1);

      if (shouldRunLLM) {
        wffLogger.info('DNI_LLM_TRIGGER',
          `${shortDoi}: Triggering LLM (prelim=${preliminaryVectorScore.toFixed(3)}, gen=${current_generation})`
        );
      }

      // Generate persona bias for this specific judge
      const personaBias = `
        Your current evaluation priority profile is:
        Uniqueness/Innovation: ${Math.round(weights.uniqueness * 100)}%,
        Structural Tension/Disruption: ${Math.round(weights.tension * 100)}%.
        Adjust your sensitivity to these specific dimensions accordingly.
      `.trim();

      // Run Uniqueness Sensor (expensive LLM, index 3)
      for (const sensor of genotype.slice(3)) {
        const dimension = sensor.dimension as keyof DNIWeights;
        // Pass vectorScore=1.1 to force LLM, or 0.0 to skip
        const score = await sensor.evaluate_fitness(
          frame,
          shouldRunLLM ? 1.1 : 0.0,
          personaBias
        );
        scores[dimension] = score;

        if (shouldRunLLM && score !== null) {
          usedExpensiveLLM = true;
        }
      }

      // ======================================================================
      // PHASE 6: CALCULATE FINAL WEIGHTED SCORE
      // ======================================================================
      // Formula: (U × 0.6) + (T × 0.3) + (S × 0.1)
      // Note: Coherence is NOT included in final score (veto only)

      let finalWeightedSum = 0;
      let finalWeightTotal = 0;

      const activeDims: (keyof DNIWeights)[] = ['uniqueness', 'tension', 'synthesis'];

      for (const dim of activeDims) {
        const score = scores[dim];
        const weight = weights[dim] ?? 0;  // ✅ Added ?? 0 here

        if (score !== null && score !== undefined && weight > 0) {
          finalWeightedSum += score * weight;
          finalWeightTotal += weight;

          wffLogger.debug('DNI_WEIGHT_CALC',
            `${shortDoi}: ${dim}=${score.toFixed(3)} × ${weight.toFixed(3)} = ${(score * weight).toFixed(3)}`
          );
        } else if (score === null) {
          wffLogger.warn('DNI_DIMENSION_NULL',
            `${shortDoi}: ${dim} score is null, skipping in calculation`
          );
        }
      }

      // Calculate final score
      let finalScore = finalWeightTotal > 0
        ? finalWeightedSum / finalWeightTotal
        : FITNESS.DEFAULT;

      wffLogger.debug('DNI_SCORE_RAW',
        `${shortDoi}: Raw score = ${finalWeightedSum.toFixed(4)} / ${finalWeightTotal.toFixed(4)} = ${finalScore.toFixed(4)}`
      );

      // ======================================================================
      // PHASE 7: COHERENCE VETO
      // ======================================================================
      // If paper scores high on novelty but has incoherent logic, cap the score
      // This prevents "word salad" papers from getting high scores
      const coherenceScore = scores.coherence ?? 0;

      if (finalScore > 0.75 && coherenceScore < FITNESS.COHERENCE_THRESHOLD) {
        wffLogger.warn('DNI_VETO_COHERENCE',
          `${shortDoi}: High novelty (${finalScore.toFixed(3)}) vetoed due to low coherence (${coherenceScore.toFixed(3)}). Capping to 0.50.`
        );
        finalScore = 0.5000;
      }

      // ======================================================================
      // PHASE 8: RETRACTION VETO
      // ======================================================================
      // Retracted papers always get score of 0
      if (frame.metadata?.is_retracted) {
        wffLogger.warn('DNI_VETO_RETRACTION',
          `${shortDoi}: Retracted paper. Setting score to 0.0000.`
        );
        finalScore = 0.0000;
      }

      // ======================================================================
      // PHASE 9: CLAMP TO VALID RANGE
      // ======================================================================
      finalScore = Math.max(0, Math.min(1, finalScore));

      // ======================================================================
      // PHASE 10: PREPARE OUTPUT
      // ======================================================================
      const pathwayUsed = usedExpensiveLLM
        ? 'Socratic Adjudication'
        : 'Heuristic Consensus';

      wffLogger.info('DNI_FITNESS_FINAL',
        `${shortDoi}: [${pathwayUsed}] Final=${finalScore.toFixed(4)} ` +
        `(U:${(scores.uniqueness ?? 0).toFixed(2)} ` +
        `T:${(scores.tension ?? 0).toFixed(2)} ` +
        `S:${(scores.synthesis ?? 0).toFixed(2)} ` +
        `C:${coherenceScore.toFixed(2)})`
      );

      frame.fitness = {
        overall_fitness: finalScore,
        dimensional_scores: scores,
        is_viable: finalScore >= FITNESS.VIABLE,
        pathway: pathwayUsed,
        processing: {
          usedExpensiveLLM,
          current_generation,
          preliminaryVectorScore,
          weightTotal: finalWeightTotal
        }
      };

      return frame;

    } catch (error: any) {
      // ======================================================================
      // ERROR HANDLING: Return neutral fallback score
      // ======================================================================
      wffLogger.error('DNI_FITNESS_FATAL',
        `${shortDoi}: Fatal error during fitness evaluation: ${error.message}`
      );

      // Changed from 0.0001 to 0.5 (neutral) to avoid biasing mean downward
      frame.fitness = {
        overall_fitness: 0.5000,  // ✅ Neutral fallback
        dimensional_scores: {
          uniqueness: 0.5,
          tension: 0.3,
          synthesis: 0.5,
          coherence: 0.8
        },
        is_viable: false,
        pathway: 'Error Fallback',
        error: error.message
      };

      return frame;
    }
  }
);
