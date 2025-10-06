# Setup and Migration Guide

## Current Status

The chatbot application has been successfully migrated from localStorage to PostgreSQL with JWT authentication. Here's what has been implemented:

### ✅ Completed Features

1. **Database Schema (Prisma)**
   - User model with password hashing
   - ChatSession model for organizing conversations
   - Message model with JSON storage for message parts
   - Proper relationships and cascading deletes

2. **Authentication System**
   - JWT-based auth with HTTP-only cookies
   - Registration and login endpoints
   - Password hashing with bcrypt
   - Secure token management (7-day expiry)
   - Profile endpoint for user info

3. **Session Management APIs**
   - GET /api/sessions - List all user sessions
   - POST /api/sessions - Create new session
   - GET /api/sessions/[id] - Get session with messages
   - DELETE /api/sessions/[id] - Delete session
   - PATCH /api/sessions/[id] - Update session title

4. **Chat Persistence**
   - Messages saved to database via onFinish callback
   - Sessions automatically updated with timestamps
   - Auth protection on all chat endpoints

5. **UI Components**
   - ChatSidebar component with session list
   - User profile dropdown with logout
   - Login and registration pages
   - Protected main chat page
   - Session switching without duplicates
   - Proper loading states

6. **State Management**
   - Session-aware chat state
   - No duplicate rendering
   - Clean transitions between chats
   - Proper error handling

## 🚀 Next Steps

### 1. Start PostgreSQL Database

**Option A: Using Docker (Recommended)**
```bash
docker run --name chatbot-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=devak@123 \
  -e POSTGRES_DB=chatbot \
  -p 5432:5432 \
  -d postgres:15
```

**Option B: Using Existing PostgreSQL**
Make sure your PostgreSQL service is running and the credentials in `.env` are correct.

### 2. Run Database Migrations

Once PostgreSQL is running:

```bash
# Generate Prisma Client
npx prisma generate

# Create database tables
npx prisma migrate dev --name init

# Optional: View database in browser
npx prisma studio
```

### 3. Start the Development Server

```bash
npm run dev
```

### 4. Test the Application

1. Navigate to http://localhost:3000
2. You'll be redirected to /login
3. Click "Sign up" and create an account
4. Start chatting!

## Environment Variables

Your `.env` file should have:

```env
DATABASE_URL=postgresql://postgres:devak@123@localhost:5432/chatbot?schema=public
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-please-make-it-long-and-random
AI_GATEWAY_API_KEY=vck_71NXZ57HyTuiMIqakUPKGSY481iCmh7DLm0ICTL4ZxyS6y1cED32mHTy
TAVILY_API_KEY=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
```

## Architecture Overview

### Database Schema

```prisma
User {
  id: String (cuid)
  email: String (unique)
  password: String (hashed)
  name: String?
  sessions: ChatSession[]
}

ChatSession {
  id: String (cuid)
  userId: String
  title: String
  messages: Message[]
  timestamps
}

Message {
  id: String (cuid)
  sessionId: String
  role: String (user|assistant|system)
  content: Json (message parts)
  timestamp
}
```

### Authentication Flow

1. User registers/logs in
2. Server creates JWT with userId + email
3. JWT stored in HTTP-only cookie (7-day expiry)
4. Every API request validates JWT
5. User data isolated by userId in queries

### Session Management Flow

1. User creates new chat → POST /api/sessions
2. Returns sessionId
3. Chat messages sent with sessionId in body
4. Messages persisted via onFinish callback
5. User switches chat → GET /api/sessions/[id]
6. Messages loaded from database
7. No localStorage usage

## Key Implementation Details

### Message Persistence

Messages are saved in the `/api/chat` route using streamText's `onFinish` callback:

```typescript
onFinish: async ({ text, usage }) => {
  // Save user message
  await prisma.message.create({
    data: {
      sessionId,
      role: 'user',
      content: lastUserMessage,
    },
  });

  // Save assistant response
  await prisma.message.create({
    data: {
      sessionId,
      role: 'assistant',
      content: {
        role: 'assistant',
        parts: [{ type: 'text', text }],
      },
    },
  });
}
```

### Session Switching

Clean session transitions without duplicates:

```typescript
const loadSession = useCallback(async (sessionId: string) => {
  setLoadingSession(true);
  const res = await fetch(`/api/sessions/${sessionId}`);
  const data = await res.json();
  const sessionMessages = data.session.messages.map(msg => ({
    id: msg.id,
    role: msg.role,
    parts: msg.content.parts,
  }));
  setMessages(sessionMessages);
  setCurrentSessionId(sessionId);
  setLoadingSession(false);
}, [setMessages]);
```

### Authentication Guard

All protected routes check authentication:

```typescript
const currentUser = await getCurrentUser();
if (!currentUser) {
  return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
}
```

## Troubleshooting

### "Can't reach database server"
- Verify PostgreSQL is running: `docker ps` or check service status
- Test connection: `psql -U postgres -h localhost -p 5432`
- Check DATABASE_URL format

### "Property 'user' does not exist on PrismaClient"
- Run: `npx prisma generate`
- Restart TypeScript server in VS Code

### Authentication not working
- Clear browser cookies
- Verify JWT_SECRET in .env
- Check browser console for errors

### Messages not saving
- Check server console for database errors
- Verify sessionId is being passed
- Ensure Prisma migrations ran successfully

## Production Checklist

Before deploying:

- [ ] Change JWT_SECRET to strong random string
- [ ] Use production PostgreSQL (not local)
- [ ] Enable HTTPS (cookies set to secure)
- [ ] Set proper CORS policies
- [ ] Add rate limiting
- [ ] Configure proper backup strategy
- [ ] Set up monitoring/logging
- [ ] Test database connection pooling
- [ ] Review Prisma query performance

## Additional Features to Consider

1. **Password Reset Flow**
   - Email-based password reset
   - Token expiration handling

2. **Session Titles**
   - Auto-generate from first message
   - Manual title editing

3. **Message Search**
   - Full-text search across messages
   - Filter by date/session

4. **Export/Import**
   - Export chat history
   - Import from other platforms

5. **Sharing**
   - Share specific conversations
   - Public/private sessions

6. **Collaboration**
   - Multi-user sessions
   - Real-time updates

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review Prisma logs: `npx prisma studio`
3. Check server console output
4. Verify all environment variables are set

Good luck! 🚀
