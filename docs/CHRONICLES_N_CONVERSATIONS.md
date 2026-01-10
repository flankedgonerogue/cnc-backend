# Chronicles N Conversations Engine - Technical Documentation

## Overview

The **Chronicles N Conversations** engine is an AI-powered therapeutic storytelling system integrated into the CNC Backend. It generates interactive, personalized stories for children with special needs, helping them practice social and behavioral skills in a safe, engaging environment.

## Architecture

### Core Components

1. **Story Generation Service** (`src/story-generation/`)
   - Integrates with Google Gemini AI (gemini-1.5-flash)
   - Generates story content with strict JSON output
   - Implements safety filters (harassment, hate speech, dangerous content)
   - Uses system prompts for initialization and continuation

2. **Image Generation Service** (`src/image-generation/`)
   - Integrates with Nano Banana API
   - Text-to-Image for initial node (Node 0)
   - Image-to-Image editing for consistency (Node 1+)
   - Maintains character consistency across story progression

3. **Prompts System** (`src/prompts/`)
   - XML-based system prompts for LLM guidance
   - `system-prompt-init.xml` - Story initialization
   - `system-prompt-cont.xml` - Story continuation
   - Dynamic user message construction

4. **Sessions Module** (`src/sessions/`)
   - Orchestrates the game loop
   - Manages session state (visual style, character anchor)
   - Handles choice processing and node generation
   - Implements sliding window context management

---

## How It Works

### **Phase 1: Initialization (Node 0)**

When a session starts:

```
Client Request → Sessions Controller → Sessions Service
                                            ↓
                  Story Generation Service (Gemini AI)
                                            ↓
                  Image Generation Service (Nano Banana - Text-to-Image)
                                            ↓
                  Database (Session + StoryNode created)
                                            ↓
                  Response with initial story, image, choices
```

**Key Data Stored:**
- `visual_style` - Age-appropriate art style (Pixar vs. Comic Book)
- `character_anchor` - Rigid character description for consistency
- `last_node_text` - Story context
- `last_image_url` - Previous image for editing

### **Phase 2: Game Loop (Node 1...N)**

When a child makes a choice:

```
Client Choice → Sessions Controller → Sessions Service
                                           ↓
                   Retrieve Session State (from cache)
                                           ↓
                   Log Interaction (database)
                                           ↓
                   Story Generation Service (Gemini AI)
                   - Uses character_anchor & visual_style
                   - Increments turn_count
                                           ↓
                   Image Generation Service (Nano Banana - Image-to-Image)
                   - Uses previous image + new prompt
                   - Strength: 0.65 (balance consistency/prompt)
                                           ↓
                   Create New StoryNode (database)
                                           ↓
                   Check if ending (turn_count >= 5 + positive choice)
                                           ↓
                   Response with next story, image, choices
```

---

## API Endpoints

### **1. Initialize Session**

**Endpoint:** `POST /sessions/initialize`

**Auth:** JWT (GUARDIAN or CHILD role)

**Request Body:**
```json
{
  "childId": "clxxx...",
  "childName": "Alex",
  "childAge": 7,
  "targetBehavior": "Sharing",
  "characterName": "Dino",
  "setting": "Sandbox",
  "emotionalTone": "Playful"
}
```

**Response:**
```json
{
  "sessionId": "clyyy...",
  "nodeId": "clzzz...",
  "node_text": "Dino sits in the warm yellow sand...",
  "image_url": "https://cdn.nanobanana.ai/xyz.png",
  "is_ending": false,
  "visual_style": "3D animated movie style...",
  "character_anchor": "cute green t-rex dinosaur...",
  "choices": [
    { "choice_text": "Give shovel", "behavior_type": "Positive" },
    { "choice_text": "Hide shovel", "behavior_type": "Neutral/Negative" }
  ]
}
```

### **2. Make Choice (Continue Story)**

**Endpoint:** `POST /sessions/choice`

**Auth:** JWT (GUARDIAN or CHILD role)

