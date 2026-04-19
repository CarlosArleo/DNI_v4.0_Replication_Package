// src/mutation/weightMutation.ts
// DNI v4.0 — Darwinian weight mutation (the "selection pressure")
//
// Reference file shipped with the replication package. This is the production
// TypeScript that mutates dimension weights for the Socratic ensemble: each
// of the 5-10 judge instances receives a uniquely mutated weight vector
// produced by this function. It is the code behind §5's "Monte-Carlo weight
// mutation (volatility 0.25 / 0.35)" and the FBPR claim that ensemble
// variation is "structured variation within a principled frame." Coherence
// is hard-pinned to 0.0 because it is a veto filter, not a weighted score
// contributor. External imports below (wffLogger, DNIWeights) reference the
// full DNI v4.0 source tree and are not resolvable against the minimal
// replication package. A sanitised release of the full tree is in
// preparation and available on request.

// FILE: functions/src/ai/flows/dni/mutation/weightMutation.ts
// VERSION: DNI-30.0 (Red Team Compliant: Normalized Weight Mutation)
// AUDIT: Ensures mutated weights always sum to 1.0 and use DNI-23.0 format
// CHANGES:
//   - Handles both legacy and new weight formats
//   - Normalizes weights to sum to 1.0 after mutation
//   - Returns only DNI-23.0 format (no legacy keys)
//   - Adds bounds checking and validation
//   - Coherence always stays at 0.0 (veto only)

'use server';

import { DNIWeights } from '../core/types';
import { wffLogger } from '../../../../utils/wffLogger';

// ============================================================================
// CONSTANTS
// ============================================================================
const MIN_WEIGHT = 0.02;  // Prevent weights from becoming too small
const MAX_WEIGHT = 0.98;  // Prevent weights from becoming too large

// ============================================================================
// UTILITY: Normalize Legacy Weights
// ============================================================================
/**
 * Converts legacy weight format to DNI-23.0 format
 * Handles both old and new formats gracefully
 */
export function normalizeInputWeights(weights: DNIWeights): DNIWeights {
  return {
    uniqueness: weights.uniqueness ?? weights.uniqueness_facet ?? 0.6,
    tension: weights.tension ?? weights.tension_rdi ?? 0.3,
    synthesis: weights.synthesis ?? weights.synthesis_embedding ?? 0.1,
    coherence: 0.0  // Always 0 in DNI-23.0 (veto filter, not weighted)
  };
}

// ============================================================================
// UTILITY: Ensure Weights Sum to 1.0
// ============================================================================
/**
 * Normalizes weights so uniqueness + tension + synthesis = 1.0
 * Coherence is excluded from this calculation (always 0)
 */
export function normalizeWeightsToOne(weights: DNIWeights): DNIWeights {
  const sum = weights.uniqueness + weights.tension + weights.synthesis;

  if (sum === 0) {
    // Fallback to default weights if all are zero
    wffLogger.warn('DNI_WEIGHT_ZERO', 'All weights were zero, using defaults');
    return {
      uniqueness: 0.6,
      tension: 0.3,
      synthesis: 0.1,
      coherence: 0.0
    };
  }

  return {
    uniqueness: weights.uniqueness / sum,
    tension: weights.tension / sum,
    synthesis: weights.synthesis / sum,
    coherence: 0.0  // Never mutate coherence
  };
}

// ============================================================================
// MAIN MUTATION FUNCTION
// ============================================================================
/**
 * Mutates DNI weights with controlled randomness
 *
 * @param baseWeights - Input weights (accepts both legacy and new formats)
 * @param volatility - Mutation strength (0-1 scale)
 *   - 0.25 = Moderate diversity (Gen 1)
 *   - 0.35 = High diversity (Gen 2 Socratic Panel)
 *
 * @returns Mutated weights in DNI-23.0 format, normalized to sum to 1.0
 *
 * Algorithm:
 * 1. Normalize input (handle legacy formats)
 * 2. Apply random perturbations to each weight
 * 3. Clamp to valid range [MIN_WEIGHT, MAX_WEIGHT]
 * 4. Normalize so uniqueness + tension + synthesis = 1.0
 */
