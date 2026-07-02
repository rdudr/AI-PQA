#!/bin/bash
# ── HF Spaces startup script ──
# Launches the FastAPI backend and Nginx in a single container.

set -e

echo "=========================================="
echo "  AI Power Quality Analyzer"
echo "  Starting backend + frontend..."
echo "=========================================="

# Ensure config directories exist for the backend
mkdir -p /app/backend/config/mappings

# Start FastAPI backend in background
cd /app
python -m uvicorn backend.main:app \
    --host 127.0.0.1 \
    --port 8000 \
    --log-level info &

# Wait for backend to be ready
echo "Waiting for backend to start..."
for i in $(seq 1 30); do
    if curl -s http://127.0.0.1:8000/api/health > /dev/null 2>&1; then
        echo "Backend is ready!"
        break
    fi
    sleep 1
done

# Start Nginx in foreground (keeps container alive)
echo "Starting Nginx on port 7860..."
exec nginx -g "daemon off;"
