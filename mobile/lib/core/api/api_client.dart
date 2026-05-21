import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class ApiClient {
  ApiClient({String? baseUrl})
      : _dio = Dio(BaseOptions(
          baseUrl: baseUrl ?? const String.fromEnvironment(
            'API_BASE_URL',
            defaultValue: 'http://10.0.2.2:5000/api/v1',
          ),
          connectTimeout: const Duration(seconds: 15),
          receiveTimeout: const Duration(seconds: 30),
          headers: {'Content-Type': 'application/json'},
        )) {
    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await _storage.read(key: 'access_token');
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
      onError: (e, handler) async {
        if (e.response?.statusCode == 401 && !options(e).path.endsWith('/auth/refresh')) {
          final refreshed = await _tryRefresh();
          if (refreshed) {
            final retry = await _dio.fetch(e.requestOptions);
            handler.resolve(retry);
            return;
          }
        }
        handler.next(e);
      },
    ));
  }

  static const _storage = FlutterSecureStorage();
  final Dio _dio;
  Dio get dio => _dio;

  RequestOptions options(DioException e) => e.requestOptions;

  Future<void> setSession(String access, String refresh) async {
    await _storage.write(key: 'access_token', value: access);
    await _storage.write(key: 'refresh_token', value: refresh);
  }

  Future<void> clearSession() async {
    await _storage.delete(key: 'access_token');
    await _storage.delete(key: 'refresh_token');
  }

  Future<bool> hasSession() async {
    return await _storage.read(key: 'access_token') != null;
  }

  Future<bool> _tryRefresh() async {
    final refresh = await _storage.read(key: 'refresh_token');
    if (refresh == null) return false;
    try {
      final res = await _dio.post(
        '/auth/refresh',
        options: Options(headers: {'Authorization': 'Bearer $refresh'}),
      );
      await setSession(res.data['access_token'], res.data['refresh_token']);
      return true;
    } catch (_) {
      await clearSession();
      return false;
    }
  }
}

final api = ApiClient();
