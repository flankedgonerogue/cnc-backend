# Chronicles N Conversations - Setup Guide

## Quick Setup

### 1. Install Dependencies (Already Done ✅)

The following packages have been installed:
- `@google/generative-ai` - Gemini AI SDK for story generation

### 2. Configure Environment Variables

Add these to your `.env` file:

```env
# Chronicles N Conversations Engine - AI Configuration
GEMINI_API_KEY=your-gemini-api-key-here
```

#### Getting API Keys

**Gemini API Key:**
1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Click "Create API Key"
3. Copy the key to your `.env`

### 3. Update Database Schema

Run Prisma migrations to add the Chronicles N Conversations tables:

```bash
# Create .env if not exists
cp .env.example .env

# Edit .env and add all required values (DATABASE_URL, API keys, etc.)

# Generate Prisma client
pnpm prisma:generate

# Run migration
pnpm prisma:migrate
```

### 4. Start the Server

```bash
pnpm start:dev
```

The server will start at `http://localhost:3000`.

### 5. Test the Integration

#### A. Create a Test User (CHILD role)

```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testchild@example.com",
    "password": "password123",
    "role": "CHILD"
  }'
```

Save the `access_token` from the response.

#### B. Initialize a Story Session

```bash
curl -X POST http://localhost:3000/sessions/initialize \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "childId": "YOUR_CHILD_ID_FROM_REGISTRATION",
    "childName": "Alex",
    "childAge": 7,
    "targetBehavior": "Sharing",
    "characterName": "Dino the Dinosaur",
    "setting": "Sunny playground sandbox",
    "emotionalTone": "Playful and warm"
  }'
```

You should receive:
- Story text
- Image URL
- Two choices (Positive and Negative)
- Visual style and character anchor

#### C. Make a Choice (Continue Story)

```bash
curl -X POST http://localhost:3000/sessions/choice \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "SESSION_ID_FROM_INIT",
    "choiceText": "Give shovel"
  }'
```

The story will continue based on the choice!

---

## What Was Integrated

### New Files Created

**Services:**
- `src/story/story.service.ts` - Story loop, nodes, interactions, analytics
- `src/story/gemini/gemini.service.ts` - Gemini (text, image, TTS) integration
- `src/story/prompt/prompt.service.ts` - System prompt loading for story flows

**System Prompts:**
- `src/prompts/system-prompt-init.xml` - Initialization prompt (Node 0)
- `src/prompts/system-prompt-cont.xml` - Continuation prompt (Node 1+)

**Sessions Module:**
- `src/sessions/sessions.service.ts` - Game loop orchestration
- `src/sessions/sessions.controller.ts` - REST API endpoints
- `src/sessions/sessions.module.ts` - Module configuration
- `src/sessions/dto/initialize-session.dto.ts` - Input validation
- `src/sessions/dto/make-choice.dto.ts` - Choice input
- `src/sessions/dto/session-response.dto.ts` - Response shapes

**Documentation:**
- `docs/CHRONICLES_N_CONVERSATIONS.md` - Complete technical guide
- `docs/SETUP_CHRONICLES.md` - This setup guide

### Database Changes

**Updated Models:**
- `Session.templateId` is now optional (allows AI-generated sessions without templates)

**No new migrations needed** - The schema already had all necessary tables:
- `Session`
- `StoryNode`
- `Choice`
- `Interaction`

### Updated Files

- `src/app.module.ts` - Added SessionsModule
- `.env.example` - Gemini and storage-related keys
- `README.md` - Added Chronicles N Conversations overview
- `prisma/schema.prisma` - Made templateId optional

---

## Architecture Overview

```
Frontend Client
      ↓
REST / GraphQL (sessions, story)
      ↓
SessionsService — session assignment & listing
StoryService — start/continue story, choices, nodes, CSE, analytics
      ↓
GeminiService — LLM narrative, image, and TTS via Google Generative AI
PromptService — system prompts for init/continuation
StorageService — persist generated assets (local or S3)
      ↓
Database (Prisma)
- Session
- StoryNode
- Choice
- Interaction
```

---

## Key Features Implemented

### ✅ Story Generation (Gemini AI)
- System prompts for initialization and continuation
- Strict JSON output parsing
- Safety filters (harassment, hate speech, dangerous content)
- Context management (sliding window strategy)
- Few-shot examples for consistency

### ✅ Media (Gemini + storage)
- Images and optional audio generated via `GeminiService`, uploaded via `StorageService`
- Continuation can use prior frame for consistency when available

### ✅ Game Loop
- Session state caching (visual style, character anchor)
- Turn counting and ending detection
- Choice logging for analytics
- Database persistence

### ✅ Safety & Privacy
- PII protection (first names only)
- Age-appropriate content (Lexile 400L-600L)
- No violence, scary themes, or ambiguous cues
- Safety filters on all AI generations

---

## Troubleshooting

### "GEMINI_API_KEY not found"
- Verify `.env` file exists
- Check that GEMINI_API_KEY is set
- Restart the server after adding keys

### "Session state not found"
- Session cache is in-memory (clears on restart)
- Re-initialize the session

### "Image generation failed"
- Check `GEMINI_API_KEY` and Gemini image model configuration
- Verify API quota/limits
- System continues without image (text-only mode)

### Prisma Generation Fails
- Ensure DATABASE_URL is set in `.env`
- Run `pnpm prisma:generate` again
- Check PostgreSQL connection

---

## Next Steps

1. **Test the Full Flow**
   - Initialize session
   - Make 5-6 choices
   - Verify ending detection

2. **Review Documentation**
   - Read `docs/CHRONICLES_N_CONVERSATIONS.md` for technical details
   - Understand system prompts in `src/prompts/`

3. **Integrate with Frontend**
   - Use `/sessions/initialize` endpoint
   - Display story text and image
   - Send choices via `/sessions/choice`

4. **Monitor Performance**
   - Check API usage (Gemini)
   - Review session completion rates
   - Analyze choice patterns in database

---

## Support

For detailed technical documentation, see:
- `docs/CHRONICLES_N_CONVERSATIONS.md`

For API endpoint details, see:
- `README.md` (Key Endpoints section)

For backend setup, see:
- `docs/QUICK_START.md`
