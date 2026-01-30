import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { PrismaService } from '../prisma/prisma.service';
import { LocalDiskStorageService } from '../storage/storage.module';
import { GeminiService } from './gemini/gemini.service';
import {
  INIT_RESPONSE_SCHEMA,
  CONTINUE_RESPONSE_SCHEMA,
  CSE_RESPONSE_SCHEMA,
} from './gemini/gemini.types';
import { PromptService } from './prompt/prompt.service';
import type { SessionState } from './interfaces/session-state.interface';
import type {
  InitLlmResponse,
  ContinueLlmResponse,
  CseResponse,
} from './interfaces/llm-response.interface';
import {
  FALLBACK_INIT_RESPONSE,
  FALLBACK_CONTINUE_RESPONSE,
} from './constants/fallback-node.constant';
import type { StartStoryDto } from './dto/start-story.dto';
import type { ContinueStoryDto } from './dto/continue-story.dto';

const CSE_MAX_RETRIES = 3;
const CSE_APPROVAL_THRESHOLD = 0.9;

@Injectable()
export class StoryService {
  private readonly sessionCache = new Map<string, SessionState>();
  private readonly inFlightSessions = new Set<string>();
  private readonly logger = new Logger(StoryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly geminiService: GeminiService,
    private readonly promptService: PromptService,
    private readonly storageService: LocalDiskStorageService,
  ) {}

  async startStory(userId: string, dto: StartStoryDto) {
    const session = await this.prisma.session.findUnique({
      where: { id: dto.sessionId },
      include: { template: true, child: true },
    });

    if (!session) {
      throw new NotFoundException('Session not found.');
    }

    if (session.status !== 'ACTIVE') {
      throw new BadRequestException('Session is not active.');
    }

    await this.validateSessionAccess(userId, session.child);

    // Ensure session hasn't already been started (no nodes generated yet)
    const existingNodeCount = await this.prisma.storyNode.count({
      where: { sessionId: dto.sessionId },
    });

    if (existingNodeCount > 0) {
      throw new BadRequestException('Session has already been started.');
    }

    const template = session.template;

    const systemPrompt = this.promptService.buildInitPrompt({
      childName: dto.childName,
      childAge: dto.childAge,
      targetBehavior: template.targetBehavior,
      mainCharacter: template.mainCharacter,
      setting: template.setting,
      emotionalTone: template.emotionalTone,
    });

    // --- CSE-gated generation loop ---
    let llmResponse: InitLlmResponse;
    let cseResult: CseResponse | null = null;
    let useFallback = false;

    try {
      const result = await this.generateWithCseGate<InitLlmResponse>({
        systemPrompt,
        userMessage: 'Generate the opening story node for this session.',
        jsonSchema: INIT_RESPONSE_SCHEMA,
        targetBehavior: template.targetBehavior,
        childAge: dto.childAge,
      });
      llmResponse = result.response;
      cseResult = result.cseResult;
    } catch (error) {
      this.logger.error(
        'LLM init generation failed after CSE retries, using safe fallback',
        error,
      );
      llmResponse = { ...FALLBACK_INIT_RESPONSE };
      useFallback = true;
    }

    // --- Image + TTS generation in parallel (only if CSE approved) ---
    let imageUrl: string | null = null;
    let audioUrl: string | null = null;

    if (!useFallback) {
      const [imageResult, audioResult] = await Promise.allSettled([
        this.generateAndStoreImage(llmResponse.visual_context),
        this.generateAndStoreAudio(llmResponse.node_text),
      ]);

      if (imageResult.status === 'fulfilled') {
        imageUrl = imageResult.value;
      } else {
        this.logger.warn('Image generation failed for init node', imageResult.reason);
      }

      if (audioResult.status === 'fulfilled') {
        audioUrl = audioResult.value;
      } else {
        this.logger.warn('TTS generation failed for init node', audioResult.reason);
      }
    }

    const confidenceScore = cseResult?.confidence_score ?? (useFallback ? 0.5 : 1.0);
    const isApproved = cseResult?.safety_status === 'SAFE';

    const storyNode = await this.prisma.storyNode.create({
      data: {
        sessionId: session.id,
        textContent: llmResponse.node_text,
        imageUrl,
        audioUrl,
        confidenceScore,
        isApproved,
        choices: {
          create: llmResponse.choices.map((c) => ({
            text: c.choice_text,
            behavioralTag: c.behavior_type,
          })),
        },
      },
      include: { choices: true },
    });

    this.sessionCache.set(session.id, {
      sessionId: session.id,
      childProfileId: session.childId,
      templateId: session.templateId,
      turnCount: 0,
      targetBehavior: template.targetBehavior,
      childAge: dto.childAge,
      lastNodeText: llmResponse.node_text,
      visualStyle: llmResponse.visual_style,
      characterAnchor: llmResponse.character_anchor,
      lastGeneratedImageUrl: imageUrl ?? '',
    });

    return {
      sessionId: session.id,
      node: {
        id: storyNode.id,
        textContent: storyNode.textContent,
        imageUrl: storyNode.imageUrl,
        audioUrl: storyNode.audioUrl,
        confidenceScore: storyNode.confidenceScore,
        choices: storyNode.choices.map((c) => ({
          id: c.id,
          text: c.text,
          behavioralTag: c.behavioralTag,
        })),
      },
    };
  }

