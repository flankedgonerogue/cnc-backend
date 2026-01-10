import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StoryGenerationService } from '../story-generation/story-generation.service';
import { ImageGenerationService } from '../image-generation/image-generation.service';
import { InitializeSessionDto } from './dto/initialize-session.dto';
import { InitializeSessionResponseDto, SessionNodeResponseDto } from './dto/session-response.dto';

interface SessionState {
  sessionId: string;
  visualStyle: string;
  characterAnchor: string;
  lastNodeText: string;
  lastImageUrl: string;
  turnCount: number;
  targetBehavior: string;
}

@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);
  
  // In-memory session state cache (for visual_style, character_anchor, etc.)
  // In production, consider using Redis for distributed systems
  private sessionStateCache = new Map<string, SessionState>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly storyGeneration: StoryGenerationService,
    private readonly imageGeneration: ImageGenerationService,
  ) {}

  /**
   * Initialize a new story session (Node 0)
   */
  async initializeSession(
    dto: InitializeSessionDto,
  ): Promise<InitializeSessionResponseDto> {
    this.logger.log(`Initializing session for child: ${dto.childId}`);

    // Verify child profile exists
    const childProfile = await this.prisma.childProfile.findUnique({
      where: { id: dto.childId },
    });

    if (!childProfile) {
      throw new NotFoundException('Child profile not found');
    }

    // Step 1: Generate initial story node with LLM
    const storyResponse = await this.storyGeneration.initializeStory({
      childName: dto.childName,
      childAge: dto.childAge,
      targetBehavior: dto.targetBehavior,
      characterName: dto.characterName,
      setting: dto.setting,
      emotionalTone: dto.emotionalTone,
    });

    // Step 2: Generate initial image (Text-to-Image)
    let imageUrl: string | undefined;
    try {
      imageUrl = await this.imageGeneration.generateImage(
        storyResponse.visual_context,
      );
    } catch (error) {
      this.logger.error(`Image generation failed: ${error.message}`);
      // Continue without image if generation fails
    }

    // Step 3: Create session in database
    const session = await this.prisma.session.create({
      data: {
        childId: dto.childId,
        status: 'ACTIVE',
      },
    });

    // Step 4: Create first story node
    const storyNode = await this.prisma.storyNode.create({
      data: {
        sessionId: session.id,
        textContent: storyResponse.node_text,
        imageUrl: imageUrl,
        confidenceScore: 1.0, // Initial node always has high confidence
        isApproved: false,
        choices: {
          create: storyResponse.choices.map((choice) => ({
            text: choice.choice_text,
            behavioralTag: choice.behavior_type,
          })),
        },
      },
      include: {
        choices: true,
      },
    });

    // Step 5: Cache session state for future continuations
    this.sessionStateCache.set(session.id, {
      sessionId: session.id,
      visualStyle: storyResponse.visual_style,
      characterAnchor: storyResponse.character_anchor,
      lastNodeText: storyResponse.node_text,
      lastImageUrl: imageUrl || '',
      turnCount: 0,
      targetBehavior: dto.targetBehavior,
    });

    this.logger.log(`Session initialized: ${session.id}`);

    return {
      sessionId: session.id,
      nodeId: storyNode.id,
      node_text: storyNode.textContent,
      image_url: storyNode.imageUrl,
      is_ending: false,
      visual_style: storyResponse.visual_style,
      character_anchor: storyResponse.character_anchor,
      choices: storyNode.choices.map((c) => ({
        choice_text: c.text,
        behavior_type: c.behavioralTag || 'Neutral',
      })),
    };
  }

  /**
   * Continue the story based on child's choice (Node 1+)
   */
  async makeChoice(
    sessionId: string,
    choiceText: string,
  ): Promise<SessionNodeResponseDto> {
    this.logger.log(`Processing choice for session: ${sessionId}`);

    // Step 1: Get session state from cache
    const sessionState = this.sessionStateCache.get(sessionId);
    if (!sessionState) {
      throw new NotFoundException('Session state not found. Session may have expired.');
    }

    // Step 2: Verify session exists and is active
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        nodes: {
          orderBy: { id: 'desc' },
          take: 1,
          include: {
            choices: true,
          },
        },
      },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    if (session.status !== 'ACTIVE') {
      throw new BadRequestException('Session is not active');
    }

    // Step 3: Log the interaction
    const lastNode = session.nodes[0];
    const selectedChoice = lastNode?.choices.find((c) => c.text === choiceText);
    
    if (selectedChoice) {
      await this.prisma.interaction.create({
        data: {
          sessionId: session.id,
          choiceId: selectedChoice.id,
          timeTakenMs: 0, // Frontend should track this
        },
      });
    }

    // Step 4: Increment turn count
    sessionState.turnCount += 1;

    // Step 5: Generate next story node with LLM
    const storyResponse = await this.storyGeneration.continueStory({
      targetBehavior: sessionState.targetBehavior,
      lastNodeText: sessionState.lastNodeText,
      childChoice: choiceText,
      turnCount: sessionState.turnCount,
      visualStyle: sessionState.visualStyle,
      characterAnchor: sessionState.characterAnchor,
    });

    // Step 6: Generate image (Image-to-Image for consistency)
    let imageUrl: string | undefined;
    try {
      if (sessionState.lastImageUrl) {
        imageUrl = await this.imageGeneration.editImage(
          sessionState.lastImageUrl,
          storyResponse.visual_context,
          0.65, // Balance between consistency and prompt adherence
        );
      } else {
        // Fallback to text-to-image if no previous image
        imageUrl = await this.imageGeneration.generateImage(
          storyResponse.visual_context,
        );
      }
    } catch (error) {
      this.logger.error(`Image generation failed: ${error.message}`);
    }

    // Step 7: Create new story node
    const storyNode = await this.prisma.storyNode.create({
      data: {
        sessionId: session.id,
        textContent: storyResponse.node_text,
        imageUrl: imageUrl,
        confidenceScore: 0.95,
        isApproved: false,
        choices: {
          create: storyResponse.choices.map((choice) => ({
            text: choice.choice_text,
            behavioralTag: choice.behavior_type,
          })),
        },
      },
      include: {
        choices: true,
      },
    });

    // Step 8: Update session state cache
    sessionState.lastNodeText = storyResponse.node_text;
    sessionState.lastImageUrl = imageUrl || sessionState.lastImageUrl;

    // Step 9: Handle ending
    if (storyResponse.is_ending) {
      await this.prisma.session.update({
        where: { id: sessionId },
        data: {
          status: 'COMPLETED',
          endedAt: new Date(),
        },
      });
      
      // Remove from cache
      this.sessionStateCache.delete(sessionId);
      
      this.logger.log(`Session completed: ${sessionId}`);
    }

    return {
      sessionId: session.id,
      nodeId: storyNode.id,
      node_text: storyNode.textContent,
      image_url: storyNode.imageUrl,
      is_ending: storyResponse.is_ending,
      choices: storyNode.choices.map((c) => ({
        choice_text: c.text,
        behavior_type: c.behavioralTag || 'Neutral',
      })),
    };
  }

  /**
   * Get session details
   */
  async getSession(sessionId: string) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        nodes: {
          include: {
            choices: true,
          },
          orderBy: {
            id: 'asc',
          },
        },
        interactions: true,
        child: true,
      },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    return session;
  }
}
