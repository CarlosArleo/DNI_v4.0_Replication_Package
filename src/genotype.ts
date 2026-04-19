// FILE: functions/src/ai/flows/dni/core/genotype.ts
// VERSION: DNI-27.3 (Type-Safe Production - 100K SCALE)
// AUDIT: Resolves TS2345 (openAlexId mismatch). Red-Team Hardened.

'use server';

import { PaperFrame, DNIContext, DNIWeights } from './types';
import { wffLogger } from '../../../../utils/wffLogger';

import { citationAnalyzer } from '../detectors/citationAnalyzer';
import { synthesisDetector } from '../detectors/synthesisDetector';
import { coherenceDetector } from '../detectors/coherenceDetector';
import { disruptionDetector } from '../detectors/disruptionDetector';

export interface DNIPressure {
  name: string;
  dimension: keyof DNIWeights;
  evaluate_fitness(frame: PaperFrame, vectorScore?: number, personaBias?: string): Promise<number | null>;
}

/* ---------------- FREE SENSORS (Always Run - No API Cost) ---------------- */

class TensionSensor implements DNIPressure {
  name = 'Tension';
  dimension: keyof DNIWeights = 'tension';

  constructor(private challengeMode: boolean = false) {}

  async evaluate_fitness(frame: PaperFrame): Promise<number | null> {
    // RED TEAM FIX: Data Blindness Telemetry
    if (frame.metadata.citation_count === 0) {
        wffLogger.warn('DNI_DATA_BLINDNESS', `${frame.frame_id}: No citations. Tension sensor using cold-start fallback.`);
    }

    try {
      return await citationAnalyzer.calculate({
        ...frame.metadata,
        openAlexId: frame.metadata.openAlexId ?? '', // FIX: Explicit string fallback
        title: frame.name,
        abstract: frame.slots.abstract.value,
        publication_year: frame.slots.year.value,
        referenced_works: frame.slots.citations.value
      }, this.challengeMode);
    } catch (e) {
      wffLogger.error('DNI_SENSOR_FAIL', 'Tension sensor failed', e);
      return null;
    }
  }
}

class SynthesisSensor implements DNIPressure {
  name = 'Synthesis';
  dimension: keyof DNIWeights = 'synthesis';

  async evaluate_fitness(frame: PaperFrame): Promise<number | null> {
    const embedding = frame.metadata.embedding_vector;

    // RED TEAM FIX: Data Blindness Telemetry
    if (!frame.metadata.hasEmbedding || !embedding || embedding.length === 0) {
      wffLogger.warn('DNI_DATA_BLINDNESS', `${frame.frame_id}: No embedding. Synthesis sensor using Entropy fallback.`);
    }

    try {
      return await synthesisDetector.calculate(
        {
          ...frame.metadata,
          openAlexId: frame.metadata.openAlexId ?? '', // FIX: Explicit string fallback
          title: frame.name,
          abstract: frame.slots.abstract.value,
          publication_year: frame.slots.year.value,
          referenced_works: frame.slots.citations.value
        },
        embedding
      );
    } catch (e) {
      wffLogger.error('DNI_SENSOR_FAIL', 'Synthesis sensor failed', e);
      return null;
    }
  }
}

class CoherenceSensor implements DNIPressure {
  name = 'Coherence';
  dimension: keyof DNIWeights = 'coherence';

  async evaluate_fitness(frame: PaperFrame): Promise<number | null> {
    try {
      return await coherenceDetector.calculate({
        ...frame.metadata,
        openAlexId: frame.metadata.openAlexId ?? '', // FIX: Explicit string fallback
        title: frame.name,
        abstract: frame.slots.abstract.value,
        publication_year: frame.slots.year.value,
        referenced_works: []
      });
    } catch (e) {
      wffLogger.error('DNI_SENSOR_FAIL', 'Coherence sensor failed', e);
      return null;
    }
  }
}

/* ---------------- EXPENSIVE SENSORS (Conditional - API Cost) ---------------- */

class UniquenessSensor implements DNIPressure {
  name = 'Uniqueness';
  dimension: keyof DNIWeights = 'uniqueness';

  constructor(private challengeMode: boolean = false) {}

  async evaluate_fitness(frame: PaperFrame, vectorScore?: number, personaBias?: string): Promise<number | null> {
    // RED TEAM FIX: Data Blindness Telemetry
    if (!frame.metadata.hasAbstract) {
        wffLogger.warn('DNI_DATA_BLINDNESS', `${frame.frame_id}: Missing abstract. Uniqueness sensor using Concept Proxy.`);
    }

    try {
      const shortDoi = frame.frame_id.split('/').pop()?.substring(0, 15) || 'unknown';

      if (this.challengeMode) {
         wffLogger.info('DNI_UNIQUENESS_FORCE', `${shortDoi}: Challenge Mode active. Forcing LLM analysis.`);
      }

      return await disruptionDetector.calculate(
        {
          ...frame.metadata,
          openAlexId: frame.metadata.openAlexId ?? '', // FIX: Explicit string fallback
          title: frame.name,
          abstract: frame.slots.abstract.value,
          publication_year: frame.slots.year.value,
          referenced_works: []
        },
        vectorScore,
        this.challengeMode,
        personaBias
      );
    } catch (e) {
      wffLogger.error('DNI_SENSOR_FAIL', 'Uniqueness sensor failed', e);
      return null;
    }
  }
}

/**
 * getDNIGenotype: Returns the active sensor array for the Socratic Loop.
 */
export function getDNIGenotype(_ctx: DNIContext, challengeMode: boolean = false): DNIPressure[] {
  return [
    new TensionSensor(challengeMode),
    new SynthesisSensor(),
    new CoherenceSensor(),
    new UniquenessSensor(challengeMode)
  ];
}