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
  lastChoiceBehaviorTag?: string | null; // Track previous choice for back-to-back positive check
}
