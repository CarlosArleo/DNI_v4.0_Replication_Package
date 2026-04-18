// FILE: functions/src/ai/flows/dni/detectors/disruptionDetector.ts
// VERSION: DNI-18.0 (PersonaBias Integration)

import { PaperData } from '../data/openAlexClient';
import { withCheapModel } from '../../../../utils/retryWrapper';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { wffLogger } from '../../../../utils/wffLogger';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '');

// [Keep all existing keyword arrays: RADICAL_KEYWORDS, BIO_METHOD_KEYWORDS, etc.]
const RADICAL_KEYWORDS = [
  'first observation', 'first detection', 'first measurement', 'first demonstration',
  'first evidence', 'first proof', 'first report', 'first discovery',
  'paradigm shift', 'breaks dogma', 'violates', 'contradicts established',
  'revolutionary', 'unprecedented', 'overturns', 'refutes', 'challenges paradigm',
  'unexpected', 'surprising', 'counterintuitive'
];

const BIO_METHOD_KEYWORDS = [
  'reprogramm', 'reprogram', 'pluripotent', 'induc', 'differentiat', 'transdifferentiat',
  'crispr', 'gene edit', 'gene therapy', 'cell therapy', 'immunotherapy',
  'organoid', 'stem cell', 'derive', 'derived',
  'we demonstrate generation', 'first demonstration'
];

const NOVEL_METHOD_KEYWORDS = [
  'novel method', 'new approach', 'new technique', 'innovative method',
  'introduce', 'develop', 'devise', 'propose', 'present',
  'framework', 'algorithm', 'pipeline', 'workflow'
];

const OPTIMIZATION_KEYWORDS = [
  'improve', 'enhance', 'optimize', 'refine', 'augment',
  'better', 'faster', 'more efficient', 'more accurate',
  'modification', 'adaptation', 'extension'
];

const APPLICATION_KEYWORDS = [
  'apply', 'application', 'use', 'implement', 'deploy',
  'case study', 'practical', 'real-world', 'in practice'
];

const MEASUREMENT_KEYWORDS = [
  'measure', 'measurement', 'observe', 'observation', 'detect',
  'characterize', 'analyze', 'assess', 'evaluate', 'quantify',
  'study', 'investigate', 'examine', 'survey'
];

function isTopBioJournal(doi: string): boolean {
  const doiLower = doi.toLowerCase();
  return (
    doiLower.includes('cell') ||
    doiLower.includes('nature.com/nm') ||
    doiLower.includes('nature.com/nbt') ||
    doiLower.includes('nature.com/ng') ||
    doiLower.includes('nature/nm') ||
    doiLower.includes('nature/nbt')
  );
}

function isTopJournal(doi: string): boolean {
  const doiLower = doi.toLowerCase();
  return (
    doiLower.includes('nature.com/nature') ||
    doiLower.includes('science.org') ||
    doiLower.includes('cell') ||
    doiLower.includes('pnas.org') ||
    doiLower.includes('nature.com/nm') ||
    doiLower.includes('nature.com/nbt') ||
    doiLower.includes('nature.com/ng')
  );
}

function countKeywordMatches(text: string, keywords: string[]): number {
  const textLower = text.toLowerCase();
  return keywords.filter(kw => textLower.includes(kw)).length;
}

function calculateHeuristicUniqueness(paper: PaperData): number {
  const doi = paper.doi ?? 'unknown';
  const title = paper.title ?? '';
  const abstract = paper.abstract ?? '';
  const fullText = `${title} ${abstract}`.toLowerCase();
  
  let score = 0.30;
  let reason = 'baseline';
  
  const radicalCount = countKeywordMatches(fullText, RADICAL_KEYWORDS);
  if (radicalCount >= 2) {
    score = 0.88;
    reason = `radical (${radicalCount} keywords)`;
  } else if (radicalCount === 1) {
    score = 0.82;
    reason = `radical (1 keyword)`;
  }
  else if (countKeywordMatches(fullText, BIO_METHOD_KEYWORDS) >= 2) {
    const isTop = isTopBioJournal(doi);
    score = isTop ? 0.85 : 0.78;
    reason = `bio method${isTop ? ' + top journal' : ''}`;
  }
  else if (countKeywordMatches(fullText, NOVEL_METHOD_KEYWORDS) >= 2) {
    const isTop = isTopJournal(doi);
    score = isTop ? 0.68 : 0.62;
    reason = `novel method${isTop ? ' + top journal' : ''}`;
  }
  else if (countKeywordMatches(fullText, OPTIMIZATION_KEYWORDS) >= 2) {
    score = 0.55;
    reason = 'optimization';
  }
  else if (countKeywordMatches(fullText, APPLICATION_KEYWORDS) >= 2) {
    score = 0.45;
    reason = 'application';
  }
  else if (countKeywordMatches(fullText, MEASUREMENT_KEYWORDS) >= 2) {
    score = 0.35;
    reason = 'measurement/observation';
  }
  
  if (score < 0.70 && isTopJournal(doi)) {
    const originalScore = score;
    score = Math.min(score + 0.10, 0.75);
    if (score > originalScore) {
      reason += ' + journal boost';
    }
  }
  
  wffLogger.info('DNI_UNIQUENESS_HEURISTIC', 
    `${doi}: ${score.toFixed(2)} (${reason})`);
  
  return score;
}

