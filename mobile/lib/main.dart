import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'state/auth_state.dart';
import 'screens/auth/login_screen.dart';
import 'screens/customer/customer_dashboard_screen.dart';
import 'screens/driver/driver_apply_screen.dart';
import 'screens/driver/driver_dashboard_screen.dart';
import 'config/theme.dart';

void main() {
  runApp(
    ChangeNotifierProvider(
      create: (_) => AuthState()..bootstrap(),
      child: const SankofaApp(),
    ),
  );
}

class SankofaApp extends StatelessWidget {
  const SankofaApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Sankofa',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
            seedColor: navy, primary: navy, secondary: gold),
        fontFamily: 'Roboto',
        scaffoldBackgroundColor: bg,
        cardTheme: const CardTheme(elevation: 1, shadowColor: Colors.black12),
      ),
      home: const _RootRouter(),
    );
  }
}

// Root-level switch mirroring frontend/src/App.tsx's <Protected>: shows
// login until authenticated, then routes CUSTOMER vs DRIVER into their
// own home screen (a driver flips between the two via the "Become a
// driver" / role check, same as the web app).
class _RootRouter extends StatefulWidget {
  const _RootRouter();

  @override
  State<_RootRouter> createState() => _RootRouterState();
}

class _RootRouterState extends State<_RootRouter> {
  bool _showDriverApply = false;

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthState>();

    if (auth.loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    if (auth.me == null) {
      return const LoginScreen();
    }

    final isDriver = auth.me!.roles.contains('DRIVER');
    if (isDriver) return const DriverDashboardScreen();
    if (_showDriverApply) {
      return DriverApplyScreen(
          onBack: () => setState(() => _showDriverApply = false));
    }

    return Scaffold(
      body: const CustomerDashboardScreen(),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => setState(() => _showDriverApply = true),
        backgroundColor: gold,
        foregroundColor: navy,
        icon: const Icon(Icons.drive_eta),
        label: const Text('Drive with us'),
      ),
    );
  }
}
