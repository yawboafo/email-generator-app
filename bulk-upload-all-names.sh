#!/bin/bash

# Bulk upload all CSV files from name dataset folder
# This script uploads all country name CSV files to the email generator app
# Note: This uses a Node.js helper script to parse CSV and send JSON

DATA_FOLDER="/Users/nykb/Desktop/name_dataset/data"
LOG_FILE="bulk-upload-$(date +%Y%m%d-%H%M%S).log"
UPLOAD_SCRIPT="/Users/nykb/email-generator-app/upload-csv-helper.js"
APP_DIR="/Users/nykb/email-generator-app"

echo "==================================="
echo "BULK NAME UPLOAD SCRIPT (RAILWAY)"
echo "==================================="
echo "Data Folder: $DATA_FOLDER"
echo "Log File: $LOG_FILE"
echo "==================================="
echo ""

# Check if railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "✗ Railway CLI not found. Please install it first:"
    echo "  npm i -g @railway/cli"
    exit 1
fi

echo "Checking Railway configuration..."
cd "$APP_DIR"

# Check if project is linked
if ! railway status &> /dev/null; then
    echo "✗ Not linked to a Railway project."
    echo "  Run: railway link"
    exit 1
fi

# Get Railway domain
RAILWAY_DOMAIN=$(railway domain 2>&1 | grep -oE 'https://[^[:space:]]+' | head -1)

if [ -z "$RAILWAY_DOMAIN" ]; then
    echo "✗ Could not detect Railway domain. Please ensure your service has a domain configured."
    echo "  Run: railway domain"
    exit 1
fi

API_ENDPOINT="${RAILWAY_DOMAIN}/api/admin/import/bulk-names-fast"

echo "✓ Railway project linked"
echo "✓ Domain: $RAILWAY_DOMAIN"
echo "✓ API Endpoint: $API_ENDPOINT"
echo ""

# Counter variables
total_files=0
successful_uploads=0
failed_uploads=0
total_imported=0
total_skipped=0

# Create log file
echo "Starting bulk upload at $(date)" > "$LOG_FILE"

# Loop through all CSV files
for csv_file in "$DATA_FOLDER"/*.csv; do
    # Skip if no CSV files found
    if [ ! -f "$csv_file" ]; then
        echo "No CSV files found in $DATA_FOLDER"
        exit 1
    fi
    
    # Extract filename and country code
    filename=$(basename "$csv_file")
    country_code="${filename%.csv}"
    
    total_files=$((total_files + 1))
    
    echo "[$total_files] Processing: $filename (Country: $country_code)"
    echo "-----------------------------------"
    
    # Get file size for display
    file_size=$(du -h "$csv_file" | cut -f1)
    echo "File size: $file_size"
    
    # Upload using Node.js helper script with Railway environment
    echo "Uploading to API via Railway..."
    
    response=$(railway run node "$UPLOAD_SCRIPT" "$csv_file" "$API_ENDPOINT" 2>&1)
    upload_status=$?
    
    # Extract HTTP status and body from response
    http_status=$(echo "$response" | grep "HTTP_STATUS:" | cut -d: -f2)
    body=$(echo "$response" | sed '/HTTP_STATUS:/d')
    
    # Log the response
    echo "[$filename] Status: $http_status" >> "$LOG_FILE"
    echo "[$filename] Response: $body" >> "$LOG_FILE"
    echo "" >> "$LOG_FILE"
    
    # Check if successful
    if [ "$http_status" = "200" ]; then
        successful_uploads=$((successful_uploads + 1))
        
        # Try to extract imported/skipped counts from response
        imported=$(echo "$body" | grep -o '"imported":[0-9]*' | cut -d: -f2)
        skipped=$(echo "$body" | grep -o '"skipped":[0-9]*' | cut -d: -f2)
        
        if [ -n "$imported" ] && [ -n "$skipped" ]; then
            total_imported=$((total_imported + imported))
            total_skipped=$((total_skipped + skipped))
            echo "✓ SUCCESS: $imported imported, $skipped skipped"
        else
            echo "✓ SUCCESS (check response for details)"
        fi
        
        echo "$body" | head -5
    else
        failed_uploads=$((failed_uploads + 1))
        echo "✗ FAILED: HTTP $http_status"
        echo "$body" | head -10
    fi
    
    echo ""
    echo "-----------------------------------"
    echo ""
    
    # Add a small delay between uploads to avoid overwhelming the server
    sleep 2
done

# Final summary
echo "==================================="
echo "UPLOAD COMPLETE"
echo "==================================="
echo "Total files processed: $total_files"
echo "Successful uploads: $successful_uploads"
echo "Failed uploads: $failed_uploads"
echo "Total records imported: $total_imported"
echo "Total records skipped: $total_skipped"
echo "==================================="
echo "Detailed log saved to: $LOG_FILE"
echo ""

# Exit with appropriate code
if [ $failed_uploads -gt 0 ]; then
    exit 1
else
    exit 0
fi