export function mutateWeights(
  baseWeights: DNIWeights,
  volatility: number
): DNIWeights {
  // ========================================================================
  // PHASE 1: NORMALIZE INPUT
  // ========================================================================
  const normalized = normalizeInputWeights(baseWeights);

  // ========================================================================
  // PHASE 2: APPLY MUTATIONS
  // ========================================================================
  // Use centered random perturbation: (Math.random() - 0.5) gives range [-0.5, +0.5]
  // Multiply by volatility to control strength
  const mutated: DNIWeights = {
    uniqueness: normalized.uniqueness + (Math.random() - 0.5) * volatility,
    tension: normalized.tension + (Math.random() - 0.5) * volatility,
    synthesis: normalized.synthesis + (Math.random() - 0.5) * volatility,
    coherence: 0.0  // Never mutate coherence (veto filter only)
  };

  // ========================================================================
  // PHASE 3: CLAMP TO VALID RANGE
  // ========================================================================
  // Prevent weights from becoming too extreme
  mutated.uniqueness = Math.max(MIN_WEIGHT, Math.min(MAX_WEIGHT, mutated.uniqueness));
  mutated.tension = Math.max(MIN_WEIGHT, Math.min(MAX_WEIGHT, mutated.tension));
  mutated.synthesis = Math.max(MIN_WEIGHT, Math.min(MAX_WEIGHT, mutated.synthesis));

  // ========================================================================
  // PHASE 4: NORMALIZE TO SUM = 1.0
  // ========================================================================
  const final = normalizeWeightsToOne(mutated);

  // ========================================================================
  // PHASE 5: VALIDATION (Debug Logging)
  // ========================================================================
  const sum = final.uniqueness + final.tension + final.synthesis;
  if (Math.abs(sum - 1.0) > 0.001) {
    wffLogger.error('DNI_WEIGHT_INVALID',
      `Weight sum is ${sum.toFixed(4)}, expected 1.0000`
    );
  }

  // Per-mutation weight trace (for audit / replication)
  wffLogger.debug('DNI_WEIGHT_MUTATION',
    `U=${final.uniqueness.toFixed(3)} T=${final.tension.toFixed(3)} S=${final.synthesis.toFixed(3)} (vol=${volatility})`
  );

  return final;
}

// ============================================================================
// UTILITY: Create Default Weights
// ============================================================================
/**
 * Returns official DNI-23.0 default weights
 * Use this as a starting point when no weights are available
 */
export function getDefaultWeights(): DNIWeights {
  return {
    uniqueness: 0.6000,
    tension: 0.3000,
    synthesis: 0.1000,
    coherence: 0.0000
  };
}

// ============================================================================
// UTILITY: Validate Weights
// ============================================================================
/**
 * Checks if weights are valid DNI-23.0 format
 * Returns error message if invalid, null if valid
 */
export function validateWeights(weights: DNIWeights): string | null {
  // Check required fields exist
  if (weights.uniqueness === undefined ||
      weights.tension === undefined ||
      weights.synthesis === undefined) {
    return 'Missing required weight fields (uniqueness, tension, synthesis)';
  }

  // Check coherence is 0
  if (weights.coherence !== 0.0) {
    return `Coherence must be 0.0 in DNI-23.0, got ${weights.coherence}`;
  }

  // Check all weights are in valid range
  if (weights.uniqueness < 0 || weights.uniqueness > 1 ||
      weights.tension < 0 || weights.tension > 1 ||
      weights.synthesis < 0 || weights.synthesis > 1) {
    return 'Weights must be in range [0, 1]';
  }

  // Check sum equals 1.0 (with small tolerance for floating point)
  const sum = weights.uniqueness + weights.tension + weights.synthesis;
  if (Math.abs(sum - 1.0) > 0.01) {
    return `Weights must sum to 1.0, got ${sum.toFixed(4)}`;
  }

  return null;  // Valid
}