  async continueStory(userId: string, dto: ContinueStoryDto) {
    if (this.inFlightSessions.has(dto.sessionId)) {
      throw new BadRequestException(
        'This session is currently processing a request. Please wait.',
      );
    }

    this.inFlightSessions.add(dto.sessionId);

    try {
      return await this.processContinuation(userId, dto);
    } finally {
      this.inFlightSessions.delete(dto.sessionId);
    }
  }

  private async processContinuation(userId: string, dto: ContinueStoryDto) {
    let state = this.sessionCache.get(dto.sessionId);

    if (!state) {
      state = await this.rehydrateSession(dto.sessionId);
    }

    const session = await this.prisma.session.findUnique({
      where: { id: dto.sessionId },
      include: { child: true },
    });

    if (!session || session.status !== 'ACTIVE') {
      throw new BadRequestException('Session is not active.');
    }

    await this.validateSessionAccess(userId, session.child);

    const choice = await this.prisma.choice.findUnique({
      where: { id: dto.choiceId },
      include: { node: true },
    });

    if (!choice) {
      throw new NotFoundException('Choice not found.');
    }

    const latestNode = await this.prisma.storyNode.findFirst({
      where: { sessionId: dto.sessionId },
      orderBy: { id: 'desc' },
      include: { choices: true },
    });

    if (!latestNode || choice.nodeId !== latestNode.id) {
      throw new BadRequestException(
        'Choice does not belong to the current story node.',
      );
    }

    await this.prisma.interaction.create({
      data: {
        sessionId: dto.sessionId,
        choiceId: dto.choiceId,
        timeTakenMs: dto.timeTakenMs,
      },
    });

    state.turnCount += 1;

    const systemPrompt = this.promptService.buildContinuePrompt({
      targetBehavior: state.targetBehavior,
      previousNodeSummary: state.lastNodeText,
      childChoice: choice.text,
      turnCount: state.turnCount,
      visualStyle: state.visualStyle,
      characterAnchor: state.characterAnchor,
    });

    // --- CSE-gated generation loop ---
    let llmResponse: ContinueLlmResponse;
    let cseResult: CseResponse | null = null;
    let useFallback = false;

    try {
      const result = await this.generateWithCseGate<ContinueLlmResponse>({
        systemPrompt,
        userMessage: `The child chose: "${choice.text}". Generate the next story node.`,
        jsonSchema: CONTINUE_RESPONSE_SCHEMA,
        targetBehavior: state.targetBehavior,
        childAge: state.childAge,
      });
      llmResponse = result.response;
      cseResult = result.cseResult;
    } catch (error) {
      this.logger.error(
        'LLM continuation generation failed after CSE retries, using safe fallback',
        error,
      );
      llmResponse = { ...FALLBACK_CONTINUE_RESPONSE };
      useFallback = true;
    }

    // --- Image + TTS generation in parallel (only if CSE approved) ---
    let imageUrl: string | null = state.lastGeneratedImageUrl || null;
    let audioUrl: string | null = null;

    if (!useFallback) {
      const imagePromise = (async () => {
        let newImageBuffer: Buffer;

        if (state.lastGeneratedImageUrl) {
          const diskPath = this.storageService.resolveImageDiskPath(
            state.lastGeneratedImageUrl,
          );
          const prevImageBuffer = await readFile(diskPath);
          const prevImageBase64 = prevImageBuffer.toString('base64');

          newImageBuffer = await this.geminiService.generateImageFromImage(
            llmResponse.visual_context,
            prevImageBase64,
            'image/png',
          );
        } else {
          newImageBuffer = await this.geminiService.generateImageFromText(
            llmResponse.visual_context,
          );
        }

        return this.storageService.uploadBuffer(
          newImageBuffer,
          'image/png',
          'story-images',
        );
      })();

      const [imageResult, audioResult] = await Promise.allSettled([
        imagePromise,
        this.generateAndStoreAudio(llmResponse.node_text),
      ]);

      if (imageResult.status === 'fulfilled') {
        imageUrl = imageResult.value;
      } else {
        this.logger.warn('Image generation failed for continuation node', imageResult.reason);
      }

      if (audioResult.status === 'fulfilled') {
        audioUrl = audioResult.value;
      } else {
        this.logger.warn('TTS generation failed for continuation node', audioResult.reason);
      }
    }

    const isEnding = llmResponse.is_ending === true;
    const confidenceScore = cseResult?.confidence_score ?? (useFallback ? 0.5 : 1.0);
    const isApproved = cseResult?.safety_status === 'SAFE';

    const storyNode = await this.prisma.storyNode.create({
      data: {
        sessionId: dto.sessionId,
        textContent: llmResponse.node_text,
        imageUrl,
        audioUrl,
        confidenceScore,
        isApproved,
        choices: isEnding
          ? undefined
          : {
              create: llmResponse.choices.map((c) => ({
                text: c.choice_text,
                behavioralTag: c.behavior_type,
              })),
            },
      },
      include: { choices: true },
    });

    if (isEnding) {
      await this.prisma.session.update({
        where: { id: dto.sessionId },
        data: { status: 'COMPLETED', endedAt: new Date() },
      });
      this.sessionCache.delete(dto.sessionId);
    } else {
      state.lastNodeText = llmResponse.node_text;
      state.lastGeneratedImageUrl = imageUrl ?? '';
      this.sessionCache.set(dto.sessionId, state);
    }

    return {
      sessionId: dto.sessionId,
      isEnding,
      node: {
        id: storyNode.id,
        textContent: storyNode.textContent,
        imageUrl: storyNode.imageUrl,
        audioUrl: storyNode.audioUrl,
        confidenceScore: storyNode.confidenceScore,
        choices: storyNode.choices.map((c) => ({
          id: c.id,
          text: c.text,
          behavioralTag: c.behavioralTag,
        })),
      },
    };
  }

