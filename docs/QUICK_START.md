# Quick Start Guide - Scene-On Backend

## Issue: Login Endpoint Returning 404

**Problem:** The `/api/v1/auth/google/dummy` endpoint isn't working.  
**Root Cause:** Backend server needs PostgreSQL and Redis running.

## Quick Fix Steps

### 1. Start PostgreSQL

```bash
# Check if PostgreSQL is installed
which psql

# If installed, start it (macOS with Homebrew)
brew services start postgresql@14

# Or if using postgres.app, just launch the app

# Create database and user
psql postgres << EOF
CREATE DATABASE scene_on;
CREATE USER postgres WITH PASSWORD 'postgres';
GRANT ALL PRIVILEGES ON DATABASE scene_on TO postgres;
\q
EOF
```

### 2.Start Redis

```bash
# Check if Redis is installed
which redis-server

# Start Redis (macOS with Homebrew)
brew services start redis

# Verify it's running
redis-cli ping
# Should return: PONG
```

### 3. Start Backend

```bash
cd /Users/lubdhakmahapatra/Codebase/scene-on/backend
make run
```

You should see:
```
✓ Database connected successfully
✓ Database migrations completed
✓ Redis connected successfully
🚀 Server starting on port 8080
```

### 4. Test Login

```bash
curl -X POST http://localhost:8080/api/v1/auth/google/dummy \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "name": "Test User"}'
```

Should return:
```json
{
  "access_token": "eyJhbGc...",
  "user_id": "uuid-here",
  "email": "test@example.com"
}
```

### 5. Use Web Login

Navigate to `http://localhost:8081/login` and enter any email/name!

## If You Don't Have PostgreSQL/Redis

### Option 1: Install via Homebrew (Recommended)
```bash
brew install postgresql@14 redis
brew services start postgresql@14
brew services start redis
```

### Option 2: Use Docker
```bash
# PostgreSQL
docker run -d --name scene-on-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=scene_on \
  -p 5432:5432 \
  postgres:14

# Redis
docker run -d --name scene-on-redis \
  -p 6379:6379 \
  redis:7
```

### Option 3: Temporarily Skip DB (Web Only)
I can create a mock auth version that doesn't need a database for quick testing.

## Current Status

- ✅ Backend code compiles
- ✅ Dummy Google login endpoint added  
- ✅ Web login page created
- ⏸️ Waiting for PostgreSQL + Redis to start
- 🎯 Ready to test login once DB is running

## Next Steps

1. Start PostgreSQL and Redis (choose method above)
2. Run `make run` in backend directory
3. Visit `http://localhost:8081/login`
4. Enter any email/name and sign in!
