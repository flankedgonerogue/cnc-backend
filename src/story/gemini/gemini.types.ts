export const INIT_RESPONSE_SCHEMA = {
  type: 'object' as const,
  properties: {
    node_text: { type: 'string' as const },
    visual_style: { type: 'string' as const },
    character_anchor: { type: 'string' as const },
    visual_context: { type: 'string' as const },
    choices: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          choice_text: { type: 'string' as const },
          behavior_type: {
            type: 'string' as const,
            enum: ['Positive', 'Negative'],
          },
        },
        required: ['choice_text', 'behavior_type'],
      },
    },
  },
  required: [
    'node_text',
    'visual_style',
    'character_anchor',
    'visual_context',
    'choices',
  ],
};

export const CONTINUE_RESPONSE_SCHEMA = {
  type: 'object' as const,
  properties: {
    node_text: { type: 'string' as const },
    visual_context: { type: 'string' as const },
    is_ending: { type: 'boolean' as const },
    choices: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          choice_text: { type: 'string' as const },
          behavior_type: {
            type: 'string' as const,
            enum: ['Positive', 'Negative'],
          },
        },
        required: ['choice_text', 'behavior_type'],
      },
    },
  },
  required: ['node_text', 'visual_context', 'is_ending', 'choices'],
};

export const CSE_RESPONSE_SCHEMA = {
  type: 'object' as const,
  properties: {
    confidence_score: { type: 'number' as const },
    safety_status: {
      type: 'string' as const,
      enum: ['SAFE', 'UNSAFE', 'REVIEW_REQUIRED'],
    },
    flagged_issues: {
      type: 'array' as const,
      items: { type: 'string' as const },
    },
    reasoning: { type: 'string' as const },
    suggested_fix: { type: 'string' as const },
  },
  required: [
    'confidence_score',
    'safety_status',
    'flagged_issues',
    'reasoning',
    'suggested_fix',
  ],
};
