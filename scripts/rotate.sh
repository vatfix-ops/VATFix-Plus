#!/usr/bin/env bash
# Rotates an integration key (requires TEST_ISSUER_SECRET) or a customer key (no Bearer).
set -euo pipefail


BASE_URL=${BASE_URL:-"https://plus.vatfix.eu"}
API_KEY=${API_KEY:-""}
EMAIL=${EMAIL:-"integration-testing@zapier.com"}
ISSUER=${ISSUER_SECRET:-""} # optional; needed only for integration keys


if [ -z "$API_KEY" ]; then
echo "ERROR: set API_KEY env var" >&2; exit 1
fi


AUTH_HEADER=()
if [ -n "$ISSUER" ]; then AUTH_HEADER=(-H "Authorization: Bearer $ISSUER"); fi


curl -sS -X POST "$BASE_URL/reset" \
"${AUTH_HEADER[@]}" \
-H "Content-Type: application/json" \
-H "x-api-key: $API_KEY" \
-H "x-customer-email: $EMAIL"#!/usr/bin/env bash
# Rota