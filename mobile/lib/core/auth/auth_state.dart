import 'package:flutter/foundation.dart';

import '../api/api_client.dart';

class AuthState extends ChangeNotifier {
  bool _booted = false;
  bool _authenticated = false;
  Map<String, dynamic>? _user;

  bool get booted => _booted;
  bool get authenticated => _authenticated;
  Map<String, dynamic>? get user => _user;

  List<String> get roles =>
      ((_user?['roles'] ?? []) as List).map((e) => e.toString()).toList();
  bool hasRole(String code) => roles.contains(code);

  Future<void> bootstrap() async {
    _authenticated = await api.hasSession();
    if (_authenticated) {
      try {
        final res = await api.dio.get('/auth/me');
        _user = Map<String, dynamic>.from(res.data);
      } catch (_) {
        _authenticated = false;
      }
    }
    _booted = true;
    notifyListeners();
  }

  Future<void> signIn(String email, String password) async {
    final res = await api.dio.post('/auth/login', data: {
      'email': email,
      'password': password,
    });
    await api.setSession(res.data['access_token'], res.data['refresh_token']);
    _user = Map<String, dynamic>.from(res.data['user']);
    _authenticated = true;
    notifyListeners();
  }

  Future<void> signOut() async {
    try {
      await api.dio.post('/auth/logout');
    } catch (_) {}
    await api.clearSession();
    _user = null;
    _authenticated = false;
    notifyListeners();
  }
}
