#!/bin/bash

set -e

TAG="quiz-backend:release-$(date +%Y%m%d%H%M%S)"

echo "=== Building image $TAG ==="
docker build -t $TAG .

echo "=== Stopping old containers ==="
docker compose down

echo "=== Starting new version ==="
docker compose up -d

echo "=== Waiting for app ==="
sleep 5

echo "=== Healthcheck ==="

MAX_ATTEMPTS=5
ATTEMPT=1

while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health || true)

  if [ "$STATUS" -eq 200 ]; then
    echo "Healthcheck OK"
    exit 0
  fi

  echo "Attempt $ATTEMPT failed..."
  sleep 2
  ATTEMPT=$((ATTEMPT+1))
done

echo "Healthcheck failed"
exit 1