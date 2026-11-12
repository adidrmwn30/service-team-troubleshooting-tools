export const DECISION_THRESHOLDS = {
  SCORE_POTENTIALLY_READY_MIN: 8,
  SCORE_POTENTIALLY_READY_MAX: 10,
  SCORE_CONTINUE_L2_MIN: 4,
  SCORE_CONTINUE_L2_MAX: 7,
  SCORE_INSUFFICIENT_MAX: 3,

  // Criteria for customer-ready communication
  MIN_VERIFIED_FINDINGS: 1,
  ALLOW_HYPOTHESIS_AS_ROOT_CAUSE: false,
};

export type ScoreCategory = 'INSUFFICIENT' | 'CONTINUE_L2' | 'POTENTIALLY_READY';

export function categorizeEvidenceScore(score: number): ScoreCategory {
  if (score >= DECISION_THRESHOLDS.SCORE_POTENTIALLY_READY_MIN) {
    return 'POTENTIALLY_READY';
  }
  if (score >= DECISION_THRESHOLDS.SCORE_CONTINUE_L2_MIN) {
    return 'CONTINUE_L2';
  }
  return 'INSUFFICIENT';
}
