#!/bin/bash
# API Endpoint Test Script
# Run with: ./scripts/test-api.sh
# Requires: dev server running on localhost:3000

set -e
BASE_URL="${BASE_URL:-http://localhost:3000}"
EMAIL="${TEST_EMAIL:-test-$(date +%s)@example.com}"
PASSWORD="Test1234"
DISPLAY_NAME="Test User"

echo "=========================================="
echo "Moni API Endpoint Tests"
echo "=========================================="
echo "Base URL: $BASE_URL"
echo "Test email: $EMAIL"
echo ""

# 1. Register
echo "=== 1. Register ==="
REGISTER_RESP=$(curl -s -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"displayName\":\"$DISPLAY_NAME\"}")
echo "$REGISTER_RESP" | jq . 2>/dev/null || echo "$REGISTER_RESP"

if echo "$REGISTER_RESP" | grep -q '"error"'; then
  echo "Note: If 'email rate limit exceeded', wait a few minutes or use existing user."
  echo "Trying login with test@example.com..."
  EMAIL="test@example.com"
  LOGIN_RESP=$(curl -s -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
else
  # 2. Login (use same creds as register)
  echo ""
  echo "=== 2. Login ==="
  LOGIN_RESP=$(curl -s -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
fi

echo "$LOGIN_RESP" | jq . 2>/dev/null || echo "$LOGIN_RESP"

TOKEN=$(echo "$LOGIN_RESP" | jq -r '.session.access_token // .access_token // empty')
if [ -z "$TOKEN" ]; then
  echo ""
  echo "Could not get access token. Create a user in Supabase Dashboard first:"
  echo "  Authentication > Users > Add user"
  echo "  Or wait for rate limit to reset and run register again."
  echo ""
  echo "Testing unauthenticated endpoints..."
else
  echo ""
  echo "Token obtained successfully."
  echo ""

  # 3. List categories
  echo "=== 3. List Categories ==="
  curl -s "$BASE_URL/api/categories" -H "Authorization: Bearer $TOKEN" | jq . 2>/dev/null || curl -s "$BASE_URL/api/categories" -H "Authorization: Bearer $TOKEN"
  echo ""

  # 4. Create wallet
  echo "=== 4. Create Wallet ==="
  curl -s -X POST "$BASE_URL/api/wallets" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"name":"My Wallet","type":"bank","currency":"USD","initialBalance":1000,"color":"#0066FF","icon":"🏦"}' | jq . 2>/dev/null
  echo ""

  # 5. List wallets
  echo "=== 5. List Wallets ==="
  curl -s "$BASE_URL/api/wallets" -H "Authorization: Bearer $TOKEN" | jq . 2>/dev/null
  echo ""

  # 6. List transactions
  echo "=== 6. List Transactions ==="
  curl -s "$BASE_URL/api/transactions" -H "Authorization: Bearer $TOKEN" | jq . 2>/dev/null
  echo ""

  # 7. List tags
  echo "=== 7. List Tags ==="
  curl -s "$BASE_URL/api/tags" -H "Authorization: Bearer $TOKEN" | jq . 2>/dev/null
  echo ""

  # 8. Analytics overview
  echo "=== 8. Analytics Overview ==="
  curl -s "$BASE_URL/api/analytics/overview" -H "Authorization: Bearer $TOKEN" | jq . 2>/dev/null
fi

echo ""
echo "=========================================="
echo "Validation & Auth Tests"
echo "=========================================="
echo "=== Register validation (expect 400) ==="
curl -s -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"bad"}' | jq . 2>/dev/null
echo ""
echo "=== Categories without auth (expect 401) ==="
curl -s "$BASE_URL/api/categories" | jq . 2>/dev/null
echo ""
echo "=========================================="
echo "Tests complete!"
echo "=========================================="
