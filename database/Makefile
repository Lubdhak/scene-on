SHELL := /bin/bash

# ---------------------------------------------------------------------
# Database Configuration
# ---------------------------------------------------------------------
# Load env vars from dev.env by default if it exists, otherwise use defaults
ifneq (,$(wildcard ./dev.env))
    include dev.env
    export
endif

# Default values if not set in env
DB_SUPERUSER ?= $(shell whoami)
DB_NAME      ?= scene_on
DB_USER      ?= scene_user
DB_PASSWORD  ?= scene_pass
DB_HOST      ?= localhost
DB_PORT      ?= 5432

# PostgreSQL 17 paths (adjust if needed or rely on PATH)
PSQL := $(shell command -v psql 2>/dev/null)
PG_CTL := $(shell command -v pg_ctl 2>/dev/null)

# Fallback to Homebrew path if not in PATH (as per original makefile)
ifeq ($(PSQL),)
	PSQL := /opt/homebrew/opt/postgresql@17/bin/psql
endif

.PHONY: help db-bootstrap db-create db-postgis db-drop db-info

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-20s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# ---------------------------------------------------------------------
# Database Operations
# ---------------------------------------------------------------------
db-bootstrap: ## Ensure postgres superuser exists (Homebrew fix)
	@echo "Ensuring postgres role exists..."
	@$(PSQL) -U $(DB_SUPERUSER) -d postgres -tc \
		"SELECT 1 FROM pg_roles WHERE rolname='postgres'" | grep -q 1 || \
		$(PSQL) -U $(DB_SUPERUSER) -d postgres -c \
		"CREATE ROLE postgres WITH LOGIN SUPERUSER PASSWORD 'postgres';"

db-create: db-bootstrap ## Create app DB user and database
	@echo "Ensuring DB user '$(DB_USER)' exists..."
	@$(PSQL) -U postgres -tc \
		"SELECT 1 FROM pg_roles WHERE rolname='$(DB_USER)'" | grep -q 1 || \
		$(PSQL) -U postgres -c \
		"CREATE ROLE $(DB_USER) WITH LOGIN PASSWORD '$(DB_PASSWORD)';"

	@echo "Ensuring DB '$(DB_NAME)' exists..."
	@$(PSQL) -U postgres -tc \
		"SELECT 1 FROM pg_database WHERE datname='$(DB_NAME)'" | grep -q 1 || \
		$(PSQL) -U postgres -c \
		"CREATE DATABASE $(DB_NAME) OWNER $(DB_USER);"

	@$(PSQL) -U postgres -c \
		"GRANT ALL PRIVILEGES ON DATABASE $(DB_NAME) TO $(DB_USER);"
	@$(PSQL) -U postgres -d $(DB_NAME) -c \
		"GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO $(DB_USER);"
	@$(PSQL) -U postgres -d $(DB_NAME) -c \
		"ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO $(DB_USER);"

db-postgis: db-create ## Enable PostGIS extension in database
	@echo "Checking PostGIS availability..."
	@if $(PSQL) -U postgres -d $(DB_NAME) -c "CREATE EXTENSION IF NOT EXISTS postgis;" 2>&1 | grep -q "could not open extension control file"; then \
		echo "⚠ PostGIS not installed. Installing..."; \
		if command -v brew > /dev/null; then \
			echo "Installing PostGIS via Homebrew..."; \
			brew install postgis && \
			echo "Retrying PostGIS extension creation..." && \
			$(PSQL) -U postgres -d $(DB_NAME) -c "CREATE EXTENSION IF NOT EXISTS postgis;" && \
				echo "✓ PostGIS extension enabled" || \
				echo "❌ Failed to enable PostGIS. You may need to restart PostgreSQL: brew services restart postgresql@17"; \
		else \
			echo "❌ Homebrew not found. Please install PostGIS manually."; \
			exit 1; \
		fi \
	else \
		echo "✓ PostGIS extension enabled"; \
	fi

db-drop: ## Drop app database
	@echo "Dropping database '$(DB_NAME)'..."
	@$(PSQL) -U postgres -c "DROP DATABASE IF EXISTS $(DB_NAME);"

db-info: ## Show DB connection info
	@echo "DB_HOST=$(DB_HOST)"
	@echo "DB_PORT=$(DB_PORT)"
	@echo "DB_NAME=$(DB_NAME)"
	@echo "DB_USER=$(DB_USER)"
	@echo "DB_PASSWORD=$(DB_PASSWORD)"
