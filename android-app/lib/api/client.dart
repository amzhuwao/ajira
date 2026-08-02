import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../config.dart';

class ApiException implements Exception {
  ApiException(this.message, {this.statusCode});
  final String message;
  final int? statusCode;

  @override
  String toString() => message;
}

class ApiClient {
  ApiClient(this._tokenStorage) {
    _dio = Dio(
      BaseOptions(
        baseUrl: '$kApiBase$kMobileApiPrefix',
        connectTimeout: const Duration(seconds: 20),
        receiveTimeout: const Duration(seconds: 30),
        headers: {'Accept': 'application/json', 'Content-Type': 'application/json'},
      ),
    );
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await _tokenStorage.read(key: 'access_token');
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          handler.next(options);
        },
      ),
    );
  }

  late final Dio _dio;
  final FlutterSecureStorage _tokenStorage;

  Future<Map<String, dynamic>> get(String path, {Map<String, dynamic>? query}) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(path, queryParameters: query);
      return _unwrap(res);
    } on DioException catch (e) {
      throw _mapDio(e);
    }
  }

  Future<Map<String, dynamic>> post(String path, {Object? data}) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>(path, data: data);
      return _unwrap(res);
    } on DioException catch (e) {
      throw _mapDio(e);
    }
  }

  Map<String, dynamic> _unwrap(Response<Map<String, dynamic>> res) {
    final body = res.data ?? {};
    if (body['error'] is String) {
      throw ApiException(body['error'] as String, statusCode: res.statusCode);
    }
    final data = body['data'];
    if (data is Map<String, dynamic>) return data;
    return body;
  }

  ApiException _mapDio(DioException e) {
    final data = e.response?.data;
    if (data is Map && data['error'] is String) {
      return ApiException(data['error'] as String, statusCode: e.response?.statusCode);
    }
    return ApiException(
      e.message ?? 'Network error',
      statusCode: e.response?.statusCode,
    );
  }
}

final secureStorageProvider = Provider<FlutterSecureStorage>(
  (ref) => const FlutterSecureStorage(),
);

final apiClientProvider = Provider<ApiClient>(
  (ref) => ApiClient(ref.watch(secureStorageProvider)),
);
