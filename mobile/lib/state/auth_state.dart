import 'package:flutter/foundation.dart';
import '../services/api_client.dart';
import '../services/socket_service.dart';
import '../models/models.dart';

// Mirrors frontend/src/context/AuthContext.tsx: phone -> OTP -> verify,
// backed by the same /auth endpoints, driving a ChangeNotifier instead
// of React context.
class AuthState extends ChangeNotifier {
  Me? me;
  bool loading = true;

  Future<void> bootstrap() async {
    await ApiClient.instance.loadTokens();
    if (ApiClient.instance.isAuthenticated) {
      try {
        final data = await ApiClient.instance.get('/users/me');
        me = Me.fromJson(data);
        final token = ApiClient.instance.accessToken;
        if (token != null) SocketService.instance.connect(token);
      } catch (_) {
        me = null;
      }
    }
    loading = false;
    notifyListeners();
  }

  Future<void> requestOtp(String phone) async {
    await ApiClient.instance.post('/auth/request-otp', body: {'phone': phone});
  }

  Future<void> verifyOtp(String phone, String otp) async {
    final data = await ApiClient.instance.post('/auth/verify-otp', body: {'phone': phone, 'otp': otp});
    await ApiClient.instance.setTokens(data['accessToken'], data['refreshToken']);
    me = Me.fromJson(data['user']);
    SocketService.instance.connect(data['accessToken']);
    notifyListeners();
  }

  Future<void> logout() async {
    await ApiClient.instance.clearTokens();
    SocketService.instance.disconnect();
    me = null;
    notifyListeners();
  }
}
