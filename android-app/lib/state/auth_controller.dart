import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../api/client.dart';
import '../models/models.dart';

class AuthState {
  const AuthState({this.user, this.loading = false, this.booting = true});

  final AjiraUser? user;
  final bool loading;
  final bool booting;

  bool get isAuthenticated => user != null;

  AuthState copyWith({AjiraUser? user, bool? loading, bool? booting, bool clearUser = false}) {
    return AuthState(
      user: clearUser ? null : (user ?? this.user),
      loading: loading ?? this.loading,
      booting: booting ?? this.booting,
    );
  }
}

class AuthController extends StateNotifier<AuthState> {
  AuthController(this._api, this._storage) : super(const AuthState()) {
    _bootstrap();
  }

  final ApiClient _api;
  final FlutterSecureStorage _storage;

  Future<void> _bootstrap() async {
    try {
      final token = await _storage.read(key: 'access_token');
      if (token == null || token.isEmpty) {
        state = state.copyWith(booting: false, clearUser: true);
        return;
      }
      final data = await _api.get('/auth/me');
      final user = AjiraUser.fromJson(data['user'] as Map<String, dynamic>);
      state = AuthState(user: user, booting: false);
    } catch (_) {
      await _storage.delete(key: 'access_token');
      state = const AuthState(booting: false);
    }
  }

  Future<void> login(String email, String password) async {
    state = state.copyWith(loading: true);
    try {
      final data = await _api.post('/auth/login', data: {
        'email': email.trim(),
        'password': password,
      });
      await _storage.write(key: 'access_token', value: data['token'] as String);
      final user = AjiraUser.fromJson(data['user'] as Map<String, dynamic>);
      state = AuthState(user: user, loading: false, booting: false);
    } catch (e) {
      state = state.copyWith(loading: false);
      rethrow;
    }
  }

  Future<void> register({
    required String name,
    required String email,
    required String password,
    required String role,
    String? phone,
  }) async {
    state = state.copyWith(loading: true);
    try {
      final data = await _api.post('/auth/register', data: {
        'name': name.trim(),
        'email': email.trim(),
        'password': password,
        'role': role,
        'phone': phone ?? '',
        'acceptTerms': true,
      });
      await _storage.write(key: 'access_token', value: data['token'] as String);
      final user = AjiraUser.fromJson(data['user'] as Map<String, dynamic>);
      state = AuthState(user: user, loading: false, booting: false);
    } catch (e) {
      state = state.copyWith(loading: false);
      rethrow;
    }
  }

  Future<void> logout() async {
    await _storage.delete(key: 'access_token');
    state = const AuthState(booting: false);
  }
}

final authControllerProvider =
    StateNotifierProvider<AuthController, AuthState>((ref) {
  return AuthController(ref.watch(apiClientProvider), ref.watch(secureStorageProvider));
});
