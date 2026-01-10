export class ChoiceDto {
  choice_text: string;
  behavior_type: string;
}

export class SessionNodeResponseDto {
  sessionId: string;
  nodeId: string;
  node_text: string;
  image_url?: string;
  is_ending: boolean;
  choices: ChoiceDto[];
}

export class InitializeSessionResponseDto extends SessionNodeResponseDto {
  visual_style: string;
  character_anchor: string;
}
