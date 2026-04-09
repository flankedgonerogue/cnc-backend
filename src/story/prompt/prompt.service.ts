import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

@Injectable()
export class PromptService implements OnModuleInit {
  private initPromptTemplate = '';
  private contPromptTemplate = '';
  private csePromptTemplate = '';
  private readonly logger = new Logger(PromptService.name);

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const promptsDir =
      this.configService.get<string>('PROMPTS_DIR') ?? 'prompts';
    const basePath = path.join(process.cwd(), promptsDir);

    this.initPromptTemplate = await readFile(
      path.join(basePath, 'system_prompt_init.xml'),
      'utf-8',
    );
    this.contPromptTemplate = await readFile(
      path.join(basePath, 'system_prompt_cont.xml'),
      'utf-8',
    );
    this.csePromptTemplate = await readFile(
      path.join(basePath, 'system_prompt_cse.xml'),
      'utf-8',
    );

    this.logger.log('Prompt templates loaded successfully');
  }

  buildInitPrompt(params: {
    childName: string;
    childAge: number;
    targetBehavior: string;
    mainCharacter: string;
    setting: string;
    emotionalTone: string;
  }): string {
    return this.initPromptTemplate
      .replace(/\{\{Child_Name\}\}/g, params.childName)
      .replace(/\{\{Child_Age\}\}/g, String(params.childAge))
      .replace(/\{\{Target_Behavior\}\}/g, params.targetBehavior)
      .replace(/\{\{Main_Character\}\}/g, params.mainCharacter)
      .replace(/\{\{Setting\}\}/g, params.setting)
      .replace(/\{\{Emotional_Tone\}\}/g, params.emotionalTone);
  }

  buildContinuePrompt(params: {
    targetBehavior: string;
    previousNodeSummary: string;
    childChoice: string;
    turnCount: number;
    visualStyle: string;
    characterAnchor: string;
    setting: string;
    mainCharacter: string;
  }): string {
    return this.contPromptTemplate
      .replace(/\{\{Target_Behavior\}\}/g, params.targetBehavior)
      .replace(/\{\{Previous_Node_Summary\}\}/g, params.previousNodeSummary)
      .replace(/\{\{Child_Choice\}\}/g, params.childChoice)
      .replace(/\{\{Turn_Count\}\}/g, String(params.turnCount))
      .replace(/\{\{Visual_Style\}\}/g, params.visualStyle)
      .replace(/\{\{Character_Anchor\}\}/g, params.characterAnchor)
      .replace(/\{\{Setting\}\}/g, params.setting)
      .replace(/\{\{Main_Character\}\}/g, params.mainCharacter);
  }

  buildCseSystemPrompt(params: {
    targetBehavior: string;
    childAge: number;
  }): string {
    return this.csePromptTemplate
      .replace(/\{\{Target_Behavior\}\}/g, params.targetBehavior)
      .replace(/\{\{Child_Age\}\}/g, String(params.childAge));
  }

  buildCseUserPrompt(params: {
    targetBehavior: string;
    childAge: number;
    generatedJson: string;
  }): string {
    return [
      `Evaluate the following generated story node for safety and therapeutic alignment.`,
      ``,
      `Target Behavior: ${params.targetBehavior}`,
      `Child Age: ${params.childAge}`,
      ``,
      `Generated JSON:`,
      params.generatedJson,
    ].join('\n');
  }
}
