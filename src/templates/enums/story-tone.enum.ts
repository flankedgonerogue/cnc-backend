import { registerEnumType } from '@nestjs/graphql';

export enum StoryTone {
  CALM = 'CALM',
  ENCOURAGING = 'ENCOURAGING',
  PLAYFUL = 'PLAYFUL',
  EMPATHETIC = 'EMPATHETIC',
  NEUTRAL = 'NEUTRAL',
}

registerEnumType(StoryTone, {
  name: 'StoryTone',
});
