#!/bin/bash

# Retry Failed CSV Uploads
# This script retries only the files that failed during bulk upload

LOG_FILE="${1:-bulk-upload-20251202-211947.log}"
DATA_DIR="${2:-/Users/nykb/Desktop/name_dataset/data}"
API_URL="${3:-http://localhost:3000/api/admin/bulk-import}"

if [ ! -f "$LOG_FILE" ]; then
  echo "Error: Log file not found: $LOG_FILE"
  echo "Usage: $0 <log-file> [data-dir] [api-url]"
  exit 1
fi

echo "==================================="
echo "Retrying Failed CSV Uploads"
echo "==================================="
echo "Log file: $LOG_FILE"
echo "Data directory: $DATA_DIR"
echo "API URL: $API_URL"
echo ""

# Create new log file
RETRY_LOG="retry-upload-$(date +%Y%m%d-%H%M%S).log"
echo "Starting retry at $(date)" | tee "$RETRY_LOG"
echo "" | tee -a "$RETRY_LOG"

# Extract failed files (those with Status: 000)
FAILED_FILES=$(grep "Status: 000" "$LOG_FILE" | grep -oE '\[[A-Z]{2}\.csv\]' | tr -d '[]' | sort -u)

if [ -z "$FAILED_FILES" ]; then
  echo "No failed files found in log (Status: 000)"
  echo ""
  
  # Check for partial failures (files that started but didn't complete)
  echo "Checking for incomplete uploads..."
  INCOMPLETE_FILES=$(grep -E "Error - (read ECONNRESET|write EPIPE)" "$LOG_FILE" | grep -oE 'Uploading chunk [0-9]+/[0-9]+' | awk '{print $NF}' | sort -u)
  
  # Extract country codes from context before error
  INCOMPLETE_COUNTRIES=$(grep -B 20 "Error - read ECONNRESET\|Error - write EPIPE" "$LOG_FILE" | grep "\.csv\]" | grep -oE '\[[A-Z]{2}\.csv\]' | tr -d '[]' | sort -u)
  
  if [ -n "$INCOMPLETE_COUNTRIES" ]; then
    echo "Found incomplete uploads:"
    echo "$INCOMPLETE_COUNTRIES"
    echo ""
    FAILED_FILES="$INCOMPLETE_COUNTRIES"
  else
    echo "No incomplete uploads found."
    exit 0
  fi
fi

# Count files
TOTAL_FAILED=$(echo "$FAILED_FILES" | wc -l | tr -d ' ')
echo "Found $TOTAL_FAILED failed file(s) to retry:"
echo "$FAILED_FILES"
echo ""
echo "==================================="
echo ""

COUNTER=0
SUCCESS_COUNT=0
FAIL_COUNT=0

for FILE in $FAILED_FILES; do
  COUNTER=$((COUNTER + 1))
  CSV_PATH="$DATA_DIR/$FILE"
  
  echo "[$COUNTER/$TOTAL_FAILED] Retrying: $FILE" | tee -a "$RETRY_LOG"
  
  if [ ! -f "$CSV_PATH" ]; then
    echo "  ✗ File not found: $CSV_PATH" | tee -a "$RETRY_LOG"
    FAIL_COUNT=$((FAIL_COUNT + 1))
    echo "" | tee -a "$RETRY_LOG"
    continue
  fi
  
  # Show file size
  FILE_SIZE=$(ls -lh "$CSV_PATH" | awk '{print $5}')
  echo "  File size: $FILE_SIZE" | tee -a "$RETRY_LOG"
  
  # Run upload with improved script
  {
    echo "  Starting upload at $(date)..."
    node upload-csv-helper.js "$CSV_PATH" "$API_URL" 2>&1
    EXIT_CODE=$?
    
    if [ $EXIT_CODE -eq 0 ]; then
      echo "  ✓ Upload completed successfully" | tee -a "$RETRY_LOG"
      SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    else
      echo "  ✗ Upload failed with exit code $EXIT_CODE" | tee -a "$RETRY_LOG"
      FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
  } | tee -a "$RETRY_LOG"
  
  echo "" | tee -a "$RETRY_LOG"
  
  # Small delay between files to avoid overwhelming the server
  sleep 2
done

echo "==================================="
echo "Retry Summary"
echo "==================================="
echo "Total files: $TOTAL_FAILED"
echo "Successful: $SUCCESS_COUNT"
echo "Failed: $FAIL_COUNT"
echo ""
echo "Full log saved to: $RETRY_LOG"
echo "Finished at $(date)"
