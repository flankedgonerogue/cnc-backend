import { Injectable } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';

@Injectable()
export class PromptsService {
  private initPrompt: string;
  private contPrompt: string;

  constructor() {
    // Load prompts at service initialization
    const promptsDir = join(__dirname, '.');
    this.initPrompt = readFileSync(
      join(promptsDir, 'system-prompt-init.xml'),
      'utf-8',
    );
    this.contPrompt = readFileSync(
      join(promptsDir, 'system-prompt-cont.xml'),
      'utf-8',
    );
  }

  getInitializationPrompt(): string {
    return this.initPrompt;
  }

  getContinuationPrompt(): string {
    return this.contPrompt;
  }

  /**
   * Build user message for initialization (Node 0)
   */
  buildInitUserMessage(config: {
    childName: string;
    childAge: number;
    targetBehavior: string;
    characterName: string;
    setting: string;
    emotionalTone: string;
  }): string {
    return `
INITIALIZE SESSION:
- Child_Name: ${config.childName}
- Child_Age: ${config.childAge}
- Target_Behavior: ${config.targetBehavior}
- Main_Character: ${config.characterName}
- Setting: ${config.setting}
- Emotional_Tone: ${config.emotionalTone}
    `.trim();
  }

  /**
   * Build user message for continuation (Node 1+)
   */
  buildContinuationUserMessage(state: {
    targetBehavior: string;
    lastNodeText: string;
    childChoice: string;
    turnCount: number;
    visualStyle: string;
    characterAnchor: string;
  }): string {
    return `
CONTINUATION REQUEST:
- Target_Behavior: ${state.targetBehavior}
- Previous_Node_Summary: "${state.lastNodeText}"
- Child_Choice: "${state.childChoice}"
- Turn_Count: ${state.turnCount}
- Visual_Style: "${state.visualStyle}"
- Character_Anchor: "${state.characterAnchor}"
    `.trim();
  }
}
