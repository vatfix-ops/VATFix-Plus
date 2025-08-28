#!/usr/bin/env bash
set -euo pipefail


BASE_URL=${BASE_URL:-"https://plus.vatfix.eu"}
ISSUER=${ISSUER:-""}
EMAIL=${EMAIL:-"integration-testing@zapier.com"}
LABEL=${LABEL:-"Zapier Reviewer"}


if [ -z "$ISSUER" ]; then
echo "ERROR: set ISSUER=\"<TEST_ISSUER_SECRET>\"" >&2
exit 1
fi


curl -sS -X POST "$BASE_URL/test/issue" \
-H "Authorization: Bearer $ISSUER" \
-H "Content-Type: application/json" \
--data "{\"email\":\"$EMAIL\",\"label\":\"$LABEL\"}"