class ApiEndpoints {
  static const String baseUrl = '/api/v1';
  
  // Auth
  static const String sendOTP = '$baseUrl/auth/send-otp';
  static const String verifyOTP = '$baseUrl/auth/verify-otp';
  static const String refreshToken = '$baseUrl/auth/refresh';
  
  // Personas
  static const String personas = '$baseUrl/personas';
  static String persona(String id) => '$baseUrl/personas/$id';
  
  // Scenes
  static const String startScene = '$baseUrl/scenes/start';
  static const String stopScene = '$baseUrl/scenes/stop';
  static const String nearbyScenes = '$baseUrl/scenes/nearby';
  static const String myScene = '$baseUrl/scenes/me';
  
  // Yells
  static const String yells = '$baseUrl/yells';
  static const String nearbyYells = '$baseUrl/yells/nearby';
  
  // Chat
  static const String chatRequests = '$baseUrl/chat/requests';
  static const String inbox = '$baseUrl/chat/requests/inbox';
  static String acceptChatRequest(String id) => '$baseUrl/chat/requests/$id/accept';
  static String rejectChatRequest(String id) => '$baseUrl/chat/requests/$id/reject';
  static String chatMessages(String chatId) => '$baseUrl/chat/$chatId/messages';
  
  // WebSocket
  static const String wsPath = '/ws';
}
