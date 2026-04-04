import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
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

@Injectable()
export class StoryService {
  private readonly sessionCache = new Map<string, SessionState>();
  private readonly inFlightSessions = new Set<string>();
  private readonly logger = new Logger(StoryService.name);
  private readonly cseApprovalThreshold: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly geminiService: GeminiService,
    private readonly promptService: PromptService,
    private readonly storageService: LocalDiskStorageService,
    private readonly configService: ConfigService,
  ) {
    this.cseApprovalThreshold =
      parseFloat(
        this.configService.get<string>('CSE_APPROVAL_THRESHOLD') || '0.9',
      ) || 0.9;
    this.logger.log(
      `StoryService initialized with CSE_APPROVAL_THRESHOLD=${this.cseApprovalThreshold}`,
    );
  }

  async startStory(userId: string, dto: StartStoryDto) {
    const session = await this.prisma.session.findUnique({
      where: { id: dto.sessionId },
      include: { template: true, child: { include: { user: true } } },
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
      const latestNode = await this.prisma.storyNode.findFirst({
        where: { sessionId: dto.sessionId },
        orderBy: { id: 'desc' },
        include: { choices: true },
      });

      if (!latestNode) {
        throw new NotFoundException('Current story node not found.');
      }

      return {
        sessionId: session.id,
        node: {
          id: latestNode.id,
          textContent: latestNode.textContent,
          imageUrl: latestNode.imageUrl,
          audioUrl: latestNode.audioUrl,
          confidenceScore: latestNode.confidenceScore,
          isApproved: latestNode.isApproved,
          choices: latestNode.choices.map((c) => ({
            id: c.id,
            text: c.text,
            behavioralTag: c.behavioralTag,
          })),
        },
      };
    }

    const template = session.template;
    const child = session.child;

    // Extract child name from database
    const childName = child.user.displayName || child.user.firstName || 'Friend';

    // Calculate child age from dateOfBirth or use default
    let childAge = 7;
    if (child.dateOfBirth) {
      const ageDiff = Date.now() - child.dateOfBirth.getTime();
      childAge = Math.floor(ageDiff / (365.25 * 24 * 60 * 60 * 1000));
    }

    const systemPrompt = this.promptService.buildInitPrompt({
      childName,
      childAge,
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
        childAge,
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
      childAge,
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

  async restartStory(userId: string, dto: StartStoryDto) {
    const session = await this.prisma.session.findUnique({
      where: { id: dto.sessionId },
      include: { child: true },
    });

    if (!session) {
      throw new NotFoundException('Session not found.');
    }

    await this.validateSessionAccess(userId, session.child);

    await this.prisma.$transaction([
      this.prisma.interaction.deleteMany({ where: { sessionId: dto.sessionId } }),
      this.prisma.choice.deleteMany({ where: { node: { sessionId: dto.sessionId } } }),
      this.prisma.storyNode.deleteMany({ where: { sessionId: dto.sessionId } }),
      this.prisma.behavioralAnalytics.deleteMany({
        where: { sessionId: dto.sessionId },
      }),
      this.prisma.session.update({
        where: { id: dto.sessionId },
        data: {
          status: 'ACTIVE',
          endedAt: null,
          startedAt: new Date(),
        },
      }),
    ]);

    this.sessionCache.delete(dto.sessionId);
    this.inFlightSessions.delete(dto.sessionId);

    return this.startStory(userId, dto);
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

    // Count existing interactions to determine sequence number
    const existingInteractionCount = await this.prisma.interaction.count({
      where: { sessionId: dto.sessionId },
    });
    const choiceSequenceNum = existingInteractionCount + 1;

    // Get the session start time for duration calculation
    const sessionDuration = Date.now() - session.startedAt.getTime();

    // Create interaction with comprehensive behavioral metrics
    await this.prisma.interaction.create({
      data: {
        sessionId: dto.sessionId,
        choiceId: dto.choiceId,
        nodeId: latestNode.id,
        timeTakenMs: dto.timeTakenMs,
        choiceSequenceNum,
        behavioralPattern: choice.behavioralTag,
        nodeConfidenceScore: latestNode.confidenceScore,
        nodeApprovedByTherapist: latestNode.isApproved,
        turnNumber: state.turnCount,
        sessionDuration,
      },
    });

    // Update behavioral analytics for the session
    await this.updateSessionBehavioralAnalytics(dto.sessionId);

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
        const aspectRatioPrompt = `Keep image in 16:9 aspect ratio. ${llmResponse.visual_context}`;

        if (state.lastGeneratedImageUrl) {
          try {
            // Fetch the image from the URL (supports both local and S3)
            const imageResponse = await axios.get(
              state.lastGeneratedImageUrl,
              { responseType: 'arraybuffer' },
            );
            const prevImageBase64 = Buffer.from(imageResponse.data).toString(
              'base64',
            );

            newImageBuffer = await this.geminiService.generateImageFromImage(
              aspectRatioPrompt,
              prevImageBase64,
              'image/png',
            );
          } catch (error) {
            this.logger.warn(
              `Failed to fetch previous image from URL ${state.lastGeneratedImageUrl}, generating from text instead`,
              error,
            );
            newImageBuffer = await this.geminiService.generateImageFromText(
              aspectRatioPrompt,
            );
          }
        } else {
          newImageBuffer = await this.geminiService.generateImageFromText(
            aspectRatioPrompt,
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

    this.logger.debug(
      `Creating story node for continuation: imageUrl=${imageUrl ? 'YES' : 'NULL'}, audioUrl=${audioUrl ? 'YES' : 'NULL'}`,
    );

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

    this.logger.debug(
      `Created story node ${storyNode.id}: imageUrl=${storyNode.imageUrl ? 'YES' : 'NULL'}, audioUrl=${storyNode.audioUrl ? 'YES' : 'NULL'}`,
    );

    if (isEnding) {
      await this.prisma.session.update({
        where: { id: dto.sessionId },
        data: { status: 'COMPLETED', endedAt: new Date() },
      });
      
      // Final analytics update with session completion flag
      const finalAnalytics = await this.prisma.behavioralAnalytics.findUnique({
        where: { sessionId: dto.sessionId },
      });
      
      if (finalAnalytics) {
        await this.prisma.behavioralAnalytics.update({
          where: { sessionId: dto.sessionId },
          data: {
            updatedAt: new Date(),
          },
        });
      }
      
      this.sessionCache.delete(dto.sessionId);
      this.logger.log(
        `Session ${dto.sessionId} completed. Final analytics recorded.`,
      );
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
        isApproved: storyNode.isApproved,
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
        cseResult.confidence_score >= this.cseApprovalThreshold &&
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
      // Re-evaluate the final response with CSE to get an updated confidence score
      const finalCseResult = await this.geminiService.evaluateWithCse(
        this.promptService.buildCseSystemPrompt({
          targetBehavior: params.targetBehavior,
          childAge: params.childAge,
        }),
        this.promptService.buildCseUserPrompt({
          targetBehavior: params.targetBehavior,
          childAge: params.childAge,
          generatedJson: JSON.stringify(finalResponse, null, 2),
        }),
        CSE_RESPONSE_SCHEMA,
      );
      this.logger.log(
        `Final CSE evaluation: score=${finalCseResult.confidence_score}, status=${finalCseResult.safety_status}`,
      );
      return { response: finalResponse, cseResult: finalCseResult };
    }

    // UNSAFE after all retries — throw to trigger fallback
    throw new Error(
      `CSE rejected content as UNSAFE after ${CSE_MAX_RETRIES} attempts: ${lastCseResult?.flagged_issues.join(', ')}`,
    );
  }

  private async generateAndStoreImage(visualContext: string): Promise<string> {
    const aspectRatioPrompt = `Generate image in 16:9 aspect ratio. ${visualContext}`;
    const imageBuffer =
      await this.geminiService.generateImageFromText(aspectRatioPrompt);
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

  /**
   * Update behavioral analytics for a session after each choice.
   * Aggregates choice data and computes engagement metrics.
   */
  private async updateSessionBehavioralAnalytics(sessionId: string): Promise<void> {
    const interactions = await this.prisma.interaction.findMany({
      where: { sessionId },
      include: { choice: true },
    });

    if (interactions.length === 0) {
      // Create empty behavioral analytics record if no interactions yet
      await this.prisma.behavioralAnalytics.upsert({
        where: { sessionId },
        update: {},
        create: {
          sessionId,
          totalChoices: 0,
          positiveChoices: 0,
          negativeChoices: 0,
          neutralChoices: 0,
          avgTimeTakenMs: 0,
          engagementScore: 0.5,
          avgNodeConfidenceScore: 0,
          therapistApprovedNodes: 0,
          flaggedForReview: false,
        },
      });
      return;
    }

    // Count choice types
    const positiveChoices = interactions.filter(
      (i) => i.behavioralPattern === 'Positive',
    ).length;
    const negativeChoices = interactions.filter(
      (i) => i.behavioralPattern === 'Negative',
    ).length;
    const neutralChoices = interactions.filter(
      (i) => i.behavioralPattern === 'Neutral',
    ).length;

    // Calculate timing metrics
    const timeTakenValues = interactions.map((i) => i.timeTakenMs);
    const avgTimeTakenMs =
      timeTakenValues.reduce((a, b) => a + b, 0) / timeTakenValues.length;
    const minTimeTakenMs = Math.min(...timeTakenValues);
    const maxTimeTakenMs = Math.max(...timeTakenValues);

    // Determine decision speed trend
    const decisionSpeedTrend = this.analyzeDecisionSpeedTrend(timeTakenValues);

    // Determine positive choice pattern
    const positiveChoicePattern = this.analyzeChoicePattern(
      interactions.map((i) => i.behavioralPattern ?? 'Neutral').filter(Boolean),
      'Positive',
    );

    // Calculate engagement score (0.0 - 1.0)
    // Based on: choice distribution, decision consistency, and response quality
    const engagementScore = this.calculateEngagementScore(
      positiveChoices,
      interactions.length,
      avgTimeTakenMs,
      interactions.map((i) => i.nodeConfidenceScore ?? 0),
    );

    // Get average node confidence score
    const avgNodeConfidenceScore =
      interactions.reduce((sum, i) => sum + (i.nodeConfidenceScore ?? 0), 0) /
      interactions.length;

    // Count therapist-approved nodes
    const therapistApprovedNodes = interactions.filter(
      (i) => i.nodeApprovedByTherapist,
    ).length;

    // Determine dominant behavior pattern
    const dominantBehaviorPattern =
      positiveChoices >= negativeChoices && positiveChoices >= neutralChoices
        ? 'Positive'
        : negativeChoices >= neutralChoices
          ? 'Negative'
          : 'Neutral';

    // Generate insights for therapist
    const notesForTherapist = this.generateTherapistNotes({
      totalChoices: interactions.length,
      positiveChoices,
      negativeChoices,
      neutralChoices,
      avgTimeTakenMs,
      engagementScore,
      dominantBehaviorPattern,
    });

    // Determine if flagged for review
    const flaggedForReview =
      engagementScore < 0.4 || // Low engagement
      avgNodeConfidenceScore < 0.7 || // Low AI quality
      negativeChoices > positiveChoices; // More negative than positive choices

    // Upsert behavioral analytics
    await this.prisma.behavioralAnalytics.upsert({
      where: { sessionId },
      update: {
        totalChoices: interactions.length,
        positiveChoices,
        negativeChoices,
        neutralChoices,
        avgTimeTakenMs,
        minTimeTakenMs,
        maxTimeTakenMs,
        decisionSpeedTrend,
        positiveChoicePattern,
        engagementScore,
        avgNodeConfidenceScore,
        therapistApprovedNodes,
        dominantBehaviorPattern,
        notesForTherapist,
        flaggedForReview,
        updatedAt: new Date(),
      },
      create: {
        sessionId,
        totalChoices: interactions.length,
        positiveChoices,
        negativeChoices,
        neutralChoices,
        avgTimeTakenMs,
        minTimeTakenMs,
        maxTimeTakenMs,
        decisionSpeedTrend,
        positiveChoicePattern,
        engagementScore,
        avgNodeConfidenceScore,
        therapistApprovedNodes,
        dominantBehaviorPattern,
        notesForTherapist,
        flaggedForReview,
      },
    });

    this.logger.log(
      `Updated behavioral analytics for session ${sessionId}: ${positiveChoices} positive, ${negativeChoices} negative, ${neutralChoices} neutral choices`,
    );
  }

  /**
   * Analyze decision speed trend over time.
   * Returns: "Fast", "Moderate", "Slow", or "Variable"
   */
  private analyzeDecisionSpeedTrend(timeTakenValues: number[]): string {
    if (timeTakenValues.length === 0) return 'Moderate';

    const avgTime = timeTakenValues.reduce((a, b) => a + b, 0) / timeTakenValues.length;

    // Standard deviation to detect variability
    const variance =
      timeTakenValues.reduce((sum, val) => sum + Math.pow(val - avgTime, 2), 0) /
      timeTakenValues.length;
    const stdDev = Math.sqrt(variance);
    const coefficientOfVariation = stdDev / avgTime;

    // If high variability, mark as "Variable"
    if (coefficientOfVariation > 0.5) {
      return 'Variable';
    }

    // Classify by average time
    if (avgTime < 1500) {
      return 'Fast';
    } else if (avgTime > 4000) {
      return 'Slow';
    }
    return 'Moderate';
  }

  /**
   * Analyze choice pattern for a specific type.
   * Returns: "Consistent", "Improving", "Declining"
   */
  private analyzeChoicePattern(patterns: string[], targetType: string): string {
    if (patterns.length < 2) return 'Consistent';

    // Split into early and late choices
    const midpoint = Math.floor(patterns.length / 2);
    const earlyChoices = patterns.slice(0, midpoint);
    const lateChoices = patterns.slice(midpoint);

    const earlyTargetCount = earlyChoices.filter((p) => p === targetType).length;
    const lateTargetCount = lateChoices.filter((p) => p === targetType).length;

    const earlyRatio = earlyTargetCount / Math.max(earlyChoices.length, 1);
    const lateRatio = lateTargetCount / Math.max(lateChoices.length, 1);

    // If difference is minimal, consistent
    if (Math.abs(lateRatio - earlyRatio) < 0.2) {
      return 'Consistent';
    }

    // If trending toward target type
    if (lateRatio > earlyRatio) {
      return 'Improving';
    }

    return 'Declining';
  }

  /**
   * Calculate engagement score (0.0 - 1.0) based on multiple factors.
   */
  private calculateEngagementScore(
    positiveChoices: number,
    totalChoices: number,
    avgTimeTakenMs: number,
    confidenceScores: number[],
  ): number {
    // Factor 1: Positive choice ratio (0.3 weight)
    const positiveRatio = totalChoices > 0 ? positiveChoices / totalChoices : 0;
    const positiveScore = Math.min(positiveRatio * 1.5, 1.0); // Boost positive choices

    // Factor 2: Decision consistency (0.3 weight)
    // Ideal decision time is 1500-3500ms; penalize too fast or too slow
    let consistencyScore = 1.0;
    if (avgTimeTakenMs < 800) {
      consistencyScore = avgTimeTakenMs / 800; // Too rushed
    } else if (avgTimeTakenMs > 5000) {
      consistencyScore = 1.0 - (avgTimeTakenMs - 5000) / 5000; // Too hesitant
    }
    consistencyScore = Math.max(consistencyScore, 0);

    // Factor 3: Content quality (0.4 weight)
    const avgConfidence = confidenceScores.length > 0
      ? confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length
      : 0;
    const qualityScore = avgConfidence;

    // Weighted average
    const engagementScore =
      positiveScore * 0.3 + consistencyScore * 0.3 + qualityScore * 0.4;

    return Math.max(0, Math.min(engagementScore, 1.0));
  }

  /**
   * Generate human-readable insights for therapist based on behavioral data.
   */
  private generateTherapistNotes(metrics: {
    totalChoices: number;
    positiveChoices: number;
    negativeChoices: number;
    neutralChoices: number;
    avgTimeTakenMs: number;
    engagementScore: number;
    dominantBehaviorPattern: string;
  }): string {
    const notes: string[] = [];

    // Total engagement summary
    notes.push(`Session included ${metrics.totalChoices} choices.`);

    // Choice distribution
    const positivePercent = Math.round(
      (metrics.positiveChoices / metrics.totalChoices) * 100,
    );
    const negativePercent = Math.round(
      (metrics.negativeChoices / metrics.totalChoices) * 100,
    );
    const neutralPercent = Math.round(
      (metrics.neutralChoices / metrics.totalChoices) * 100,
    );

    notes.push(
      `Choice distribution: ${positivePercent}% positive, ${negativePercent}% negative, ${neutralPercent}% neutral.`,
    );

    // Dominant pattern
    if (metrics.dominantBehaviorPattern === 'Positive') {
      notes.push(
        'Child demonstrated predominantly positive behavioral choices throughout the session.',
      );
    } else if (metrics.dominantBehaviorPattern === 'Negative') {
      notes.push(
        'Child made more negative choices. Consider exploring triggers or barriers in follow-up.',
      );
    } else {
      notes.push('Child demonstrated mixed behavioral patterns.');
    }

    // Decision speed insights
    if (metrics.avgTimeTakenMs < 1500) {
      notes.push('Child made decisions quickly - may indicate impulsivity or high confidence.');
    } else if (metrics.avgTimeTakenMs > 4000) {
      notes.push(
        'Child took longer to decide - may indicate careful consideration or decision anxiety.',
      );
    } else {
      notes.push('Child maintained moderate, steady decision-making speed.');
    }

    // Engagement level
    if (metrics.engagementScore >= 0.8) {
      notes.push('Overall engagement score is high - strong session quality.');
    } else if (metrics.engagementScore < 0.4) {
      notes.push('Overall engagement score is low - may warrant session review.');
    }

    return notes.join(' ');
  }

  /**
   * Retrieve behavioral analytics for a session.
   * Used by therapists to analyze child's behavioral patterns.
   */
  async getSessionBehavioralAnalytics(sessionId: string) {
    const trimmedSessionId = sessionId.trim();
    
    this.logger.debug(`Looking for analytics for session: "${trimmedSessionId}"`);
    
    const analytics = await this.prisma.behavioralAnalytics.findFirst({
      where: { 
        sessionId: trimmedSessionId,
      },
    });

    if (!analytics) {
      this.logger.error(
        `Analytics not found for session: "${trimmedSessionId}". Checking if session exists...`,
      );
      
      const session = await this.prisma.session.findUnique({
        where: { id: trimmedSessionId },
      });
      
      if (!session) {
        throw new NotFoundException('Session not found.');
      }
      
      throw new NotFoundException(
        'Behavioral analytics not found for this session.',
      );
    }

    // Also fetch all interactions for detailed view
    const interactions = await this.prisma.interaction.findMany({
      where: { sessionId },
      include: {
        choice: { select: { text: true, behavioralTag: true } },
        node: { select: { textContent: true, confidenceScore: true } },
      },
      orderBy: { timestamp: 'asc' },
    });

    return {
      analytics,
      interactions,
      summary: {
        sessionId,
        totalInteractions: interactions.length,
        sessionDuration: interactions.length > 0
          ? interactions[interactions.length - 1].sessionDuration
          : null,
        overallEngagement: analytics.engagementScore,
        therapistNotesForReview: analytics.notesForTherapist,
        flaggedForTherapistReview: analytics.flaggedForReview,
      },
    };
  }
}
