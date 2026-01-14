# Scene-On Deployment & Development Guide

This guide details the commands to launch the Database, Backend (BE), and Frontend (FE) in both Development (Local) and Production environments.

## 📂 Database (`/database`)

The database setup is managed via the `Makefile` in the `database/` directory.

### **Development (Local)**
*   **Prerequisite:** Ensure PostgreSQL 17 and PostGIS are installed locally (or via Docker).
*   **Launch Command:** None (Database runs as a system service).
*   **Setup/Reset Command:**
    ```bash
    cd database
    make db-postgis  # Creates user, DB, and enables PostGIS
    ```
*   **Verify:**
    ```bash
    cd database
    make db-info     # Shows connection details from dev.env
    ```

### **Production (Neon)**
*   **Launch Command:** Managed by Neon (Serverless).
*   **Connection:** Logic in Backend connects via `DATABASE_URL` found in `backend/prod.env` (or Render Environment Variables).

---

## ⚙️ Backend (`/backend`)

The backend is a Go application using Gin.

### **Development (Local)**
*   **Environment:** Uses `dev.env`.
*   **Auto-Reload:** Enabled (via `air`).
*   **Command:**
    ```bash
    cd backend
    make dev
    ```
    *(Or simply `make run` for a standard run without auto-reload).*

### **Production (Render)**
*   **Environment:** Uses Environment Variables set in Render Dashboard (or `prod.env` if copied manually, but Render Dashboard variables are preferred).
*   **Build Command (in Render):**
    ```bash
    make build-prod
    ```
*   **Start Command (in Render):**
    ```bash
    ./app
    ```

---

## 💻 Frontend (`/frontend`)

The frontend is a React application using Vite.

### **Development (Local)**
*   **Environment:** Uses `dev.env`.
*   **Command:**
    ```bash
    cd frontend
    make dev
    ```
    *Access at `http://localhost:5173`*

### **Production (Vercel/Render Static)**
*   **Environment:** Uses Environment Variables defined in Vercel/Render Project Settings.
*   **Build Command:**
    ```bash
    make build   # Internally runs 'npm run build'
    ```
*   **Output Directory:** `dist`
*   **Install Command:**
    ```bash
    make install # Internally runs 'npm install'
    ```

---

## 🚀 Summary Cheat Sheet

| Component | Environment | Directory | Command |
| :--- | :--- | :--- | :--- |
| **DB** | Local | `database/` | `make db-postgis` (One-time setup) |
| **BE** | Local | `backend/` | `make dev` |
| **BE** | Prod (Build) | `backend/` | `make build-prod` |
| **BE** | Prod (Start) | `backend/` | `./app` |
| **FE** | Local | `frontend/` | `make dev` |
| **FE** | Prod (Build) | `frontend/` | `make build` |
