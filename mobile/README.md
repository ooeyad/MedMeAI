# MedMeAI Mobile App (Flutter)

Patient + doctor app. Single Flutter codebase that switches the home screen
based on the signed-in user's role.

## Run

```bash
flutter pub get
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:5000/api/v1
```

`10.0.2.2` is the Android emulator's localhost alias. For iOS simulator use
`http://localhost:5000/api/v1`. For physical devices on the same Wi-Fi, use
the host machine's LAN IP.

## Project layout

- `lib/core/api/api_client.dart` — Dio client + JWT refresh interceptor + secure storage
- `lib/core/auth/auth_state.dart` — auth state provider
- `lib/core/router.dart` — `go_router` config (role-aware redirect)
- `lib/features/auth/` — login
- `lib/features/patient/` — patient home
- `lib/features/doctor/` — doctor home
- `lib/features/appointments/` — list + booking wizard
- `lib/features/kyc/` — document upload + OCR trigger
- `lib/features/ai/` — agentic chat (with destructive-action confirmation)
- `lib/features/profile/` — profile view

## Default test users

See top-level `README.md`.
