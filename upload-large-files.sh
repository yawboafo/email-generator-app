#!/bin/bash

# Handle Large CSV Files (SA.csv and US.csv)
# These files are too large to read into memory at once
# This script uses the improved streaming upload helper

DATA_DIR="${1:-/Users/nykb/Desktop/name_dataset/data}"
API_URL="${2:-https://email-generator-app-production.up.railway.app/api/admin/import/bulk-names-stream}"

echo "==================================="
echo "Uploading Large CSV Files"
echo "==================================="
echo "Data directory: $DATA_DIR"
echo "API URL: $API_URL"
echo ""

# Large files that need streaming
LARGE_FILES=("SA.csv" "US.csv")

LOG_FILE="large-upload-$(date +%Y%m%d-%H%M%S).log"
echo "Starting large file upload at $(date)" | tee "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

for FILE in "${LARGE_FILES[@]}"; do
  CSV_PATH="$DATA_DIR/$FILE"
  
  echo "Processing: $FILE" | tee -a "$LOG_FILE"
  
  if [ ! -f "$CSV_PATH" ]; then
    echo "  ✗ File not found: $CSV_PATH" | tee -a "$LOG_FILE"
    echo "" | tee -a "$LOG_FILE"
    continue
  fi
  
  # Show file size
  FILE_SIZE=$(ls -lh "$CSV_PATH" | awk '{print $5}')
  echo "  File size: $FILE_SIZE" | tee -a "$LOG_FILE"
  echo "  Using streaming parser for large file..." | tee -a "$LOG_FILE"
  
  # Run direct file upload (server-side streaming)
  {
    echo "  Starting upload at $(date)..."
    node upload-csv-direct.js "$CSV_PATH" "$API_URL" "add" 2>&1
    EXIT_CODE=$?
    
    if [ $EXIT_CODE -eq 0 ]; then
      echo "  ✓ Upload completed successfully" | tee -a "$LOG_FILE"
    else
      echo "  ✗ Upload failed with exit code $EXIT_CODE" | tee -a "$LOG_FILE"
    fi
  } | tee -a "$LOG_FILE"
  
  echo "" | tee -a "$LOG_FILE"
  
  # Delay between large files
  sleep 5
done

echo "==================================="
echo "Finished at $(date)"
echo "Full log saved to: $LOG_FILE"
