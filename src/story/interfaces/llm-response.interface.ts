export interface LlmChoice {
  choice_text: string;
  behavior_type: 'Positive' | 'Negative';
}

export interface InitLlmResponse {
  node_text: string;
  visual_style: string;
  character_anchor: string;
  visual_context: string;
  choices: LlmChoice[];
}

export interface ContinueLlmResponse {
  node_text: string;
  visual_context: string;
  is_ending: boolean;
  choices: LlmChoice[];
}

export interface CseResponse {
  confidence_score: number;
  safety_status: 'SAFE' | 'UNSAFE' | 'REVIEW_REQUIRED';
  flagged_issues: string[];
  reasoning: string;
  suggested_fix: string;
}
