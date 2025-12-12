#!/bin/bash

# Test Dummy Google Login Endpoint
# This script tests the backend Google dummy login endpoint

echo "🧪 Testing Dummy Google Login..."
echo ""
echo "Endpoint: POST /api/v1/auth/google/dummy"
echo "Request body:"
echo '{
  "email": "test@example.com",
  "name": "Test User"
}'
echo ""

response=$(curl -s -X POST http://localhost:8080/api/v1/auth/google/dummy \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "name": "Test User"
  }')

echo "Response:"
echo "$response" | jq '.'

if echo "$response" | jq -e '.access_token' > /dev/null 2>&1; then
  echo ""
  echo "✅ Dummy Google login successful!"
  echo "Token: $(echo "$response" | jq -r '.access_token' | cut -c1-50)..."
else
  echo ""
  echo "❌ Login failed"
  echo "Response: $response"
  exit 1
fi