export const disruptionDetector = {
  calculate: async (
    paper: PaperData,
    vectorScore?: number,
    forceExpensive: boolean = false,
    personaBias?: string  // NEW PARAMETER
  ): Promise<number | null> => {
    
    const doi = paper.doi ?? 'unknown';
    const title = paper.title ?? '';
    const abstract = paper.abstract ?? '';

    let textToAnalyze = abstract;
    let source = 'Abstract';

    if (!abstract || abstract.length < 50) {
      if (title.length > 20) {
        textToAnalyze = title;
        source = 'Title Only';
        wffLogger.warn('DNI_UNIQUENESS_FALLBACK', `${doi}: Using Title for analysis`);
      } else {
        wffLogger.warn('DNI_UNIQUENESS_NULL', `${doi}: No text available`);
        return null;
      }
    }

    if (vectorScore !== undefined && vectorScore >= 0.80 && !forceExpensive) {
      wffLogger.info('DNI_UNIQUENESS_SKIP_LLM', 
        `${doi}: vectorScore=${vectorScore.toFixed(2)}, using heuristic (FREE)`);
      return calculateHeuristicUniqueness(paper);
    }

    wffLogger.info('DNI_UNIQUENESS_LLM_START', 
      `${doi}: vectorScore=${vectorScore?.toFixed(2) ?? 'N/A'}, running Gemini (PAID)`);

    try {
      const result = await withCheapModel(
        async (modelName) => {
          const model = genAI.getGenerativeModel({ model: modelName });

          // INJECT PERSONA BIAS INTO PROMPT
          const biasInstruction = personaBias 
            ? `\n\nIMPORTANT CONTEXT:\n${personaBias}\n`
            : '';

          const prompt = `
Analyze this scientific text (${source}) and classify its "Uniqueness" score (0.0 to 1.0).
${biasInstruction}
Text: "${textToAnalyze.substring(0, 1500)}"

SCORING RUBRIC (Use the full decimal range, e.g., 0.62, 0.88):
- 0.10 - 0.39: Incremental (Standard data, standard method).
- 0.40 - 0.69: Substantial (New application or significant optimization).
- 0.70 - 0.84: Breakthrough (Major problem solved, order-of-magnitude improvement).
- 0.85 - 0.95: Paradigm Shift (Violates dogma, transformative method like CRISPR/PCR).

DO NOT return round numbers like 0.7 or 0.4 unless the paper exactly fits the baseline. 
Be precise. Return ONLY the number.
          `.trim();

          return await model.generateContent(prompt);
        },
        'DNI_UNIQUENESS'
      );

      const responseText = result.response.text().trim();
      wffLogger.debug('DNI_UNIQUENESS_GEMINI_RESPONSE', `${doi}: "${responseText}"`);
      let score = parseFloat(responseText);

      if (isNaN(score) || score < 0 || score > 1) {
        wffLogger.warn('DNI_UNIQUENESS_INVALID', 
          `${doi}: Invalid Gemini response "${responseText}", using heuristic fallback`);
        return calculateHeuristicUniqueness(paper);
      }

      wffLogger.info('DNI_UNIQUENESS_GEMINI_RAW', `${doi}: Raw = ${score.toFixed(2)}`);

      const originalScore = score;
      const titleLower = title.toLowerCase();
      
      if (
        titleLower.startsWith('observation of') ||
        titleLower.startsWith('measurement of') ||
        titleLower.startsWith('study of')
      ) {
        score = Math.min(score, 0.75);
        if (score < originalScore) {
          wffLogger.info('DNI_UNIQUENESS_DAMPER', 
            `${doi}: Normal science cap → ${score.toFixed(2)}`);
        }
      }

      if (score <= 0.5) {
        const isBioMethod = countKeywordMatches(`${title} ${abstract}`, BIO_METHOD_KEYWORDS) >= 1;
        const isTopJournal = isTopBioJournal(doi);

        if (isBioMethod && isTopJournal) {
          const boostedScore = Math.max(score, 0.85);
          if (boostedScore > score) {
            wffLogger.info('DNI_UNIQUENESS_BIO_BOOST', 
              `${doi}: Bio method detected → ${boostedScore.toFixed(2)}`);
            score = boostedScore;
          }
        }
      }

      wffLogger.info('DNI_UNIQUENESS_FINAL', `${doi}: Final = ${score.toFixed(2)}`);
      return score;

    } catch (error: any) {
      wffLogger.error('DNI_UNIQUENESS_API_ERROR', `${doi}: Gemini failed, using heuristic`, error);
      return calculateHeuristicUniqueness(paper);
    }
  },
};