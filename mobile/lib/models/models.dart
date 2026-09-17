class Me {
  final String id;
  final String phone;
  final String? name;
  final List<String> roles;

  Me({required this.id, required this.phone, this.name, required this.roles});

  factory Me.fromJson(Map<String, dynamic> json) => Me(
        id: json['id'],
        phone: json['phone'],
        name: json['name'],
        roles: List<String>.from(json['roles'] ?? []),
      );
}

class LatLng {
  final double lat;
  final double lng;
  const LatLng(this.lat, this.lng);
}

class Ride {
  final String id;
  final String status;
  final String requestedVehicleType;
  final double pickupLat;
  final double pickupLng;
  final String pickupAddress;
  final double dropoffLat;
  final double dropoffLng;
  final String dropoffAddress;
  final int estimatedFareCents;
  final int? finalFareCents;
  final String currency;
  final Map<String, dynamic>? driver;

  Ride({
    required this.id,
    required this.status,
    required this.requestedVehicleType,
    required this.pickupLat,
    required this.pickupLng,
    required this.pickupAddress,
    required this.dropoffLat,
    required this.dropoffLng,
    required this.dropoffAddress,
    required this.estimatedFareCents,
    this.finalFareCents,
    required this.currency,
    this.driver,
  });

  factory Ride.fromJson(Map<String, dynamic> json) => Ride(
        id: json['id'],
        status: json['status'],
        requestedVehicleType: json['requestedVehicleType'],
        pickupLat: (json['pickupLat'] as num).toDouble(),
        pickupLng: (json['pickupLng'] as num).toDouble(),
        pickupAddress: json['pickupAddress'],
        dropoffLat: (json['dropoffLat'] as num).toDouble(),
        dropoffLng: (json['dropoffLng'] as num).toDouble(),
        dropoffAddress: json['dropoffAddress'],
        estimatedFareCents: json['estimatedFareCents'] ?? 0,
        finalFareCents: json['finalFareCents'],
        currency: json['currency'] ?? 'GHS',
        driver: json['driverProfile'],
      );

  String get formattedFare => '$currency ${(( finalFareCents ?? estimatedFareCents) / 100).toStringAsFixed(2)}';
}