**Request Body:**
```json
{
  "sessionId": "clyyy...",
  "choiceText": "Give shovel"
}
```

**Response:**
```json
{
  "sessionId": "clyyy...",
  "nodeId": "claaa...",
  "node_text": "Sarah smiles big! She uses the shovel...",
  "image_url": "https://cdn.nanobanana.ai/abc.png",
  "is_ending": false,
  "choices": [
    { "choice_text": "Find a stick", "behavior_type": "Positive" },
    { "choice_text": "Knock castle over", "behavior_type": "Neutral/Negative" }
  ]
}
```

### **3. Get Session Details**

**Endpoint:** `GET /sessions/:id`

**Auth:** JWT (All authenticated users)

**Response:** Full session object with all nodes, interactions, and child profile.

---

## Configuration

### Environment Variables

Add to your `.env` file:

```env
# Chronicles N Conversations Engine - AI Configuration
# Gemini API for Story Generation
GEMINI_API_KEY=your-gemini-api-key-here

# Nano Banana API for Image Generation
NANO_BANANA_API_KEY=your-nano-banana-api-key-here
NANO_BANANA_BASE_URL=https://api.nanobanana.ai
```

### Getting API Keys

1. **Gemini API Key**
   - Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Create a new API key
   - Copy and paste into `.env`

