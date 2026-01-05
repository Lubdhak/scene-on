.PHONY: help install build run dev test test-coverage lint fmt vet tidy clean \
        db-bootstrap db-create db-drop db-info db-postgis all

# -------------------------------------------------------------------
# Application
# -------------------------------------------------------------------
BINARY_NAME = scene-on-api
MAIN_PATH   = main.go
BUILD_DIR   = bin

# -------------------------------------------------------------------
# Database (MATCHES APP CONFIG)
# -------------------------------------------------------------------
DB_SUPERUSER ?= $(shell whoami)
DB_NAME      ?= scene_on
DB_USER      ?= scene_user
DB_PASSWORD  ?= scene_pass
DB_HOST      ?= localhost
DB_PORT      ?= 5432

# PostgreSQL 17 paths
PSQL := /opt/homebrew/opt/postgresql@17/bin/psql
PG_CTL := /opt/homebrew/opt/postgresql@17/bin/pg_ctl

# -------------------------------------------------------------------
# Default target
# -------------------------------------------------------------------
help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-20s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# -------------------------------------------------------------------
# Go
# -------------------------------------------------------------------
install: ## Install dependencies
	@echo "Installing dependencies..."
	go mod download
	go mod tidy

build: ## Build the application
	@echo "Building $(BINARY_NAME)..."
	@mkdir -p $(BUILD_DIR)
	go build -o $(BUILD_DIR)/$(BINARY_NAME) $(MAIN_PATH)
	@echo "Build complete: $(BUILD_DIR)/$(BINARY_NAME)"

run: db-postgis ## Run the application
	@echo "Running $(BINARY_NAME)..."
	@echo "Using DB: $(DB_NAME)"
	go run $(MAIN_PATH)

dev: ## Run in development mode with auto-reload (requires air)
	@AIR_PATH=$$(go env GOPATH)/bin/air; \
	if [ -f "$$AIR_PATH" ]; then \
		$$AIR_PATH; \
	elif command -v air > /dev/null; then \
		air; \
	else \
		echo "Air not installed. Install with:"; \
		echo "  go install github.com/air-verse/air@latest"; \
		echo "Running without auto-reload..."; \
		go run $(MAIN_PATH); \
	fi

test: ## Run tests
	@echo "Running tests..."
	go test -v ./...

test-coverage: ## Run tests with coverage
	@echo "Running tests with coverage..."
	go test -v -coverprofile=coverage.out ./...
	go tool cover -html=coverage.out -o coverage.html
	@echo "Coverage report generated: coverage.html"

lint: ## Run linter (requires golangci-lint)
	@if command -v golangci-lint > /dev/null; then \
		golangci-lint run; \
	else \
		echo "golangci-lint not installed."; \
		echo "Install: https://golangci-lint.run/usage/install/"; \
	fi

fmt: ## Format code
	@echo "Formatting code..."
	go fmt ./...

vet: ## Run go vet
	@echo "Running go vet..."
	go vet ./...

tidy: ## Tidy dependencies
	@echo "Tidying dependencies..."
	go mod tidy

clean: ## Clean build artifacts
	@echo "Cleaning..."
	@rm -rf $(BUILD_DIR)
	@rm -f coverage.out coverage.html

# -------------------------------------------------------------------
# Database (PostgreSQL – Homebrew/macOS safe)
# -------------------------------------------------------------------
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

# -------------------------------------------------------------------
# Meta
# -------------------------------------------------------------------
all: install build test ## Install, build, and test
