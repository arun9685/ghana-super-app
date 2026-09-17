// Same idea as frontend/.env.example: point this at wherever the backend
// actually runs. An Android emulator can't reach "localhost" (that's the
// emulator's own loopback) — use 10.0.2.2 for the AVD, your machine's LAN
// IP for a physical device, or an --dart-define override at build time.
class Env {
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:3000/api/v1',
  );

  static const String socketUrl = String.fromEnvironment(
    'SOCKET_URL',
    defaultValue: 'http://10.0.2.2:3000',
  );
}
