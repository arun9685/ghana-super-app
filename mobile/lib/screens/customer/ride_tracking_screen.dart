import 'package:flutter/material.dart';
import '../../services/api_client.dart';
import '../../services/socket_service.dart';
import '../../models/models.dart';
import '../../widgets/trip_map_painter.dart';
import '../../config/theme.dart';


const _statusLabel = {
  'REQUESTED': 'Requesting…',
  'SEARCHING': 'Finding a driver…',
  'ASSIGNED': 'Driver on the way',
  'ARRIVED': 'Driver has arrived',
  'IN_PROGRESS': 'Trip in progress',
  'COMPLETED': 'Trip completed',
  'CANCELLED': 'Trip cancelled',
  'NO_DRIVERS_FOUND': 'No drivers found nearby',
};

class RideTrackingScreen extends StatefulWidget {
  final String rideId;
  const RideTrackingScreen({super.key, required this.rideId});

  @override
  State<RideTrackingScreen> createState() => _RideTrackingScreenState();
}

class _RideTrackingScreenState extends State<RideTrackingScreen> {
  Ride? _ride;
  TripPoint? _driverPos;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
    SocketService.instance.joinRide(widget.rideId);
    SocketService.instance.on('ride:status', _onRideStatus);
    SocketService.instance.on('driver:location', _onDriverLocation);
  }

  @override
  void dispose() {
    SocketService.instance.leaveRide(widget.rideId);
    SocketService.instance.off('ride:status');
    SocketService.instance.off('driver:location');
    super.dispose();
  }

  void _onRideStatus(dynamic data) {
    if (data['rideId'] == widget.rideId) _load();
  }

  void _onDriverLocation(dynamic data) {
    if (data['rideId'] == widget.rideId && mounted) {
      setState(() => _driverPos = TripPoint((data['lat'] as num).toDouble(), (data['lng'] as num).toDouble()));
    }
  }

  Future<void> _load() async {
    try {
      final data = await ApiClient.instance.get('/rides/${widget.rideId}');
      if (mounted) setState(() => _ride = Ride.fromJson(data));
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  Future<void> _cancel() async {
    try {
      await ApiClient.instance.post('/rides/${widget.rideId}/cancel');
      _load();
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final ride = _ride;
    return Scaffold(
      appBar: AppBar(title: const Text('Your trip'), backgroundColor: navy, foregroundColor: Colors.white),
      body: ride == null
          ? Center(child: _error != null ? Text(_error!, style: const TextStyle(color: Colors.red)) : const CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(16),
                  child: TripMapWidget(
                    pickup: TripPoint(ride.pickupLat, ride.pickupLng),
                    dropoff: TripPoint(ride.dropoffLat, ride.dropoffLng),
                    driver: _driverPos,
                  ),
                ),
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  decoration: BoxDecoration(color: gold.withOpacity(0.15), borderRadius: BorderRadius.circular(999)),
                  child: Text(_statusLabel[ride.status] ?? ride.status,
                      style: const TextStyle(fontWeight: FontWeight.bold, color: goldDark)),
                ),
                const SizedBox(height: 16),
                Card(
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(children: [const Icon(Icons.my_location, color: Colors.green, size: 18), const SizedBox(width: 8), Expanded(child: Text(ride.pickupAddress))]),
                        const SizedBox(height: 8),
                        Row(children: [const Icon(Icons.location_on, color: Colors.red, size: 18), const SizedBox(width: 8), Expanded(child: Text(ride.dropoffAddress))]),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                if (ride.driver != null)
                  Card(
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    child: ListTile(
                      leading: const CircleAvatar(backgroundColor: navy, child: Icon(Icons.person, color: Colors.white)),
                      // REST responses nest driver info under driverProfile.user/.vehicle
                      // (see backend rides.service.ts's include shape); the live
                      // "ride:status" socket event is flatter, so this favors
                      // the REST shape since _load() is what populates ride.driver.
                      title: Text(ride.driver!['user']?['name'] ?? ride.driver!['name'] ?? 'Driver'),
                      subtitle: Text(
                          '${ride.driver!['vehicle']?['color'] ?? ''} ${ride.driver!['vehicle']?['make'] ?? ''} ${ride.driver!['vehicle']?['model'] ?? ''} · ${ride.driver!['vehicle']?['plateNumber'] ?? ''}'),
                    ),
                  ),
                const SizedBox(height: 16),
                Text('Fare: ${ride.formattedFare}', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                const SizedBox(height: 20),
                if (['REQUESTED', 'SEARCHING', 'ASSIGNED'].contains(ride.status))
                  OutlinedButton(onPressed: _cancel, child: const Text('Cancel trip')),
                if (_error != null) Padding(padding: const EdgeInsets.only(top: 12), child: Text(_error!, style: const TextStyle(color: Colors.red))),
              ],
            ),
    );
  }
}
