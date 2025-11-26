# Admin Dashboard Guide

## 🎯 Overview

The admin dashboard provides a web interface for importing data into your PostgreSQL database. You can import:
- Countries
- First Names
- Last Names
- Cities
- Email Providers
- Pattern Elements

## 🚀 Access the Dashboard

**URL:** `http://localhost:3000/admin` (local) or `https://your-domain.com/admin` (production)

## 📊 Features

### 1. Database Statistics
- Real-time counts of all records
- Visual overview of database health
- Refreshes automatically after imports

### 2. Multi-Tab Interface
- Separate tabs for each data type
- Context-specific format examples
- Easy navigation

### 3. File Upload
- Drag & drop or click to upload
- Supports JSON and CSV formats
- Live preview of parsed data (first 5 rows)

### 4. Import Modes

**Add Mode (Skip Duplicates):**
- Only inserts new records
- Skips records that already exist
- Safe for incremental imports

**Replace Mode (Upsert):**
- Updates existing records
- Creates new records if they don't exist
- Use for updating data

### 5. Batch Processing
- Processes 1000 records at a time
- Prevents memory issues
- Shows progress and results

## 📁 Data Formats

### Countries
**JSON:**
```json
[
  { "code": "US", "name": "United States" },
  { "code": "UK", "name": "United Kingdom" }
]
```

**CSV:**
```csv
code,name
US,United States
UK,United Kingdom
```

### First Names
**JSON:**
```json
[
  { "name": "John", "gender": "male", "countryCode": "US", "frequency": 100 },
  { "name": "Jane", "gender": "female", "countryCode": "US", "frequency": 95 }
]
```

**CSV:**
```csv
name,gender,countryCode,frequency
John,male,US,100
Jane,female,US,95
```

**Gender values:** `male`, `female`, `neutral`

### Last Names
**JSON:**
```json
[
  { "name": "Smith", "countryCode": "US", "frequency": 1000 },
  { "name": "Johnson", "countryCode": "US", "frequency": 950 }
]
```

**CSV:**
```csv
name,countryCode,frequency
Smith,US,1000
Johnson,US,950
```

### Cities
**JSON:**
```json
[
  { "name": "New York", "countryCode": "US", "population": 8336817 },
  { "name": "Los Angeles", "countryCode": "US", "population": 3979576 }
]
```

**CSV:**
```csv
name,countryCode,population
New York,US,8336817
Los Angeles,US,3979576
```

### Email Providers
**JSON:**
```json
[
  { 
    "providerId": "gmail",
    "name": "Gmail",
    "domain": "gmail.com",
    "popularity": 45,
    "active": true
  }
]
```

**CSV:**
```csv
providerId,name,domain,popularity,active
gmail,Gmail,gmail.com,45,true
yahoo,Yahoo,yahoo.com,20,true
```

### Pattern Elements
**JSON:**
```json
[
  { "type": "petNames", "value": "luna" },
  { "type": "hobbies", "value": "gamer" },
  { "type": "cities", "value": "newyork" }
]
```

**CSV:**
```csv
type,value
petNames,luna
hobbies,gamer
cities,newyork
```

**Pattern types:** `petNames`, `cities`, `hobbies`, `adjectives`, `colors`, `years`

## 🔄 Import Workflow

1. **Select Tab** - Choose the data type to import
2. **Choose Mode** - Add (skip duplicates) or Replace (upsert)
3. **Upload File** - Drag & drop or click to select JSON/CSV
4. **Preview Data** - Review first 5 rows
5. **Import** - Click button to start import
6. **Review Results** - See imported/skipped counts and errors

## ⚠️ Important Notes

### Prerequisites
- **Countries must exist** before importing first names, last names, or cities
- Country codes must match (e.g., "US", "UK", "GH")
- Database must be set up and connected (DATABASE_URL)

### Data Validation
- Invalid records are skipped automatically
- First 10 errors are shown in results
- Check console logs for detailed errors

### Performance
- Files are processed in batches of 1000
- Large files (100MB+) may take several minutes
- Don't close the browser during import

### Limitations
- **frequency** and **population** fields are optional
- **active** field defaults to `true` for providers
- Duplicate detection based on unique constraints

## 🛠️ Troubleshooting

### "Country not found"
- Import countries first
- Check country code spelling (case-sensitive)
- Use ISO 2-letter codes (US, UK, etc.)

### "Skipping invalid record"
- Check required fields are present
- Verify field names match exactly
- Remove empty rows from CSV

### "Failed to import"
- Check DATABASE_URL is set
- Verify database connection
- Run `npm run db:push` to ensure schema is up to date

### CSV not parsing correctly
- Ensure first row has headers
- Use commas as delimiters
- Enclose text with commas in quotes

## 📈 Best Practices

1. **Start Small** - Test with 10-100 records first
2. **Import Countries First** - Required for other data types
3. **Use Add Mode** - For initial imports
4. **Use Replace Mode** - For updates/corrections
5. **Backup First** - Use `pg_dump` before large imports
6. **Monitor Stats** - Check record counts after import
7. **Review Errors** - Fix source data and re-import

## 🔒 Security Considerations

### For Production:
1. **Add Authentication** - Protect /admin route
2. **Use Environment Variables** - Store admin credentials
3. **Rate Limiting** - Prevent abuse
4. **IP Whitelisting** - Restrict access
5. **Audit Logging** - Track who imports what

### Quick Auth Example (Next.js Middleware):
```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/admin')) {
    const authHeader = request.headers.get('authorization');
    const token = process.env.ADMIN_TOKEN;
    
    if (authHeader !== `Bearer ${token}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }
  
  return NextResponse.next();
}
```

## 💡 Tips

- **JSON is faster** for small datasets (<1MB)
- **CSV is better** for large datasets from spreadsheets
- **Frequency weights** affect random selection probability
- **Population data** enables weighted city selection
- **Test imports locally** before production
- **Keep source files** for re-importing if needed

## 🎓 Example Use Cases

### 1. Import US Census Data
1. Download from https://www.ssa.gov/oact/babynames/
2. Convert to JSON/CSV with name, gender, countryCode
3. Import via First Names tab

### 2. Import GeoNames Cities
1. Download cities15000.zip
2. Extract and convert to CSV
3. Import via Cities tab

### 3. Add New Country
1. Import country via Countries tab
2. Then import names, cities for that country

### 4. Update Provider Popularity
1. Export current providers
2. Update popularity values
3. Re-import with Replace mode

## 📞 Support

Need help? Check:
- `DATABASE_SETUP.md` - Database setup
- `DATABASE_README.md` - Complete database guide
- `QUICK_START_DB.md` - Quick reference

---

**Admin Dashboard v1.0** - Built with Next.js, Prisma, and PostgreSQL
