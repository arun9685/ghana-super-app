import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../services/api_client.dart';
import '../../services/socket_service.dart';
import '../../state/auth_state.dart';
import '../../models/models.dart';
import '../../widgets/trip_map_painter.dart';
import '../../config/theme.dart';

// Driver-side flow: go online/offline, receive a new-assignment push
// over the socket, then arrived -> start -> complete on the assigned
// ride — the same lifecycle as frontend/src/pages/DriverDashboard.tsx,
// driven by the same /locations and /rides endpoints.
class DriverDashboardScreen extends StatefulWidget {
  const DriverDashboardScreen({super.key});

  @override
  State<DriverDashboardScreen> createState() => _DriverDashboardScreenState();
}

class _DriverDashboardScreenState extends State<DriverDashboardScreen> {
  bool _online = false;
  bool _busy = false;
  Ride? _activeRide;
  String? _error;
  Timer? _pingTimer;

  @override
  void initState() {
    super.initState();
    _loadActiveRide();
    SocketService.instance.on('ride:new_assignment', _onNewAssignment);
  }

  @override
  void dispose() {
    _pingTimer?.cancel();
    SocketService.instance.off('ride:new_assignment');
    super.dispose();
  }

  void _onNewAssignment(dynamic data) {
    _loadActiveRide();
  }

  Future<void> _loadActiveRide() async {
    try {
      final data = await ApiClient.instance.get('/rides/active-for-driver');
      if (mounted)
        setState(() => _activeRide = data != null ? Ride.fromJson(data) : null);
      if (_activeRide != null) SocketService.instance.joinRide(_activeRide!.id);
    } catch (_) {}
  }

  Future<void> _toggleOnline() async {
    setState(() => _busy = true);
    try {
      if (_online) {
        await ApiClient.instance.post('/locations/offline');
        _pingTimer?.cancel();
        setState(() => _online = false);
      } else {
        await ApiClient.instance.post('/locations/online');
        setState(() => _online = true);
        // Simple periodic "I'm here" ping using Accra-area coordinates
        // as a stand-in for real GPS — see mobile/README.md for wiring
        // up `geolocator` for real device location.
        _pingTimer = Timer.periodic(const Duration(seconds: 8), (_) {
          ApiClient.instance
              .post('/locations/ping', body: {'lat': 5.6037, 'lng': -0.187});
        });
      }
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      setState(() => _busy = false);
    }
  }

  Future<void> _advance(String action) async {
    if (_activeRide == null) return;
    setState(() => _busy = true);
    try {
      await ApiClient.instance.post('/rides/${_activeRide!.id}/$action');
      await _loadActiveRide();
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final me = context.watch<AuthState>().me;
    return Scaffold(
      backgroundColor: bg,
      appBar: AppBar(
        title: const Text('Drive'),
        backgroundColor: navy,
        foregroundColor: Colors.white,
        actions: [
          IconButton(
              icon: const Icon(Icons.logout),
              onPressed: () => context.read<AuthState>().logout())
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text('Welcome, ${me?.name ?? 'driver'}',
              style:
                  const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
          const SizedBox(height: 16),
          Card(
            color: _online ? navy : ink,
            shape:
                RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            child: ListTile(
              title: Text(_online ? "You're online" : "You're offline",
                  style: const TextStyle(
                      color: Colors.white, fontWeight: FontWeight.bold)),
              subtitle: Text(
                  _online
                      ? 'Looking for ride requests nearby'
                      : 'Go online to start receiving rides',
                  style: const TextStyle(color: Colors.white70)),
              trailing: Switch(
                  value: _online,
                  onChanged: _busy || _activeRide != null
                      ? null
                      : (_) => _toggleOnline(),
                  activeColor: gold),
            ),
          ),
          if (_error != null)
            Padding(
                padding: const EdgeInsets.only(top: 12),
                child:
                    Text(_error!, style: const TextStyle(color: Colors.red))),
          const SizedBox(height: 16),
          if (_activeRide != null)
            _ActiveRideCard(
                ride: _activeRide!, busy: _busy, onAdvance: _advance),
          if (_activeRide == null && _online)
            const Padding(
              padding: EdgeInsets.only(top: 40),
              child: Center(
                  child: Text('Waiting for a ride request…',
                      style: TextStyle(color: Colors.grey))),
            ),
        ],
      ),
    );
  }
}

class _ActiveRideCard extends StatelessWidget {
  final Ride ride;
  final bool busy;
  final Future<void> Function(String action) onAdvance;

  const _ActiveRideCard(
      {required this.ride, required this.busy, required this.onAdvance});

  @override
  Widget build(BuildContext context) {
    final nextAction = switch (ride.status) {
      'ASSIGNED' => ('arrived', "I've arrived"),
      'ARRIVED' => ('start', 'Start trip'),
      'IN_PROGRESS' => ('complete', 'Complete trip'),
      _ => (null, null),
    };

    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: TripMapWidget(
                pickup: TripPoint(ride.pickupLat, ride.pickupLng),
                dropoff: TripPoint(ride.dropoffLat, ride.dropoffLng),
              ),
            ),
            const SizedBox(height: 12),
            Text('Pickup: ${ride.pickupAddress}'),
            const SizedBox(height: 4),
            Text('Drop-off: ${ride.dropoffAddress}'),
            const SizedBox(height: 8),
            Text('Fare: ${ride.formattedFare}',
                style: const TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(height: 16),
            if (nextAction.$1 != null)
              ElevatedButton(
                onPressed: busy ? null : () => onAdvance(nextAction.$1!),
                style: ElevatedButton.styleFrom(
                    backgroundColor: gold,
                    foregroundColor: navy,
                    padding: const EdgeInsets.symmetric(vertical: 14)),
                child: Text(nextAction.$2!),
              ),
          ],
        ),
      ),
    );
  }
}
