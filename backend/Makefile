
# Render Deployment Commands:
# Build Command: make build-prod
# Start Command: ./app

.PHONY: help install build build-prod run dev test test-coverage lint fmt vet tidy clean

# ---------------------------------------------------------------------
# Application
# ---------------------------------------------------------------------
BINARY_NAME = scene-on-api
MAIN_PATH   = main.go
BUILD_DIR   = bin

# ---------------------------------------------------------------------
# Environment Environment
# ---------------------------------------------------------------------
# Load env vars from dev.env by default if it exists
ifneq (,$(wildcard ./dev.env))
    include dev.env
    export
endif

# ---------------------------------------------------------------------
# Default target
# ---------------------------------------------------------------------
help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-20s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# ---------------------------------------------------------------------
# Go
# ---------------------------------------------------------------------
install: ## Install dependencies
	@echo "Installing dependencies..."
	go mod download
	go mod tidy

build: ## Build the application (Local)
	@echo "Building $(BINARY_NAME)..."
	@mkdir -p $(BUILD_DIR)
	go build -o $(BUILD_DIR)/$(BINARY_NAME) $(MAIN_PATH)
	@echo "Build complete: $(BUILD_DIR)/$(BINARY_NAME)"

build-prod: ## Build for production (Matches Render config)
	@echo "Building for production (Render-like)..."
	go build -tags netgo -ldflags '-s -w' -o app $(MAIN_PATH)
	@echo "Build complete: app"

run: ## Run the application
	@echo "Running $(BINARY_NAME)..."
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
	@rm -rf $(BUILD_DIR) app
	@rm -f coverage.out coverage.html