  /**
   * CSE-gated generation loop.
   *
   * 1. Generate narrative via LLM
   * 2. Run CSE evaluation on the output
   * 3. If CSE score >= threshold (SAFE), return the response
   * 4. If CSE rejects (UNSAFE or REVIEW_REQUIRED), regenerate with
   *    the CSE's suggested_fix appended to the user prompt
   * 5. After CSE_MAX_RETRIES failures, throw to trigger fallback
   */
  private async generateWithCseGate<T>(params: {
    systemPrompt: string;
    userMessage: string;
    jsonSchema: object;
    targetBehavior: string;
    childAge: number;
  }): Promise<{ response: T; cseResult: CseResponse }> {
    let lastCseResult: CseResponse | null = null;
    let currentUserMessage = params.userMessage;

    for (let attempt = 1; attempt <= CSE_MAX_RETRIES; attempt++) {
      // Step 1: Generate narrative
      const llmResponse = await this.geminiService.generateStoryNode<T>(
        params.systemPrompt,
        currentUserMessage,
        params.jsonSchema,
      );

      // Step 2: Run CSE evaluation
      const cseSystemPrompt = this.promptService.buildCseSystemPrompt({
        targetBehavior: params.targetBehavior,
        childAge: params.childAge,
      });

      const cseUserPrompt = this.promptService.buildCseUserPrompt({
        targetBehavior: params.targetBehavior,
        childAge: params.childAge,
        generatedJson: JSON.stringify(llmResponse, null, 2),
      });

      const cseResult = await this.geminiService.evaluateWithCse(
        cseSystemPrompt,
        cseUserPrompt,
        CSE_RESPONSE_SCHEMA,
      );

      lastCseResult = cseResult;

      this.logger.log(
        `CSE attempt ${attempt}/${CSE_MAX_RETRIES}: score=${cseResult.confidence_score}, status=${cseResult.safety_status}`,
      );

      // Step 3: Check if approved
      if (
        cseResult.confidence_score >= CSE_APPROVAL_THRESHOLD &&
        cseResult.safety_status === 'SAFE'
      ) {
        return { response: llmResponse, cseResult };
      }

      // Step 4: If UNSAFE, regenerate with CSE feedback
      if (cseResult.safety_status === 'UNSAFE') {
        this.logger.warn(
          `CSE flagged UNSAFE on attempt ${attempt}: ${cseResult.flagged_issues.join(', ')}`,
        );
      }

      // Append CSE feedback to the user message for the next attempt
      currentUserMessage = [
        params.userMessage,
        '',
        `IMPORTANT - The previous generation was rejected by the safety evaluator.`,
        `Issues found: ${cseResult.flagged_issues.join('; ')}`,
        `Fix required: ${cseResult.suggested_fix}`,
        `Reasoning: ${cseResult.reasoning}`,
        `Generate a corrected version that addresses ALL of these issues.`,
      ].join('\n');
    }

    // All retries exhausted. If the last result was at least not UNSAFE,
    // accept it with the lower score rather than falling back entirely.
    if (lastCseResult && lastCseResult.safety_status !== 'UNSAFE') {
      this.logger.warn(
        `CSE did not fully approve after ${CSE_MAX_RETRIES} attempts (score=${lastCseResult.confidence_score}), proceeding with REVIEW_REQUIRED`,
      );
      // Regenerate one final time with the feedback applied
      const finalResponse = await this.geminiService.generateStoryNode<T>(
        params.systemPrompt,
        currentUserMessage,
        params.jsonSchema,
      );
      return { response: finalResponse, cseResult: lastCseResult };
    }

    // UNSAFE after all retries — throw to trigger fallback
    throw new Error(
      `CSE rejected content as UNSAFE after ${CSE_MAX_RETRIES} attempts: ${lastCseResult?.flagged_issues.join(', ')}`,
    );
  }

