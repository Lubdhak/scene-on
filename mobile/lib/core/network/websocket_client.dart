import 'dart:async';
import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logger/logger.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:web_socket_channel/web_socket_channel.dart';
import '../../config/env_config.dart';
import '../auth/token_storage.dart';

part 'websocket_client.g.dart';

enum WebSocketStatus { connecting, connected, disconnected, reconnecting }

class WebSocketMessage {
  final String type;
  final Map<String, dynamic> data;

  WebSocketMessage({required this.type, required this.data});

  factory WebSocketMessage.fromJson(Map<String, dynamic> json) {
    return WebSocketMessage(
      type: json['type'] as String,
      data: json['data'] as Map<String, dynamic>,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'type': type,
      'data': data,
    };
  }
}

@riverpod
class WebSocketClient extends _$WebSocketClient {
  WebSocketChannel? _channel;
  StreamSubscription? _subscription;
  final _logger = Logger();
  final _messageController = StreamController<WebSocketMessage>.broadcast();
  Timer? _reconnectTimer;
  Timer? _pingTimer;
  int _reconnectAttempts = 0;
  static const int maxReconnectAttempts = 5;

  @override
  WebSocketStatus build() {
    ref.onDispose(() {
      disconnect();
    });
    return WebSocketStatus.disconnected;
  }

  Stream<WebSocketMessage> get messageStream => _messageController.stream;

  Future<void> connect() async {
    if (state == WebSocketStatus.connected) {
      _logger.i('WebSocket already connected');
      return;
    }

    try {
      state = WebSocketStatus.connecting;
      final token = await TokenStorage.getAccessToken();
      
      if (token == null) {
        throw Exception('No auth token available');
      }

      final uri = Uri.parse('${EnvConfig.wsBaseUrl}/ws?token=$token');
      _channel = WebSocketChannel.connect(uri);

      await _channel!.ready;
      
      state = WebSocketStatus.connected;
      _reconnectAttempts = 0;
      _logger.i('WebSocket connected');

      // Start ping timer
      _startPingTimer();

      // Listen to messages
      _subscription = _channel!.stream.listen(
        _onMessage,
        onError: _onError,
        onDone: _onDone,
        cancelOnError: false,
      );
    } catch (e) {
      _logger.e('WebSocket connection error: $e');
      state = WebSocketStatus.disconnected;
      _scheduleReconnect();
    }
  }

  void _onMessage(dynamic message) {
    try {
      final json = jsonDecode(message as String) as Map<String, dynamic>;
      final wsMessage = WebSocketMessage.fromJson(json);
      _messageController.add(wsMessage);
      _logger.d('WebSocket message received: ${wsMessage.type}');
    } catch (e) {
      _logger.e('Error parsing WebSocket message: $e');
    }
  }

  void _onError(dynamic error) {
    _logger.e('WebSocket error: $error');
    _scheduleReconnect();
  }

  void _onDone() {
    _logger.w('WebSocket connection closed');
    state = WebSocketStatus.disconnected;
    _scheduleReconnect();
  }

  void _scheduleReconnect() {
    if (_reconnectAttempts >= maxReconnectAttempts) {
      _logger.e('Max reconnection attempts reached');
      state = WebSocketStatus.disconnected;
      return;
    }

    if (state != WebSocketStatus.reconnecting) {
      state = WebSocketStatus.reconnecting;
    }

    _reconnectTimer?.cancel();
    final delay = Duration(seconds: 2 << _reconnectAttempts); // Exponential backoff
    
    _reconnectTimer = Timer(delay, () {
      _reconnectAttempts++;
      _logger.i('Reconnecting... (attempt $_reconnectAttempts)');
      connect();
    });
  }

  void _startPingTimer() {
    _pingTimer?.cancel();
    _pingTimer = Timer.periodic(const Duration(seconds: 30), (_) {
      send(WebSocketMessage(type: 'ping', data: {}));
    });
  }

  void send(WebSocketMessage message) {
    if (state != WebSocketStatus.connected) {
      _logger.w('Cannot send message: WebSocket not connected');
      return;
    }

    try {
      final json = jsonEncode(message.toJson());
      _channel?.sink.add(json);
      _logger.d('WebSocket message sent: ${message.type}');
    } catch (e) {
      _logger.e('Error sending WebSocket message: $e');
    }
  }

  void disconnect() {
    _pingTimer?.cancel();
    _reconnectTimer?.cancel();
    _subscription?.cancel();
    _channel?.sink.close();
    _messageController.close();
    state = WebSocketStatus.disconnected;
    _logger.i('WebSocket disconnected');
  }
}
