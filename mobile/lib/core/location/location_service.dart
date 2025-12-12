import 'package:geolocator/geolocator.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'dart:math';

part 'location_service.g.dart';

class Location {
  final double latitude;
  final double longitude;

  const Location({
    required this.latitude,
    required this.longitude,
  });

  Map<String, dynamic> toJson() => {
    'latitude': latitude,
    'longitude': longitude,
  };
}

@riverpod
class LocationService extends _$LocationService {
  @override
  FutureOr<Location?> build() async {
    return await getCurrentLocation();
  }

  Future<bool> requestPermission() async {
    LocationPermission permission = await Geolocator.checkPermission();
    
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        return false;
      }
    }
    
    if (permission == LocationPermission.deniedForever) {
      return false;
    }

    return true;
  }

  Future<Location?> getCurrentLocation() async {
    try {
      final hasPermission = await requestPermission();
      if (!hasPermission) {
        return null;
      }

      final position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
      );

      return Location(
        latitude: position.latitude,
        longitude: position.longitude,
      );
    } catch (e) {
      return null;
    }
  }

  /// Add fuzzy offset to location for privacy
  Location addFuzzyOffset(Location location, {int radiusMeters = 100}) {
    // Random distance within radius
    final random = Random();
    final distance = random.nextDouble() * radiusMeters;
    
    // Random bearing (0-360 degrees)
    final bearing = random.nextDouble() * 360;
    
    // Earth's radius in meters
    const earthRadius = 6371000.0;
    
    // Convert to radians
    final lat1 = location.latitude * pi / 180;
    final lon1 = location.longitude * pi / 180;
    final brng = bearing * pi / 180;
    
    // Calculate new position
    final lat2 = asin(
      sin(lat1) * cos(distance / earthRadius) +
      cos(lat1) * sin(distance / earthRadius) * cos(brng),
    );
    
    final lon2 = lon1 +
        atan2(
          sin(brng) * sin(distance / earthRadius) * cos(lat1),
          cos(distance / earthRadius) - sin(lat1) * sin(lat2),
        );
    
    return Location(
      latitude: lat2 * 180 / pi,
      longitude: lon2 * 180 / pi,
    );
  }

  /// Calculate distance between two locations in meters
  double calculateDistance(Location loc1, Location loc2) {
    return Geolocator.distanceBetween(
      loc1.latitude,
      loc1.longitude,
      loc2.latitude,
      loc2.longitude,
    );
  }

  /// Check if location is within radius
  bool isWithinRadius(Location loc1, Location loc2, double radiusMeters) {
    final distance = calculateDistance(loc1, loc2);
    return distance <= radiusMeters;
  }
}
