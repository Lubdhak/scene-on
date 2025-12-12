SHELL := /bin/bash

# Detect commands
NPM := $(shell command -v npm 2>/dev/null)
BUN := $(shell command -v bun 2>/dev/null)
RM := $(shell command -v rm 2>/dev/null)

# Cross-platform safe delete
define SAFE_RM
	@if [ -n "$(RM)" ]; then \
		rm -rf $(1); \
	else \
		echo "Warning: 'rm' not found. Please delete $(1) manually."; \
	fi
endef

.PHONY: help install install-bun dev run dev-bun run-bun build build-dev preview lint lint-fix clean clean-all reinstall start start-bun check-npm check-bun

# ---------------------------------------------------------------------
# HELP
# ---------------------------------------------------------------------
help:
	@echo "Scene Weaver - Make Commands"
	@echo "============================="
	@echo ""
	@echo "Setup & Installation:"
	@echo "  make install        - Install dependencies with npm"
	@echo "  make install-bun    - Install dependencies with bun (fallback to npm)"
	@echo ""
	@echo "Development:"
	@echo "  make dev            - Start dev server"
	@echo "  make run            - Alias for dev"
	@echo "  make dev-bun        - Dev server using bun (fallback)"
	@echo ""
	@echo "Build:"
	@echo "  make build          - Production build"
	@echo "  make build-dev      - Development build"
	@echo "  make preview        - Preview production build"
	@echo ""
	@echo "Code Quality:"
	@echo "  make lint           - Run ESLint"
	@echo "  make lint-fix       - Auto-fix lint issues"
	@echo ""
	@echo "Utilities:"
	@echo "  make clean          - Remove dist + node_modules"
	@echo "  make clean-all      - Deep clean (dist + node_modules + lockfiles)"
	@echo "  make reinstall      - Clean + reinstall dependencies"
	@echo ""
	@echo "Quick Start:"
	@echo "  make start          - npm install + dev"
	@echo "  make start-bun      - bun install + dev (fallback)"
	@echo ""

# ---------------------------------------------------------------------
# Environment Checks
# ---------------------------------------------------------------------
check-npm:
	@if [ -z "$(NPM)" ]; then \
		echo "ERROR: npm is not installed or not in PATH."; \
		exit 1; \
	fi

check-bun:
	@if [ -z "$(BUN)" ]; then \
		echo "bun is not installed. Falling back to npm."; \
	fi

# ---------------------------------------------------------------------
# INSTALLATION
# ---------------------------------------------------------------------
install: check-npm
	@echo "Installing dependencies with npm..."
	$(NPM) install

install-bun: check-bun
ifeq ($(BUN),)
	@echo "bun not found. Using npm instead."
	$(NPM) install
else
	@echo "Installing dependencies with bun..."
	$(BUN) install
endif

# ---------------------------------------------------------------------
# DEVELOPMENT
# ---------------------------------------------------------------------
dev: check-npm
	@echo "Starting development server (npm)..."
	$(NPM) run dev

run: dev

dev-bun: check-bun
ifeq ($(BUN),)
	@echo "bun not found. Using npm instead."
	$(NPM) run dev
else
	@echo "Starting development server (bun)..."
	$(BUN) run dev
endif

run-bun: dev-bun

# ---------------------------------------------------------------------
# BUILD
# ---------------------------------------------------------------------
build: check-npm
	@echo "Building for production..."
	$(NPM) run build

build-dev: check-npm
	@echo "Building for development..."
	$(NPM) run build:dev

preview: check-npm
	@echo "Previewing production build..."
	$(NPM) run preview

# ---------------------------------------------------------------------
# CODE QUALITY
# ---------------------------------------------------------------------
lint: check-npm
	@echo "Running ESLint..."
	$(NPM) run lint

lint-fix: check-npm
	@echo "Running ESLint with auto-fix..."
	$(NPM) run lint -- --fix

# ---------------------------------------------------------------------
# CLEANING
# ---------------------------------------------------------------------
clean:
	@echo "Cleaning build artifacts and node_modules..."
	$(call SAFE_RM, node_modules dist)

clean-all:
	@echo "Deep cleaning (node_modules, dist, lock files)..."
	$(call SAFE_RM, node_modules dist package-lock.json bun.lockb)

# ---------------------------------------------------------------------
# REINSTALL
# ---------------------------------------------------------------------
reinstall: clean check-npm
	@echo "Reinstalling dependencies..."
	$(NPM) install

# ---------------------------------------------------------------------
# QUICK START
# ---------------------------------------------------------------------
start: install dev
start-bun: install-bun dev-bun
