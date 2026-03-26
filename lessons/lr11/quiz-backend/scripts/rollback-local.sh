#!/bin/bash

set -e

echo "=== Rolling back ==="

docker compose down
docker compose up -d

echo "=== Waiting ==="
sleep 5

echo "=== Healthcheck after rollback ==="

STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health || true)

if [ "$STATUS" -eq 200 ]; then
  echo "Rollback successful"
else
  echo "Rollback failed"
  exit 1
fi