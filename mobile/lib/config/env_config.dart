import 'package:flutter_dotenv/flutter_dotenv.dart';

class EnvConfig {
  static String get apiBaseUrl => dotenv.env['API_BASE_URL'] ?? 'http://localhost:8080';
  static String get wsBaseUrl => dotenv.env['WS_BASE_URL'] ?? 'ws://localhost:8080';
  static String get mapboxToken => dotenv.env['MAPBOX_ACCESS_TOKEN'] ?? '';
  
  static int get sceneDefaultRadius => 
      int.tryParse(dotenv.env['SCENE_DEFAULT_RADIUS'] ?? '5000') ?? 5000;
  
  static int get fuzzyLocationOffset => 
      int.tryParse(dotenv.env['FUZZY_LOCATION_OFFSET'] ?? '100') ?? 100;
}
