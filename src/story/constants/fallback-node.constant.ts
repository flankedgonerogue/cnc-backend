import type {
  InitLlmResponse,
  ContinueLlmResponse,
} from '../interfaces/llm-response.interface';

export const FALLBACK_INIT_RESPONSE: InitLlmResponse = {
  node_text:
    'Our friend is getting ready for a new adventure! The sun is shining and it is a beautiful day. What should we do first?',
  visual_style:
    '3D animated movie style, disney-pixar aesthetic, soft rounded shapes, bright vibrant colors, warm studio lighting, cute proportions',
  character_anchor: 'friendly cartoon character, bright colors, warm smile',
  visual_context:
    '3D animated movie style, friendly cartoon character standing in a sunny meadow, bright colors, warm lighting, cheerful atmosphere',
  choices: [
    { choice_text: 'Say hello to a friend', behavior_type: 'Positive' },
    { choice_text: 'Look around quietly', behavior_type: 'Neutral/Negative' },
  ],
};

export const FALLBACK_CONTINUE_RESPONSE: ContinueLlmResponse = {
  node_text:
    'Our friend takes a moment to think. The world around them is calm and peaceful. What would they like to do next?',
  visual_context:
    'Same scene, character standing calmly, peaceful expression, soft lighting',
  is_ending: false,
  choices: [
    { choice_text: 'Try something kind', behavior_type: 'Positive' },
    { choice_text: 'Wait and watch', behavior_type: 'Neutral/Negative' },
  ],
};
