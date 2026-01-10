import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { PromptsService } from '../prompts/prompts.service';

export interface InitializationResponse {
  node_text: string;
  visual_style: string;
  character_anchor: string;
  visual_context: string;
  choices: Array<{
    choice_text: string;
    behavior_type: string;
  }>;
}

export interface ContinuationResponse {
  node_text: string;
  visual_context: string;
  is_ending: boolean;
  choices: Array<{
    choice_text: string;
    behavior_type: string;
  }>;
}

@Injectable()
export class StoryGenerationService {
  private readonly logger = new Logger(StoryGenerationService.name);
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor(
    private readonly configService: ConfigService,
    private readonly promptsService: PromptsService,
  ) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      this.logger.warn('GEMINI_API_KEY not found. Story generation will not work.');
    } else {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
        safetySettings: [
          {
            category: HarmCategory.HARM_CATEGORY_HARASSMENT,
            threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
            threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
            threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
            threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
          },
        ],
        generationConfig: {
          temperature: 0.9,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
        },
      });
    }
  }

  /**
   * Initialize a new story session (Node 0)
   */
  async initializeStory(config: {
    childName: string;
    childAge: number;
    targetBehavior: string;
    characterName: string;
    setting: string;
    emotionalTone: string;
  }): Promise<InitializationResponse> {
    const systemPrompt = this.promptsService.getInitializationPrompt();
    const userMessage = this.promptsService.buildInitUserMessage(config);

    this.logger.log(`Initializing story for child: ${config.childName}`);

    const chat = this.model.startChat({
      history: [
        {
          role: 'user',
          parts: [{ text: systemPrompt }],
        },
        {
          role: 'model',
          parts: [{ text: 'I understand. I will generate story nodes as strict JSON.' }],
        },
      ],
    });

    const result = await chat.sendMessage(userMessage);
    const responseText = result.response.text();

    this.logger.debug(`Raw LLM response (init): ${responseText}`);

    return this.cleanAndParse<InitializationResponse>(responseText);
  }

  /**
   * Continue the story based on child's choice (Node 1+)
   */
  async continueStory(state: {
    targetBehavior: string;
    lastNodeText: string;
    childChoice: string;
    turnCount: number;
    visualStyle: string;
    characterAnchor: string;
  }): Promise<ContinuationResponse> {
    const systemPrompt = this.promptsService.getContinuationPrompt();
    const userMessage = this.promptsService.buildContinuationUserMessage(state);

    this.logger.log(`Continuing story - Turn ${state.turnCount}, Choice: ${state.childChoice}`);

    const chat = this.model.startChat({
      history: [
        {
          role: 'user',
          parts: [{ text: systemPrompt }],
        },
        {
          role: 'model',
          parts: [{ text: 'I understand. I will generate the next node as strict JSON.' }],
        },
      ],
    });

    const result = await chat.sendMessage(userMessage);
    const responseText = result.response.text();

    this.logger.debug(`Raw LLM response (cont): ${responseText}`);

    return this.cleanAndParse<ContinuationResponse>(responseText);
  }

  /**
   * Clean and parse JSON response from LLM
   * Removes markdown code fences and parses JSON
   */
  private cleanAndParse<T>(rawOutput: string): T {
    // Remove markdown fencing if present
    let cleanText = rawOutput
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .trim();

    try {
      return JSON.parse(cleanText) as T;
    } catch (error) {
      this.logger.error(`JSON Parse Error. Raw text: ${rawOutput}`);
      
      // Fallback: Return safe mode content
      throw new Error('Failed to parse LLM response. The story engine encountered an error.');
    }
  }
}
