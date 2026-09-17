import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../state/auth_state.dart';
import '../../services/api_client.dart';
import '../../config/theme.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _phoneController = TextEditingController();
  final _otpController = TextEditingController();
  String _step = 'phone';
  String? _error;
  bool _loading = false;

  Future<void> _requestOtp() async {
    setState(() {
      _error = null;
      _loading = true;
    });
    try {
      await context.read<AuthState>().requestOtp(_phoneController.text);
      setState(() => _step = 'otp');
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _verify() async {
    setState(() {
      _error = null;
      _loading = true;
    });
    try {
      await context
          .read<AuthState>()
          .verifyOtp(_phoneController.text, _otpController.text);
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    // Same gradient + diagonal stripe overlay as the POC's Auth/Landing
    // hero (sankofa-app.jsx), ported to Flutter with a CustomPaint
    // stripe pattern instead of a repeating-linear-gradient background.
    return Scaffold(
      body: Stack(
        children: [
          Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                  colors: [navy, navyDark],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight),
            ),
          ),
          Positioned.fill(child: CustomPaint(painter: _StripePainter())),
          SafeArea(
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const SankofaMark(size: 56, light: true),
                    const SizedBox(height: 16),
                    const Text('Sankofa',
                        style: TextStyle(
                            fontSize: 28,
                            color: Colors.white,
                            fontWeight: FontWeight.w800,
                            letterSpacing: -0.7)),
                    const SizedBox(height: 6),
                    const Text('Rides, food, bills and more — one account.',
                        style: TextStyle(color: Colors.white70, fontSize: 14)),
                    const SizedBox(height: 28),
                    Card(
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(20)),
                      child: Padding(
                        padding: const EdgeInsets.all(20),
                        child: _step == 'phone'
                            ? _phoneForm(gold, navyDark)
                            : _otpForm(gold, navyDark),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _phoneForm(Color gold, Color navyDark) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        const Text('Phone number',
            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
        const SizedBox(height: 8),
        TextField(
          controller: _phoneController,
          keyboardType: TextInputType.phone,
          decoration: const InputDecoration(
              hintText: '0244 123 456', border: OutlineInputBorder()),
        ),
        if (_error != null)
          Padding(
              padding: const EdgeInsets.only(top: 12),
              child: Text(_error!, style: const TextStyle(color: Colors.red))),
        const SizedBox(height: 16),
        ElevatedButton(
          onPressed: _loading ? null : _requestOtp,
          style: ElevatedButton.styleFrom(
              backgroundColor: gold,
              foregroundColor: navyDark,
              padding: const EdgeInsets.symmetric(vertical: 16)),
          child: Text(_loading ? 'Sending code…' : 'Send verification code'),
        ),
        const SizedBox(height: 12),
        const Text(
          'No account yet? Entering your number creates one automatically.',
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: 12, color: Colors.grey),
        ),
      ],
    );
  }

  Widget _otpForm(Color gold, Color navyDark) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text('Enter the 6-digit code sent to ${_phoneController.text}',
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
        const SizedBox(height: 8),
        TextField(
          controller: _otpController,
          keyboardType: TextInputType.number,
          maxLength: 6,
          textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 22, letterSpacing: 8),
          decoration: const InputDecoration(
              counterText: '', border: OutlineInputBorder()),
        ),
        if (_error != null)
          Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(_error!, style: const TextStyle(color: Colors.red))),
        const SizedBox(height: 8),
        ElevatedButton(
          onPressed: _loading ? null : _verify,
          style: ElevatedButton.styleFrom(
              backgroundColor: gold,
              foregroundColor: navyDark,
              padding: const EdgeInsets.symmetric(vertical: 16)),
          child: Text(_loading ? 'Verifying…' : 'Verify & continue'),
        ),
        const SizedBox(height: 8),
        OutlinedButton(
            onPressed: () => setState(() => _step = 'phone'),
            child: const Text('Use a different number')),
      ],
    );
  }
}

// A faint 45°-diagonal stripe field, matching the POC's hero overlay:
// `repeating-linear-gradient(45deg,#fff 0 1px,transparent 1px 26px)` at
// 9% opacity.
class _StripePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.white.withOpacity(0.09)
      ..strokeWidth = 1;
    const spacing = 26.0;
    final diag = size.width + size.height;
    for (double i = -diag; i < diag; i += spacing) {
      canvas.drawLine(
          Offset(i, 0), Offset(i + size.height, size.height), paint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
