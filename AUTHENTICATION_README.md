# 🔐 Multi-User Authentication System

## Overview

The email management platform now supports **full multi-user authentication** with secure user workspaces and data isolation.

## Features Implemented

### ✅ User Authentication
- **JWT-based authentication** with HTTP-only cookies
- **Password hashing** using bcrypt (12 rounds)
- **Secure session management** (7-day token expiration)
- **Protected API routes** via middleware
- **Client-side auth context** with React hooks

### ✅ User Registration & Login
- `/signup` - Create new account with validation
- `/login` - Secure login with credentials
- `/api/auth/me` - Get current user data
- `/api/auth/logout` - Clear session and logout

Password Requirements:
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

### ✅ User Isolation & Private Workspaces
All user data is isolated by `userId`:
- ✅ **Jobs** - Background tasks (generation, verification, scraping)
- ✅ **Email Records** - Generated email history
- ✅ **Saved Emails** - User's saved email collections

### ✅ Global Shared Data
These tables are **shared system-wide** (not per-user):
- 🌍 **Countries** - Country data with demographics
- 🌍 **FirstNames** - Name database by country/gender
- 🌍 **LastNames** - Surname database by country
- 🌍 **Cities** - City data with populations
- 🌍 **EmailProviders** - Email domain providers
- 🌍 **PatternElements** - Email pattern components
- 🌍 **Patterns** - Email generation templates

### ✅ Protected Routes
All sensitive API routes require authentication:
- `/api/generate-emails*`
- `/api/verify-emails*`
- `/api/scrape-emails*`
- `/api/send-emails*`
- `/api/jobs*`
- `/api/ai-generate*`
- `/api/find-emails*`

Returns **401 Unauthorized** if not logged in.
Returns **403 Forbidden** if accessing another user's data.

### ✅ UI Enhancements
- **User profile menu** in header with avatar
- **Logout functionality**
- **Protected route wrapper** (redirects to login if not authenticated)
- **Login/Register pages** with modern UI
- **Session persistence** across page refresh

## Database Schema Changes

### New Tables
```prisma
model User {
  id            String         @id @default(cuid())
  email         String         @unique
  password      String
  name          String?
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
  jobs          Job[]
  emailRecords  EmailRecord[]
  savedEmails   SavedEmail[]
}
```

### Updated Tables
- `Job` - Added `userId` foreign key (required)
- `SavedEmail` - Added `userId` foreign key (required)
- `EmailRecord` - Added `userId` foreign key (required)

All with **CASCADE DELETE** - user deletion removes all their data.

## Usage

### For Users
1. **Sign Up**: Navigate to `/signup` and create an account
2. **Login**: Use `/login` to access your workspace
3. **Work**: All generated emails, jobs, and saves are private to your account
4. **Logout**: Use user menu in header

### For Developers

#### Accessing Current User in API Routes
```typescript
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // Use currentUser.userId for filtering
  const jobs = await prisma.job.findMany({
    where: { userId: currentUser.userId }
  });
  
  return NextResponse.json({ jobs });
}
```

#### Using Auth Context in Components
```typescript
import { useAuth } from '@/contexts/AuthContext';

function MyComponent() {
  const { user, logout, loading } = useAuth();
  
  if (loading) return <div>Loading...</div>;
  if (!user) return <div>Please login</div>;
  
  return (
    <div>
      <p>Welcome, {user.name}!</p>
      <button onClick={logout}>Logout</button>
    </div>
  );
}
```

## Security Features

### ✅ Password Security
- Bcrypt hashing with salt rounds: 12
- Passwords never stored in plain text
- Passwords never sent in API responses

### ✅ Session Security
- HTTP-only cookies (not accessible via JavaScript)
- Secure flag in production (HTTPS only)
- SameSite: Lax (CSRF protection)
- 7-day expiration with automatic refresh

### ✅ API Security
- Middleware validates JWT on all protected routes
- User ownership verification before data access
- 401 for authentication failures
- 403 for authorization failures

### ✅ Input Validation
- Zod schemas for all auth inputs
- Email format validation
- Password strength requirements
- SQL injection protection via Prisma

## Environment Variables

Required in `.env`:
```bash
DATABASE_URL="postgresql://..."
JWT_SECRET="your-secret-key-change-this-in-production"
```

**⚠️ Important**: Change `JWT_SECRET` in production!

## Migration Notes

### Existing Data
- Old jobs without `userId` will remain but are inaccessible
- New users start fresh with clean workspace
- Consider running cleanup scripts for legacy data

### Future Improvements
- Password reset functionality
- Email verification
- OAuth integration (Google, GitHub)
- Two-factor authentication (2FA)
- User profile management
- Admin panel for user management

## Testing

### Manual Testing
1. Create a new user at `/signup`
2. Login at `/login`
3. Generate emails (should be tied to your account)
4. Logout and create second user
5. Verify you can't see first user's data

### Test Credentials (if needed)
You can create test users via the signup page or use the script:
```bash
npx tsx scripts/create-test-user.ts
```

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/me` - Get current user

### Protected Endpoints
All job-related endpoints now require authentication:
- `POST /api/jobs` - Create job (auto-assigns to current user)
- `GET /api/jobs/list` - List user's jobs only
- `GET /api/jobs/[id]` - Get job (ownership verified)
- `DELETE /api/jobs/[id]` - Delete job (ownership verified)
- `POST /api/jobs/[id]/cancel` - Cancel job (ownership verified)
- `GET /api/jobs/[id]/stream` - Stream job progress (ownership verified)

## Troubleshooting

### "Unauthorized" errors
- Check if user is logged in
- Verify JWT_SECRET is set
- Check cookie is being sent with requests

### "Forbidden" errors
- User is authenticated but accessing another user's data
- Verify ownership checks in API routes

### Session expires too quickly
- Increase token expiration in `lib/auth.ts`:
  ```typescript
  .setExpirationTime('30d') // 30 days instead of 7
  ```

## Support

For issues or questions:
1. Check this README
2. Review code comments in `lib/auth.ts`
3. Check middleware configuration
4. Review Prisma schema

---

**Built with**: Next.js 15, Prisma, PostgreSQL, JWT, bcrypt, Zod