2. **Nano Banana API Key**
   - Sign up at [Nano Banana](https://nanobanana.ai)
   - Navigate to API settings
   - Generate API key
   - Copy and paste into `.env`

---

## Safety & Privacy

### Built-in Safety Features

1. **LLM Safety Filters**
   - Harassment: `BLOCK_LOW_AND_ABOVE`
   - Hate Speech: `BLOCK_LOW_AND_ABOVE`
   - Dangerous Content: `BLOCK_LOW_AND_ABOVE`
   - Sexually Explicit: `BLOCK_LOW_AND_ABOVE`

2. **Content Constraints**
   - Lexile Level: 400L–600L (simple, short sentences)
   - No violence, scary themes, or ambiguous social cues
   - Age-appropriate visual styles

3. **PII Protection**
   - Use first names or nicknames only (never full names)
   - No personally identifiable information sent to AI APIs
   - Session data stored securely in database

### Error Handling

- If LLM fails: Returns error message, safe mode possible
- If image generation fails: Story continues without image
- If JSON parsing fails: Logs error and throws exception

---

## System Prompts Explained

### Initialization Prompt (`system-prompt-init.xml`)

**Purpose:** Generate the first story node (Node 0)

**Key Instructions:**
- Establish visual style based on age
- Create character anchor for consistency
- Generate story with behavioral choices
- Output strict JSON (no markdown)

**Few-Shot Examples:** Included for younger (5-9) and older (10-12+) children

### Continuation Prompt (`system-prompt-cont.xml`)

**Purpose:** Generate subsequent story nodes (Node 1+)

**Key Instructions:**
- Use immutable visual_style and character_anchor
- Generate consequence based on child's choice
- Determine if story should end (turn >= 5 + positive choice)
- Output strict JSON

**Consequence Logic:**
- **Positive Choice:** Immediate reward, advance plot
- **Negative Choice:** Gentle consequence, offer redemption
- **Ending:** Triggered at turn 5+ with positive choice

---

## Context Management Strategy

### Sliding Window Approach

To prevent token overflow and hallucinations:

**What We Send:**
- Target behavior (always)
- Previous node text (only the last one)
- Child's specific choice
- Visual anchors (style + character)
- Turn count

**What We DON'T Send:**
- Full conversation history
- All previous nodes
- Detailed session metadata

**Why?** The LLM only needs immediate context to generate the next consequence.

---

## Image Consistency Implementation

### Node 0 (Text-to-Image)
```typescript
const imageUrl = await imageGeneration.generateImage(
  visual_context // Full prompt from LLM
);
```

### Node 1+ (Image-to-Image)
```typescript
const imageUrl = await imageGeneration.editImage(
  previousImageUrl,  // Reference image
  visual_context,    // New prompt from LLM
  0.65               // Strength (balance)
);
```

**Strength Parameter:**
- `< 0.4`: Too much change, loses character consistency
- `0.6 - 0.7`: **Sweet spot** (recommended)
- `> 0.8`: Ignores new prompt, copies old image

---

## Database Schema

### Session State Cache

**In-Memory Storage** (SessionsService):
```typescript
{
  sessionId: string;
  visualStyle: string;        // From Node 0
  characterAnchor: string;    // From Node 0
  lastNodeText: string;       // Rolling context
  lastImageUrl: string;       // For image editing
  turnCount: number;          // For ending detection
  targetBehavior: string;     // Behavioral goal
}
```

**Production Note:** Consider Redis for distributed systems.

### Database Models

- **Session:** Active/completed sessions
- **StoryNode:** Individual story segments with choices
- **Choice:** Behavioral options (Positive/Negative/Neutral)
- **Interaction:** Logs of child decisions (for analytics)

---

## Migration Guide

### 1. Run Database Migration

```bash
# Create .env file if not exists
cp .env.example .env

# Edit .env and add all required values
# DATABASE_URL, GEMINI_API_KEY, NANO_BANANA_API_KEY

# Generate Prisma client
pnpm prisma:generate

# Run migration to update schema
pnpm prisma:migrate
```

### 2. Verify Installation

```bash
# Start the server
pnpm start:dev

# Test the health endpoint
curl http://localhost:3000
```

### 3. Test Story Initialization

**Prerequisites:**
- Create a CHILD user
- Get JWT token

```bash
# Initialize a session
curl -X POST http://localhost:3000/sessions/initialize \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "childId": "YOUR_CHILD_ID",
    "childName": "Alex",
    "childAge": 7,
    "targetBehavior": "Sharing",
    "characterName": "Dino the Dinosaur",
    "setting": "Sunny playground sandbox",
    "emotionalTone": "Playful and warm"
  }'
```

---

## Performance Optimization

### Context Caching (Future Enhancement)

Google Gemini supports context caching:

```typescript
// Upload system prompts to cache (TTL: 24 hours)
const cachedPrompt = await genAI.cacheContent({
  model: 'gemini-1.5-flash',
  contents: [{ text: systemPrompt }],
  ttl: '86400s', // 24 hours
});

// Reference cache in subsequent calls
const chat = model.startChat({
  cachedContent: cachedPrompt.name,
});
```

**Benefits:**
- Reduced token usage (~90% for system prompts)
- Lower latency (~30-50ms faster)
- Cost savings

---

## Troubleshooting

### Common Issues

**1. "GEMINI_API_KEY not found"**
- Ensure `.env` file exists
- Verify GEMINI_API_KEY is set
- Restart the server

**2. "Session state not found"**
- Session cache cleared (server restart)
- Session may have expired
- Re-initialize the session

**3. "Image generation failed"**
- Check NANO_BANANA_API_KEY
- Verify API quota
- System falls back to text-only mode

**4. "JSON Parse Error"**
- LLM returned invalid JSON
- Check system prompt formatting
- Review safety filters (may block output)

---

## Future Enhancements

### Planned Features

1. **Text-to-Speech Integration**
   - Read story nodes aloud
   - Accessibility feature

2. **Therapist Review Dashboard**
   - Approve/reject AI-generated nodes
   - Pause sessions for review (low confidence scores)

3. **Behavioral Analytics**
   - Track choice patterns
   - Generate progress reports
   - Visualize skill improvement

4. **Template-Based Sessions**
   - Allow therapists to create reusable templates
   - Pre-define story structures
   - Customize behavioral goals

5. **Multi-Language Support**
   - Translate stories in real-time
   - Support for non-English speakers

---

## Support

For issues or questions:
1. Check this documentation
2. Review error logs in the console
3. Verify API keys and quotas
4. Test with simple examples first

## License

This implementation is part of the CNC Backend project.
