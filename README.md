---
title: AI Power Quality Analyzer
emoji: ⚡
colorFrom: blue
colorTo: purple
sdk: docker
app_port: 7860
---

# AI Power Quality Analyzer ⚡

An AI-powered web application designed to parse, align, and analyze Power Quality (PQ) telemetry data from various industrial analyzer models. It processes electrical metrics (voltage, current, power factor, THD, harmonics), runs anomaly detection rules, and outputs compliance reports alongside interactive dashboards.

---

## 🚀 Key Features

* **Multi-File Upload & Time-Alignment** — Upload multiple telemetry exports (Excel/CSV). The backend automatically handles parsing, sorting, deduplication, and highlights any time gaps.
* **Smart Column Mapping** — Custom mapping engine that automatically normalizes and maps vendor-specific headers to a universal schema.
* **Interactive Visualization** — Dynamic charts for voltage/current profiles, active/reactive power, harmonics spectrum, power factor, and unbalance.
* **AI Anomaly Detection** — Automated classification of events like voltage sags, swells, transients, and high THD.
* **Compliance Checks** — Standard compliance reports based on **IEEE 519**, **EN 50160**, and **IEC 61000**.
* **PDF Report Generation** — Export print-ready reports containing analysis summaries, metrics tables, and charts.

---

## 🛠️ Technology Stack

* **Frontend:** React, TypeScript, Vite, Tailwind CSS, ECharts (for performant charting).
* **Backend:** FastAPI, Python 3.11, Pandas & PyArrow (for high-speed data frame manipulation).
* **Database:** PostgreSQL (with lazy pool setup, fallback to in-memory mode if DB is disconnected).
* **Deployment:** Nginx (static server + reverse proxy) & Uvicorn inside a single Docker container.

---

## 💻 Local Development

### Prerequisites
* Windows PC (recommended for native local scripts)
* Python 3.11+
* Node.js 20+

### Instant Startup (Windows)
1. Double-click the **`install.bat`** file to create python virtual environments and install packages automatically.
2. Double-click the **`start.bat`** file. This will automatically spin up:
   * Python backend on `http://localhost:8000`
   * Vite frontend on `http://localhost:5173`
   * Opens the application in your default browser.

---

## ☁️ Deployment on Hugging Face Spaces

This repository is optimized to run on **Hugging Face Spaces (Docker SDK)**.

### Why Hugging Face?
* **16 GB RAM Free Tier** — Easily handles large telemetry uploads (such as 300MB+ multi-file bundles) that exceed standard cloud memory limits.
* **Automatic Port Binding** — Configured to run Nginx on port `7860` to comply with Hugging Face Space requirements.

### Quick Setup Steps
1. Create a **New Space** on Hugging Face, select **Docker** as the SDK, and choose the **Blank** template.
2. Set up your local project repository with the Space as a Git remote:
   ```bash
   git remote add hf https://huggingface.co/spaces/YOUR_USERNAME/YOUR_SPACE_NAME
   ```
3. Push the main branch to Hugging Face:
   ```bash
   git push hf main --force
   ```
4. The container will build and deploy automatically.

---

## 🗄️ Database & History Persistence

By default, the application keeps analysis history in-memory (resets when the container restarts). To make history permanent:

1. Create a PostgreSQL database (e.g., via a free **Supabase** instance).
2. Add a `DATABASE_URL` environment variable in your deployment platform settings (Hugging Face Space Secrets, Render Env, or local system environment):
   ```env
   DATABASE_URL=postgresql://user:password@your-db-host.supabase.co:5432/postgres
   ```
3. The backend will automatically detect the database on startup, initialize the schemas, and begin saving all historical session data.
