# Database Setup Guide

## Railway Postgres Setup

### 1. Add Postgres to Railway Project

1. Go to your Railway dashboard
2. Select your email-generator-app project
3. Click "New" → "Database" → "Add PostgreSQL"
4. Railway will automatically provision a Postgres database

### 2. Connect Your App to Database

Railway automatically sets the `DATABASE_URL` environment variable for your deployed app. No manual configuration needed!

### 3. Run Migrations

After deploying, run migrations to create tables:

```bash
# In Railway dashboard, go to your service settings
# Add this to "Deploy" command or run manually:
npx prisma db push
```

### 4. Seed the Database

Seed your database with initial data from JSON files:

```bash
npm run db:seed
```

## Local Development Setup

### 1. Install PostgreSQL locally

**macOS (using Homebrew):**
```bash
brew install postgresql@16
brew services start postgresql@16
```

**Or use Docker:**
```bash
docker run --name emailgen-postgres -e POSTGRES_PASSWORD=password -p 5432:5432 -d postgres:16
```

### 2. Create Local Database

```bash
createdb emailgen
```

### 3. Set Environment Variable

Create `.env` file (copy from `.env.example`):

```bash
DATABASE_URL="postgresql://your-username:your-password@localhost:5432/emailgen?schema=public"
```

**For Docker:**
```bash
DATABASE_URL="postgresql://postgres:password@localhost:5432/emailgen?schema=public"
```

### 4. Generate Prisma Client

```bash
npm run db:generate
```

### 5. Push Schema to Database

```bash
npm run db:push
```

### 6. Seed Database

```bash
npm run db:seed
```

## Database Tables

The schema includes:

- **Country** - Stores country metadata (code, name)
- **FirstName** - First names by country and gender
- **LastName** - Surnames by country
- **City** - Cities by country
- **EmailProvider** - Email provider configurations
- **PatternElement** - Pattern components (pet names, hobbies, cities)
- **SavedEmail** - User-saved emails
- **EmailGeneration** - Generation history for analytics

## Useful Commands

```bash
# Generate Prisma Client (run after schema changes)
npm run db:generate

# Push schema changes to database (dev only)
npm run db:push

# Seed database with initial data
npm run db:seed

# Open Prisma Studio (visual database editor)
npm run db:studio

# Create a migration (production)
npx prisma migrate dev --name your_migration_name
```

## Adding Large Datasets

To import your large name datasets (100MB+):

1. Download your data sources (US Census, philipperemy/name-dataset, etc.)
2. Create a custom import script in `prisma/import-large-data.ts`
3. Use batch inserts for performance:

```typescript
await prisma.firstName.createMany({
  data: largeNameArray,
  skipDuplicates: true,
});
```

4. Run with: `tsx prisma/import-large-data.ts`

## Troubleshooting

**Connection refused:**
- Ensure PostgreSQL is running: `brew services list` or `docker ps`
- Check DATABASE_URL is correct

**Permission denied:**
- Grant permissions: `GRANT ALL PRIVILEGES ON DATABASE emailgen TO your_username;`

**Prisma Client not found:**
- Run: `npm run db:generate`

## Railway-Specific Notes

- DATABASE_URL is automatically injected by Railway
- Use `npx prisma db push` for schema updates (no migrations needed)
- Database backups are automatic
- Check Railway dashboard for connection details and monitoring
