# Dummy Google Login Implementation

## Overview
A simplified Google login flow for rapid development. This bypasses actual Google OAuth and uses email/name for user creation.

## Backend

### Endpoint
```
POST /api/v1/auth/google/dummy
```

### Request
```json
{
  "email": "user@example.com",
  "name": "User Name"
}
```

### Response
```json
{
  "access_token": "eyJhbGciOiJIUzI1...",
  "user_id": "uuid-here",
  "email": "user@example.com"
}
```

### Implementation
- Location: `backend/handlers/auth.go` - `DummyGoogleLogin()`
- Route: `backend/routes/routes.go`
- Creates or retrieves user by email
- Generates JWT token (24h expiry)
- No actual Google OAuth integration

## Frontend

### UI Components
- **Login Screen**: `mobile/lib/features/auth/presentation/screens/login_screen.dart`
  - Email input field
  - Name input field
  - Google sign-in button with loading state
  - Development mode warning banner
  - Fallback OTP login option

### Services
- **AuthService**: `mobile/lib/features/auth/data/auth_service.dart`
  - `dummyGoogleLogin(email, name)` - Performs login
  - `sendOTP(email)` - Alternative OTP flow
  - `verifyOTP(email, code)` - OTP verification
  - `logout()` - Clear authentication state
  - Uses Riverpod for state management

- **TokenStorage**: `mobile/lib/core/auth/token_storage.dart`
  - Secure storage for access tokens
  - User ID persistence
  - Uses flutter_secure_storage

### Flow
1. User enters email and name
2. Clicks "Sign in with Google"
3. App sends request to `/api/v1/auth/google/dummy`
4. Backend creates/retrieves user and returns JWT
5. Token is stored securely
6. User navigates to personas screen

## Testing

### Backend Test
```bash
cd backend
./test_google_login.sh
```

### Manual Test via curl
```bash
curl -X POST http://localhost:8080/api/v1/auth/google/dummy \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "name": "Test User"
  }'
```

## Before Running Flutter App

You need to generate Riverpod providers:

```bash
cd mobile
make build-runner-build
# or
flutter pub run build_runner build --delete-conflicting-outputs
```

## Production Migration

To migrate to real Google OAuth:

1. Set up Google Cloud Console project
2. Add `google_sign_in` package to Flutter
3. Replace `DummyGoogleLogin` with actual Google OAuth flow
4. Update backend to verify Google ID tokens
5. Remove dummy endpoint and development warning banner

## Notes

- ⚠️ **Development Only**: This is NOT secure for production
- No password required
- No email verification
- Anyone can claim any email address
- JWT secret must be set in `.env`
