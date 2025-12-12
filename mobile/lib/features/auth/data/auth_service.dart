import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logger/logger.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../../../config/env_config.dart';
import '../../../core/auth/token_storage.dart';

part 'auth_service.g.dart';

class AuthResponse {
  final String accessToken;
  final String userId;
  final String email;

  AuthResponse({
    required this.accessToken,
    required this.userId,
    required this.email,
  });

  factory AuthResponse.fromJson(Map<String, dynamic> json) {
    return AuthResponse(
      accessToken: json['access_token'] as String,
      userId: json['user_id'] as String,
      email: json['email'] as String,
    );
  }
}

@riverpod
class AuthService extends _$AuthService {
  final _logger = Logger();
  late final Dio _dio;

  @override
  FutureOr<AuthResponse?> build() {
    _dio = Dio(BaseOptions(
      baseUrl: '${EnvConfig.apiBaseUrl}/api/v1',
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 10),
    ));
    return null;
  }

  Future<void> dummyGoogleLogin(String email, String name) async {
    try {
      state = const AsyncLoading();
      
      final response = await _dio.post(
        '/auth/google/dummy',
        data: {
          'email': email,
          'name': name,
        },
      );

      final authResponse = AuthResponse.fromJson(response.data);
      
      // Store token
      await TokenStorage.saveAccessToken(authResponse.accessToken);
      await TokenStorage.saveUserId(authResponse.userId);
      
      state = AsyncData(authResponse);
      _logger.i('✓ Dummy Google login successful: ${authResponse.email}');
    } catch (e) {
      _logger.e('Dummy Google login failed: $e');
      state = AsyncError(e, StackTrace.current);
      rethrow;
    }
  }

  Future<void> sendOTP(String email) async {
    try {
      await _dio.post('/auth/send-otp', data: {'email': email});
      _logger.i('OTP sent to $email');
    } catch (e) {
      _logger.e('Failed to send OTP: $e');
      rethrow;
    }
  }

  Future<void> verifyOTP(String email, String code) async {
    try {
      state = const AsyncLoading();
      
      final response = await _dio.post(
        '/auth/verify-otp',
        data: {
          'email': email,
          'code': code,
        },
      );

      final authResponse = AuthResponse.fromJson(response.data);
      
      // Store token
      await TokenStorage.saveAccessToken(authResponse.accessToken);
      await TokenStorage.saveUserId(authResponse.userId);
      
      state = AsyncData(authResponse);
      _logger.i('✓ OTP verification successful');
    } catch (e) {
      _logger.e('OTP verification failed: $e');
      state = AsyncError(e, StackTrace.current);
      rethrow;
    }
  }

  Future<void> logout() async {
    await TokenStorage.clearAll();
    state = const AsyncData(null);
    _logger.i('Logged out');
  }
}
