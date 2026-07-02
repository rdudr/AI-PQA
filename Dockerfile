# ============================================================
#  AI Power Quality Analyzer — Hugging Face Spaces Dockerfile
#  Single container: Nginx (frontend) + Uvicorn (backend API)
#  HF Spaces expects the app on port 7860.
# ============================================================

# ── Stage 1: Build the React frontend ──────────────────────
FROM node:20-slim AS frontend-build
WORKDIR /build

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --ignore-scripts

COPY frontend/ ./
RUN npm run build


# ── Stage 2: Runtime (Python + Nginx) ──────────────────────
FROM python:3.11-slim

# Install Nginx and curl (for health check in start.sh)
RUN apt-get update && \
    apt-get install -y --no-install-recommends nginx curl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source
COPY backend/ ./backend/

# Copy built frontend into Nginx's serve directory
COPY --from=frontend-build /build/dist /usr/share/nginx/html

# Copy Nginx config
COPY nginx.conf /etc/nginx/nginx.conf

# Copy startup script
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

# HF Spaces requires port 7860
EXPOSE 7860

CMD ["/app/start.sh"]
