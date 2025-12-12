# Scene-On Mobile App

Flutter mobile application for Scene-On - an ephemeral location-based social platform.

## Overview

Scene-On allows users to:
- Create temporary personas
- Broadcast their presence in real-time on a map (with fuzzy location)
- Send "Yells" visible to nearby users
- Send and receive ephemeral chat requests
- Engage in temporary chats that disappear when scenes end

## Tech Stack

- **Flutter** 3.0+
- **State Management**: Riverpod
- **HTTP Client**: Dio
- **WebSockets**: web_socket_channel
- **Maps**: Mapbox GL
- **Location**: Geolocator
- **Storage**: SharedPreferences + FlutterSecureStorage

## Project Structure

```
lib/
├── main.dart                    # App entry point
├── app.dart                     # Root widget
├── config/
│   ├── router.dart              # Navigation routes
│   └── env_config.dart          # Environment configuration
├── core/
│   ├── network/
│   │   ├── api_client.dart      # HTTP client setup
│   │   ├── websocket_client.dart # WebSocket handling
│   │   └── api_endpoints.dart   # API route constants
│   ├── auth/
│   │   └── token_storage.dart   # Secure token storage
│   └── location/
│       └── location_service.dart # GPS & fuzzy location
├── features/
│   ├── auth/                    # Authentication flow
│   ├── personas/                # Persona management
│   ├── scenes/                  # Map & scene controls
│   ├── yells/                   # Broadcast messages
│   └── chat/                    # Chat requests & messages
└── shared/
    ├── theme/                   # App theme & colors
    ├── widgets/                 # Reusable components
    └── utils/                   # Helper functions
```

## Prerequisites

- Flutter SDK 3.0 or higher
- Xcode (for iOS development)
- CocoaPods (for iOS dependencies)
- Android Studio (for Android development)

## Getting Started

### 1. Install Flutter

Follow the official guide: https://docs.flutter.dev/get-started/install

Verify installation:
```bash
flutter doctor
```

### 2. Clone and Setup

```bash
cd mobile
flutter pub get
```

### 3. Configure Environment

Edit `.env` file and add your API keys:
```env
API_BASE_URL=http://localhost:8080
WS_BASE_URL=ws://localhost:8080
MAPBOX_ACCESS_TOKEN=your_mapbox_token_here
```

### 4. Generate Code

The project uses code generation for Riverpod and Freezed:
```bash
flutter pub run build_runner build --delete-conflicting-outputs
```

For continuous generation during development:
```bash
flutter pub run build_runner watch
```

### 5. Run the App

```bash
# iOS Simulator
flutter run -d ios

# Android Emulator
flutter run -d android

# Specific device
flutter devices
flutter run -d <device_id>
```

## Development

### Code Generation

This project uses several code generators:
- **riverpod_generator**: For providers
- **freezed**: For immutable models
- **json_serializable**: For JSON serialization

Always run build_runner after modifying:
- Provider files (with `@riverpod` annotation)
- Model files (with `@freezed` annotation)

### Running Tests

```bash
# Run all tests
flutter test

# Run with coverage
flutter test --coverage

# View coverage report (requires lcov)
genhtml coverage/lcov.info -o coverage/html
open coverage/html/index.html
```

### Linting

```bash
flutter analyze
```

### Formatting

```bash
flutter format lib/
```

## iOS Setup

### Info.plist Configuration

Add the following to `ios/Runner/Info.plist`:

```xml
<!-- Location permissions -->
<key>NSLocationWhenInUseUsageDescription</key>
<string>We need your location to show nearby scenes</string>

<key>NSLocationAlwaysUsageDescription</key>
<string>We need your location to keep your scene active</string>

<!-- Camera permission (for avatar) -->
<key>NSCameraUsageDescription</key>
<string>We need camera access to take photos for your persona avatar</string>

<!-- Photo library permission -->
<key>NSPhotoLibraryUsageDescription</key>
<string>We need access to your photos to select an avatar</string>

<!-- Mapbox token -->
<key>MBXAccessToken</key>
<string>$(MAPBOX_ACCESS_TOKEN)</string>
```

## Android Setup

### AndroidManifest.xml Configuration

Add the following to `android/app/src/main/AndroidManifest.xml`:

```xml
<!-- Internet permission -->
<uses-permission android:name="android.permission.INTERNET" />

<!-- Location permissions -->
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />

<!-- Camera permission -->
<uses-permission android:name="android.permission.CAMERA" />

<!-- Storage permissions -->
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
```

## Architecture

### Clean Architecture with Feature-First Structure

Each feature follows this pattern:
```
feature/
├── presentation/     # UI (screens, widgets)
├── providers/        # State management
└── models/          # Data models
```

### State Management Flow

1. **UI** triggers actions via providers
2. **Providers** communicate with API/WebSocket clients
3. **Models** represent data structures
4. **UI** rebuilds automatically when state changes

## Key Features Implementation

### Authentication
- Email-based OTP login
- JWT token storage in secure storage
- Auto token refresh (TODO)

### Real-time Updates
- WebSocket connection with auto-reconnection
- Heartbeat/ping-pong mechanism
- Event-based broadcasting

### Location Privacy
- Fuzzy location offsetting
- Configurable radius for privacy
- Distance calculations for proximity

### Offline Support
- TODO: Implement local caching
- TODO: Queue messages when offline

## Building for Production

### iOS

```bash
flutter build ios --release
```

Then open `ios/Runner.xcworkspace` in Xcode and archive.

### Android

```bash
flutter build appbundle --release
# or
flutter build apk --release
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| API_BASE_URL | Backend API URL | http://localhost:8080 |
| WS_BASE_URL | WebSocket URL | ws://localhost:8080 |
| MAPBOX_ACCESS_TOKEN | Mapbox API key | (required) |
| SCENE_DEFAULT_RADIUS | Scene visibility radius (meters) | 5000 |
| FUZZY_LOCATION_OFFSET | Location privacy offset (meters) | 100 |

## Troubleshooting

### Build runner fails
```bash
flutter clean
flutter pub get
flutter pub run build_runner clean
flutter pub run build_runner build --delete-conflicting-outputs
```

### iOS build errors
```bash
cd ios
pod deintegrate
pod install
cd ..
flutter clean
flutter run
```

### Android build errors
```bash
cd android
./gradlew clean
cd ..
flutter clean
flutter run
```

## Contributing

1. Follow the folder structure conventions
2. Use meaningful commit messages
3. Run tests before committing
4. Format code: `flutter format lib/`
5. Check linting: `flutter analyze`

## License

MIT
