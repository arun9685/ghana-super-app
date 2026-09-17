import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../config/env.dart';

// Same token-refresh contract as frontend/src/api/client.ts: an access
// token on every request, and a transparent single-retry refresh on 401
// (the backend rotates refresh tokens on every use — see backend
// modules/auth/auth.service.ts).
class ApiException implements Exception {
  final int statusCode;
  final String message;
  ApiException(this.statusCode, this.message);
  @override
  String toString() => message;
}

class ApiClient {
  static final ApiClient instance = ApiClient._internal();
  ApiClient._internal();

  String? _accessToken;
  String? _refreshToken;
  Future<String?>? _refreshing;

  Future<void> loadTokens() async {
    final prefs = await SharedPreferences.getInstance();
    _accessToken = prefs.getString('sankofa:accessToken');
    _refreshToken = prefs.getString('sankofa:refreshToken');
  }

  Future<void> setTokens(String accessToken, String refreshToken) async {
    _accessToken = accessToken;
    _refreshToken = refreshToken;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('sankofa:accessToken', accessToken);
    await prefs.setString('sankofa:refreshToken', refreshToken);
  }

  Future<void> clearTokens() async {
    _accessToken = null;
    _refreshToken = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('sankofa:accessToken');
    await prefs.remove('sankofa:refreshToken');
  }

  bool get isAuthenticated => _accessToken != null;
  String? get accessToken => _accessToken;

  Future<String?> _performRefresh() async {
    if (_refreshToken == null) return null;
    try {
      final res = await http.post(
        Uri.parse('${Env.apiBaseUrl}/auth/refresh'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'refreshToken': _refreshToken}),
      );
      if (res.statusCode != 200) {
        await clearTokens();
        return null;
      }
      final data = jsonDecode(res.body)['data'];
      await setTokens(data['accessToken'], data['refreshToken']);
      return data['accessToken'] as String;
    } catch (_) {
      await clearTokens();
      return null;
    }
  }

  Future<dynamic> request(
    String method,
    String path, {
    Map<String, dynamic>? body,
    Map<String, String>? query,
    bool retried = false,
  }) async {
    var uri = Uri.parse('${Env.apiBaseUrl}$path');
    if (query != null) uri = uri.replace(queryParameters: query);

    final headers = <String, String>{'Content-Type': 'application/json'};
    if (_accessToken != null) headers['Authorization'] = 'Bearer $_accessToken';

    http.Response res;
    final encodedBody = body != null ? jsonEncode(body) : null;
    switch (method) {
      case 'GET':
        res = await http.get(uri, headers: headers);
        break;
      case 'POST':
        res = await http.post(uri, headers: headers, body: encodedBody);
        break;
      case 'PATCH':
        res = await http.patch(uri, headers: headers, body: encodedBody);
        break;
      case 'DELETE':
        res = await http.delete(uri, headers: headers);
        break;
      default:
        throw ApiException(0, 'Unsupported method $method');
    }

    if (res.statusCode == 401 && !retried && !path.startsWith('/auth/')) {
      _refreshing ??= _performRefresh().whenComplete(() => _refreshing = null);
      final newToken = await _refreshing;
      if (newToken != null) {
        return request(method, path, body: body, query: query, retried: true);
      }
      throw ApiException(401, 'Session expired — please log in again');
    }

    final decoded = res.body.isNotEmpty ? jsonDecode(res.body) : null;
    if (res.statusCode < 200 || res.statusCode >= 300) {
      final message = decoded?['error']?['message'] ?? 'Something went wrong';
      throw ApiException(res.statusCode, message);
    }
    return decoded?['data'];
  }

  Future<dynamic> get(String path, {Map<String, String>? query}) =>
      request('GET', path, query: query);
  Future<dynamic> post(String path, {Map<String, dynamic>? body}) =>
      request('POST', path, body: body);
  Future<dynamic> patch(String path, {Map<String, dynamic>? body}) =>
      request('PATCH', path, body: body);
}
