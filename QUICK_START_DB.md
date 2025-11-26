# 🎯 Quick Reference: Database Setup

## Railway Setup (5 minutes)

```bash
# 1. In Railway Dashboard
New → Database → Add PostgreSQL

# 2. Railway auto-sets DATABASE_URL for your app
# No manual config needed!

# 3. Push schema (creates all tables)
npx prisma db push

# 4. Seed with existing JSON data
npm run db:seed

# 5. Deploy!
git push
```

## Local Development

```bash
# 1. Install & start Postgres
brew install postgresql@16
brew services start postgresql@16

# 2. Create database
createdb emailgen

# 3. Create .env file
echo 'DATABASE_URL="postgresql://$(whoami)@localhost:5432/emailgen?schema=public"' > .env

# 4. Push schema
npm run db:push

# 5. Seed data
npm run db:seed

# 6. Start dev server
npm run dev
```

## Import Large Datasets (100MB+)

```bash
# 1. Create data-sources directory
mkdir data-sources

# 2. Download datasets:
# - US Census names: https://www.ssa.gov/oact/babynames/limits.html
# - US Census surnames: https://www.census.gov/topics/population/genealogy/data/2010_surnames.html
# - GeoNames cities: https://download.geonames.org/export/dump/cities15000.zip

# 3. Place files in data-sources/:
data-sources/
  ├── yob2023.txt           (US first names)
  ├── Names_2010Census.csv  (US surnames)
  └── cities15000.txt       (World cities)

# 4. Run import
npm run db:import

# Done! You now have millions of names
```

## Useful Commands

```bash
npm run db:generate    # Generate Prisma Client
npm run db:push        # Push schema to database
npm run db:seed        # Seed with JSON data
npm run db:import      # Import large datasets
npm run db:studio      # Open visual DB editor
npm run build          # Build (includes Prisma gen)
```

## Database Tables

| Table | Records (Initial) | Records (After Import) |
|-------|-------------------|------------------------|
| Country | 6 | 6 |
| FirstName | ~1,000 | ~1,000,000+ |
| LastName | ~500 | ~162,000+ |
| City | ~200 | ~25,000+ |
| EmailProvider | 8 | 8 |
| PatternElement | ~250 | ~250 |

## Troubleshooting

**"Prisma Client not found"**
```bash
npm run db:generate
```

**"Can't connect to database"**
- Check DATABASE_URL in .env
- Ensure Postgres is running: `brew services list`
- Verify Railway Postgres is provisioned

**"Seed script fails"**
```bash
# Push schema first
npm run db:push

# Then seed
npm run db:seed
```

**"Import script fails"**
```bash
# Check files exist
ls -la data-sources/

# Check file format matches expected format
head data-sources/yob2023.txt
```

## Performance Tips

✅ **Use batch inserts** (1000 records per batch)  
✅ **Add indexes** (already done in schema)  
✅ **Use connection pooling** (already done in prisma.ts)  
✅ **Skip duplicates** on import  
✅ **Monitor with Prisma Studio** (`npm run db:studio`)  

## Cost

**Railway Postgres:**
- Hobby: $5/month (1GB storage)
- Pro: $20/month (10GB storage)
- Scale: $50+/month (100GB+ storage)

**For 100MB dataset:** Hobby plan is perfect!

## What's Different?

| Before (JSON) | After (Database) |
|---------------|------------------|
| ~100KB files | 100MB+ database |
| In-memory loading | Indexed queries |
| Limited to ~10K names | Millions of names |
| Static data only | Dynamic + analytics |
| No user features | Save emails, history |
| File-based | Scalable DB |

## Next Steps After Setup

1. ✅ **Test email generation** - Should work exactly as before
2. ✅ **Import large datasets** - Scale to 100MB+
3. ✅ **Add more countries** - Expand globally
4. ✅ **Enable SavedEmails feature** - Use SavedEmail table
5. ✅ **Track analytics** - Use EmailGeneration table
6. ✅ **Monitor performance** - Use Prisma Studio

---

**Need help?** Check:
- `DATABASE_SETUP.md` - Detailed setup guide
- `DATABASE_MIGRATION_COMPLETE.md` - Migration details
- `DATABASE_SUMMARY.md` - Overview & benefits