  private async generateAndStoreImage(visualContext: string): Promise<string> {
    const imageBuffer =
      await this.geminiService.generateImageFromText(visualContext);
    return this.storageService.uploadBuffer(
      imageBuffer,
      'image/png',
      'story-images',
    );
  }

  private async generateAndStoreAudio(nodeText: string): Promise<string> {
    const audioBuffer = await this.geminiService.generateSpeech(nodeText);
    return this.storageService.uploadBuffer(
      audioBuffer,
      'audio/wav',
      'story-audio',
    );
  }

  private async validateSessionAccess(
    userId: string,
    child: { userId: string; therapistId: string },
  ): Promise<void> {
    // Child accessing their own session
    if (child.userId === userId) {
      return;
    }

    // Therapist accessing their child's session
    const therapistProfile = await this.prisma.therapistProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (therapistProfile && therapistProfile.id === child.therapistId) {
      return;
    }

    throw new ForbiddenException('You do not have access to this session.');
  }

  private async rehydrateSession(sessionId: string): Promise<SessionState> {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: { template: true, child: true },
    });

    if (!session) {
      throw new NotFoundException('Session not found.');
    }

    if (session.status !== 'ACTIVE') {
      throw new BadRequestException('Session is not active.');
    }

    const latestNode = await this.prisma.storyNode.findFirst({
      where: { sessionId },
      orderBy: { id: 'desc' },
    });

    const nodeCount = await this.prisma.storyNode.count({
      where: { sessionId },
    });

    // Derive child age from dateOfBirth if available, otherwise default to 7
    let childAge = 7;
    if (session.child.dateOfBirth) {
      const ageDiff = Date.now() - session.child.dateOfBirth.getTime();
      childAge = Math.floor(ageDiff / (365.25 * 24 * 60 * 60 * 1000));
    }

    const state: SessionState = {
      sessionId,
      childProfileId: session.childId,
      templateId: session.templateId,
      turnCount: Math.max(0, nodeCount - 1),
      targetBehavior: session.template.targetBehavior,
      childAge,
      lastNodeText: latestNode?.textContent ?? '',
      visualStyle: session.template.visualStyle,
      characterAnchor: '',
      lastGeneratedImageUrl: latestNode?.imageUrl ?? '',
    };

    this.sessionCache.set(sessionId, state);
    this.logger.log(`Session ${sessionId} rehydrated from database`);

    return state;
  }
}
