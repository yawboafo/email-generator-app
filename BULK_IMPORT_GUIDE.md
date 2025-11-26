# Bulk Name Import Guide

## Overview

The admin dashboard now supports bulk import of name datasets in the philipperemy/name-dataset CSV format. This feature is designed to handle large datasets (millions of records) with real-time progress tracking.

## 🚀 Quick Start

### 1. Seed Countries First

Before importing names, you must have countries in your database:

```bash
npm run db:seed-countries
```

This will import all 106 countries from the philipperemy/name-dataset.

### 2. Access Admin Dashboard

Navigate to: `http://localhost:3000/admin`

### 3. Select "Bulk Names (CSV)" Tab

This tab is specifically designed for the philipperemy/name-dataset format.

### 4. Upload CSV File

**Expected CSV Format:**
```csv
first_name,last_name,gender,country_code
Laure,Canet,F,FR
Louis,Givran,M,FR
Timothy,Dovin,M,FR
Anne Marie,Petiton,F,FR
```

**Column Descriptions:**
- `first_name` - First name (required)
- `last_name` - Last name (optional)
- `gender` - M (male), F (female), or empty (neutral)
- `country_code` - ISO alpha-2 country code (must exist in database)

### 5. Choose Import Mode

- **Add Mode (Skip Duplicates)** - Only imports new records, skips existing ones
- **Replace Mode (Upsert)** - Updates existing records or creates new ones

### 6. Monitor Progress

Real-time progress tracking shows:
- ✅ Current stage (uploading, parsing, validating, importing, complete)
- 📊 Progress percentage and record counts
- 🔢 Current batch / total batches
- ⚡ Estimated time remaining
- 📈 Imported / skipped / error counts
- ❌ Error messages (first 10 displayed)

## 📊 Progress Stages

1. **Uploading** - File is being uploaded to the server
2. **Parsing** - CSV is being parsed and validated
3. **Validating** - Data format and country codes are being validated
4. **Importing** - Records are being inserted into database (batch by batch)
5. **Complete** - Import finished successfully
6. **Error** - Import failed (errors are displayed)

## ⚙️ Technical Details

### Batch Processing
- Files are processed in batches of **5,000 records**
- Each batch takes approximately 2-5 seconds
- Progress is updated after each batch completes

### Performance
- **Add Mode**: Uses `createMany` with `skipDuplicates` (faster)
- **Replace Mode**: Uses `upsert` for each record (slower but updates existing)

### Data Validation
- Records without `first_name` are skipped
- Records with invalid `country_code` are skipped with error message
- Gender is automatically mapped: M → male, F → female, empty → neutral
- Both first names and last names are imported separately

### Database Schema
```typescript
FirstName {
  id: string
  name: string
  gender: 'male' | 'female' | 'neutral'
  frequency: number? (optional)
  countryId: string
  country: Country
}

LastName {
  id: string
  name: string
  frequency: number? (optional)
  countryId: string
  country: Country
}
```

## 🎯 Best Practices

### For Small Datasets (<10,000 records)
- Use either mode
- Import completes in seconds

### For Medium Datasets (10,000 - 100,000 records)
- Use **Add Mode** for initial import
- Use **Replace Mode** for updates
- Import takes 1-5 minutes

### For Large Datasets (>100,000 records)
- Use **Add Mode** recommended
- Keep browser tab open during import
- Monitor progress for any errors
- Import may take 10+ minutes depending on size

## 🚨 Common Issues

### "Country not found" Errors
**Cause**: CSV contains country codes that don't exist in database

**Solution**: 
1. Run `npm run db:seed-countries` first
2. Or manually import missing countries via Countries tab

### Import Stuck/Slow
**Cause**: Large batch size or slow network

**Solution**:
- Keep browser tab active
- Don't close or refresh during import
- Check Railway database metrics for performance

### Duplicate Records
**Cause**: Running Replace mode multiple times

**Solution**:
- Use Add Mode for incremental imports
- Duplicates are based on (name + countryId) unique constraint

## 📈 Import Statistics

After import completes, you'll see:
- **Imported**: Number of records successfully added
- **Skipped**: Number of duplicate records skipped
- **Errors**: Number of invalid records with error messages

Dashboard stats are automatically refreshed to show updated counts.

## 🔧 API Endpoint

The bulk import uses: `POST /api/admin/import/bulk-names`

**Request Body:**
```json
{
  "data": [...], // Array of CSV rows
  "mode": "add" | "replace",
  "batch": 0, // Current batch number
  "totalRecords": 50000 // Total records in file
}
```

**Response:**
```json
{
  "success": true,
  "imported": 4850,
  "skipped": 150,
  "errors": [],
  "batch": 0,
  "processed": 5000
}
```

## 💡 Tips

1. **Test with small files first** - Upload 100-1000 records to verify format
2. **Import countries first** - Always seed countries before importing names
3. **Use Add Mode initially** - Faster for first-time imports
4. **Monitor errors** - Review error messages to fix data issues
5. **Keep backups** - Use `pg_dump` before large imports in production

## 📞 Need Help?

Check these files:
- `ADMIN_DASHBOARD_GUIDE.md` - General admin dashboard guide
- `DATABASE_README.md` - Complete database documentation
- `DATABASE_SETUP.md` - Initial database setup

---

**Bulk Import Feature** - Supports philipperemy/name-dataset format with real-time progress tracking
