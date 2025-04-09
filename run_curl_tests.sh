#!/bin/bash

# Script to run a sequence of curl tests against the local API

BASE_URL="http://localhost:3001/api"

echo "--- Starting API Test Sequence ---"

# 1. Create Session
echo "[1] Creating new session..."
response=$(curl -s -X POST -H "Content-Type: application/json" $BASE_URL/sessions)
echo "    Response: $response"

# Extract sessionId using grep and sed (basic, potentially fragile)
SESSION_ID=$(echo "$response" | grep -o '"sessionId":"[^"]*"' | sed 's/"sessionId":"\(.*\)"/\1/')

echo "    Extracted SESSION_ID: $SESSION_ID"

if [ -z "$SESSION_ID" ] || [ "$SESSION_ID" == "null" ]; then
  echo "ERROR: Could not extract SESSION_ID from response. Exiting."
  exit 1
fi

# 2. Submit Answer (is_bankrupt = false)
echo "\n[2] Submitting answer (is_bankrupt=false)..."
curl -s -X POST -H "Content-Type: application/json" \
  -d '{"questionKey":"is_bankrupt", "answerValue":false}' \
  $BASE_URL/sessions/$SESSION_ID/answers
echo # newline

# 3. Get Next Question (expecting is_ex_bankrupt_discharged_lt_2y)
echo "\n[3] Getting next question..."
curl -s $BASE_URL/sessions/$SESSION_ID/next_question
echo # newline

# 4. Get Eligible Products (expecting product 29 to be included)
echo "\n[4] Getting eligible products..."
curl -s $BASE_URL/sessions/$SESSION_ID/eligible_products
echo # newline

# 5. Change Answer (is_bankrupt = true)
echo "\n[5] Changing answer (is_bankrupt=true)..."
curl -s -X PATCH -H "Content-Type: application/json" \
  -d '{"answerValue":true}' \
  $BASE_URL/sessions/$SESSION_ID/answers/is_bankrupt
echo # newline

# 6. Get Eligible Products Again (expecting product 29 to be excluded)
echo "\n[6] Getting eligible products after PATCH..."
curl -s $BASE_URL/sessions/$SESSION_ID/eligible_products
echo # newline

echo "\n--- Test Sequence Complete ---" 