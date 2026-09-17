import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sankofa_mobile/main.dart';
import 'package:sankofa_mobile/state/auth_state.dart';
import 'package:sankofa_mobile/screens/auth/login_screen.dart';

// Real, no-mock-backend smoke test: this is what CI actually runs on every
// push. It only checks the app boots to the logged-out (login) screen
// without crashing — it deliberately doesn't touch the network, so it
// stays fast and doesn't need a running backend in CI.
void main() {
  testWidgets('app boots to the login screen when logged out', (tester) async {
    // AuthState.bootstrap() reads SharedPreferences before deciding
    // whether a session exists; with no mock values set, it finds no
    // saved tokens and resolves to "logged out" without any network call.
    SharedPreferences.setMockInitialValues({});

    await tester.pumpWidget(
      ChangeNotifierProvider(
        create: (_) => AuthState()..bootstrap(),
        child: const SankofaApp(),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byType(LoginScreen), findsOneWidget);
  });
}
