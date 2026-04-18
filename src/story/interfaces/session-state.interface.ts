export interface SessionState {
  sessionId: string;
  childProfileId: string;
  templateId: string;
  turnCount: number;
  targetBehavior: string;
  storySetting: string;
  mainCharacter: string;
  childAge: number;
  lastNodeText: string;
  visualStyle: string;
  characterAnchor: string;
  lastGeneratedImageUrl: string;
  lastChoiceBehaviorTag?: string | null;
  /** Consecutive Positive choices ending at the last recorded interaction (for streak cap). */
  positiveChoiceStreak?: number;
  /** Rolling counts in this session for prefetch priority (updated on each choice). */
  sessionPositiveTally?: number;
  sessionNegativeTally?: number;
  /** Last K interactions across all sessions for this child; null if unknown. */
  childCrossSessionPositiveRatio?: number | null;
}
