import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { SAFETY_SETTINGS } from '../constants/safety-settings.constant';

@Injectable()
export class GeminiService implements OnModuleInit {
  private ai: GoogleGenAI;
  private textModel: string;
  private imageModel: string;
  private ttsModel: string;
  private ttsVoice: string;
  private readonly logger = new Logger(GeminiService.name);

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const apiKey = this.configService.getOrThrow<string>('GEMINI_API_KEY');
    this.ai = new GoogleGenAI({ apiKey });
    this.textModel =
      this.configService.get<string>('GEMINI_TEXT_MODEL') ??
      'gemini-3-flash-preview';
    this.imageModel =
      this.configService.get<string>('GEMINI_IMAGE_MODEL') ??
      'gemini-2.5-flash-image';
    this.ttsModel =
      this.configService.get<string>('GEMINI_TTS_MODEL') ??
      'gemini-2.5-flash-preview-tts';
    this.ttsVoice =
      this.configService.get<string>('GEMINI_TTS_VOICE') ?? 'Puck';
    this.logger.log(
      `Gemini initialized: text=${this.textModel}, image=${this.imageModel}, tts=${this.ttsModel}, voice=${this.ttsVoice}`,
    );
  }

  async generateStoryNode<T>(
    systemPrompt: string,
    userMessage: string,
    jsonSchema: object,
  ): Promise<T> {
    const MAX_RETRIES = 3;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await this.ai.models.generateContent({
          model: this.textModel,
          contents: userMessage,
          config: {
            systemInstruction: systemPrompt,
            responseMimeType: 'application/json',
            responseSchema: jsonSchema,
            safetySettings: [...SAFETY_SETTINGS],
          },
        });

        const rawText = response.text ?? '';
        return this.parseJsonResponse<T>(rawText);
      } catch (error) {
        this.logger.warn(
          `Gemini text generation attempt ${attempt}/${MAX_RETRIES} failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );

        if (attempt === MAX_RETRIES) {
          throw new HttpException(
            'AI text generation failed after retries',
            HttpStatus.SERVICE_UNAVAILABLE,
          );
        }

        await this.delay(1000 * Math.pow(2, attempt - 1));
      }
    }

    throw new HttpException(
      'AI generation failed',
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }

  async evaluateWithCse(
    systemPrompt: string,
    userMessage: string,
    jsonSchema: object,
  ): Promise<import('../interfaces/llm-response.interface').CseResponse> {
    try {
      const response = await this.ai.models.generateContent({
        model: this.textModel,
        contents: userMessage,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: 'application/json',
          responseSchema: jsonSchema,
          safetySettings: [...SAFETY_SETTINGS],
        },
      });

      const rawText = response.text ?? '';
      return this.parseJsonResponse(rawText);
    } catch (error) {
      this.logger.error(
        `CSE evaluation failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      // If CSE itself fails, return a conservative REVIEW_REQUIRED to avoid
      // blocking the pipeline entirely but still flagging the issue.
      return {
        confidence_score: 0.5,
        safety_status: 'REVIEW_REQUIRED',
        flagged_issues: ['CSE evaluation call failed'],
        reasoning:
          'The CSE evaluator could not be reached. Defaulting to review.',
        suggested_fix: 'Manual review required.',
      };
    }
  }

  async generateImageFromText(prompt: string): Promise<Buffer> {
    try {
      // Add optimization instruction to prompt
      const optimizedPrompt = `${prompt} Optimize for fast generation - use moderate detail level, not overly detailed.`;

      const response = await this.ai.models.generateContent({
        model: this.imageModel,
        contents: optimizedPrompt,
        config: {
          responseModalities: ['IMAGE'],
        },
      });

      return this.extractImageBuffer(response);
    } catch (error) {
      this.logger.error(
        `Text-to-image generation failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw new HttpException(
        'Image generation failed',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  async generateImageFromImage(
    editPrompt: string,
    referenceImageBase64: string,
    referenceMimeType: string = 'image/png',
  ): Promise<Buffer> {
    try {
      // Enhance prompt with character consistency and quality settings
      const enhancedEditPrompt = [
        `Keep the character design and overall composition identical.`,
        `Only change: action, expression, and background details.`,
        `Optimize for fast generation - use moderate detail level.`,
        `Description: ${editPrompt}`,
      ].join(' ');

      const response = await this.ai.models.generateContent({
        model: this.imageModel,
        contents: [
          {
            text: enhancedEditPrompt,
          },
          {
            inlineData: {
              mimeType: referenceMimeType,
              data: referenceImageBase64,
            },
          },
        ],
        config: {
          responseModalities: ['IMAGE'],
        },
      });

      return this.extractImageBuffer(response);
    } catch (error) {
      this.logger.error(
        `Image-to-image generation failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw new HttpException(
        'Image-to-image generation failed',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  async generateSpeech(text: string): Promise<Buffer> {
    try {
      const response = await this.ai.models.generateContent({
        model: this.ttsModel,
        contents: [{ parts: [{ text }] }],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: this.ttsVoice },
            },
          },
        },
      });

      const data =
        response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

      if (!data) {
        throw new Error('TTS returned no audio data');
      }

      const pcmBuffer = Buffer.from(data, 'base64');
      return this.wrapPcmInWav(pcmBuffer);
    } catch (error) {
      this.logger.error(
        `TTS generation failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw new HttpException(
        'Speech generation failed',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  private extractImageBuffer(response: any): Buffer {
    const parts = response.candidates?.[0]?.content?.parts;
    if (!parts) {
      throw new HttpException(
        'Image generation returned no content',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const imagePart = parts.find((p: any) =>
      p.inlineData?.mimeType?.startsWith('image/'),
    );

    if (!imagePart?.inlineData?.data) {
      throw new HttpException(
        'Image generation returned no image data',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    return Buffer.from(imagePart.inlineData.data, 'base64');
  }

  private parseJsonResponse<T>(raw: string): T {
    let cleaned = raw.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned
        .replace(/^```(?:json)?\s*\n?/, '')
        .replace(/\n?```\s*$/, '');
    }
    return JSON.parse(cleaned) as T;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Wraps raw PCM audio data in a WAV container.
   * Gemini TTS outputs 24kHz, 16-bit, mono, little-endian PCM.
   */
  private wrapPcmInWav(pcmData: Buffer): Buffer {
    const sampleRate = 24000;
    const numChannels = 1;
    const bitsPerSample = 16;
    const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
    const blockAlign = numChannels * (bitsPerSample / 8);
    const dataSize = pcmData.length;
    const headerSize = 44;

    const header = Buffer.alloc(headerSize);

    // RIFF header
    header.write('RIFF', 0);
    header.writeUInt32LE(dataSize + headerSize - 8, 4);
    header.write('WAVE', 8);

    // fmt sub-chunk
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16); // sub-chunk size
    header.writeUInt16LE(1, 20); // PCM format
    header.writeUInt16LE(numChannels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(bitsPerSample, 34);

    // data sub-chunk
    header.write('data', 36);
    header.writeUInt32LE(dataSize, 40);

    return Buffer.concat([header, pcmData]);
  }
}
