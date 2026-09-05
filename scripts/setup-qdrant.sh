#!/usr/bin/env bash
# One-time Qdrant setup after restoring the fusion snapshots.
# Safe to re-run: creating an index that already exists is a no-op.
#
# Usage: ./scripts/setup-qdrant.sh [qdrant-url]
set -euo pipefail

QDRANT_URL="${1:-http://localhost:6333}"

echo "Creating payload indexes on ${QDRANT_URL}/collections/fusion_tables ..."

curl -sf -X PUT "${QDRANT_URL}/collections/fusion_tables/index" \
  -H 'Content-Type: application/json' \
  -d '{"field_name": "doc_section", "field_schema": "keyword"}' >/dev/null
echo "  doc_section index ok"

curl -sf -X PUT "${QDRANT_URL}/collections/fusion_tables/index" \
  -H 'Content-Type: application/json' \
  -d '{"field_name": "doc_module", "field_schema": "keyword"}' >/dev/null
echo "  doc_module index ok"

echo "Done."
