# Build Runner makefile for Flutter

.PHONY: help get build-runner-build build-runner-watch clean test format lint run-ios run-android

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-20s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

get: ## Get Flutter dependencies
	flutter pub get

build-runner-build: ## Generate code with build_runner
	flutter pub run build_runner build --delete-conflicting-outputs

build-runner-watch: ## Watch and generate code automatically
	flutter pub run build_runner watch --delete-conflicting-outputs

clean: ## Clean build artifacts
	flutter clean
	flutter pub get

deep-clean: ## Deep clean including generated files
	flutter clean
	rm -rf .dart_tool/
	rm -rf build/
	rm -rf ios/Pods/
	rm -rf ios/.symlinks/
	flutter pub get

test: ## Run tests
	flutter test

test-coverage: ## Run tests with coverage
	flutter test --coverage
	@echo "Coverage report generated at coverage/lcov.info"

format: ## Format Dart code
	flutter format lib/

lint: ## Run Dart analyzer
	flutter analyze

run-ios: ## Run on iOS simulator
	flutter run -d ios

run-android: ## Run on Android emulator
	flutter run -d android

build-ios: ## Build iOS app
	flutter build ios --release

build-android: ## Build Android app bundle
	flutter build appbundle --release

build-apk: ## Build Android APK
	flutter build apk --release

devices: ## List connected devices
	flutter devices
