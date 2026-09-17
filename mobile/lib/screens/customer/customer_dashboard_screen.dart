import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../state/auth_state.dart';
import '../../services/api_client.dart';
import '../../models/models.dart';
import 'book_ride_screen.dart';
import 'ride_tracking_screen.dart';
import '../../config/theme.dart';
import '../eat/eat_screen.dart';
import '../fix/fix_screen.dart';
import '../utilities/utilities_screen.dart';
import '../liquidity/liquidity_screen.dart';
import '../fleet/fleet_screen.dart';
import '../property/property_screen.dart';
import '../travel/travel_screen.dart';

class CustomerDashboardScreen extends StatefulWidget {
  const CustomerDashboardScreen({super.key});

  @override
  State<CustomerDashboardScreen> createState() => _CustomerDashboardScreenState();
}

class _CustomerDashboardScreenState extends State<CustomerDashboardScreen> {
  Ride? _activeRide;

  @override
  void initState() {
    super.initState();
    _loadActiveRide();
  }

  Future<void> _loadActiveRide() async {
    try {
      final data = await ApiClient.instance.get('/rides', query: {'status': 'active'});
      final list = (data as List).map((r) => Ride.fromJson(r)).toList();
      setState(() => _activeRide = list.isNotEmpty ? list.first : null);
    } catch (_) {}
  }

  // Same eight tiles, same per-service accent colors and icon concepts
  // as the approved POC's `SERVICES` array (see config/theme.dart). All
  // eight are now live, matching the web app's dashboard.
  static const _tiles = [
    {'key': 'move', 'label': 'Move', 'desc': 'Book a ride across Accra', 'live': true},
    {'key': 'eat', 'label': 'Eat', 'desc': 'Order from kitchens near you', 'live': true},
    {'key': 'utilities', 'label': 'Utilities', 'desc': 'Airtime, power and water', 'live': true},
    {'key': 'fix', 'label': 'Fix', 'desc': 'Verified home service providers', 'live': true},
    {'key': 'liquidity', 'label': 'Liquidity', 'desc': 'Wallet & micro-loans', 'live': true},
    {'key': 'fleet', 'label': 'Fleet', 'desc': 'Manage company vehicles', 'live': true},
    {'key': 'property', 'label': 'Property', 'desc': 'Rent or buy across Ghana', 'live': true},
    {'key': 'travel', 'label': 'Travel', 'desc': 'Fly across the continent', 'live': true},
  ];

  static Widget _screenFor(String key) {
    switch (key) {
      case 'move':
        return const BookRideScreen();
      case 'eat':
        return const EatScreen();
      case 'utilities':
        return const UtilitiesScreen();
      case 'fix':
        return const FixScreen();
      case 'liquidity':
        return const LiquidityScreen();
      case 'fleet':
        return const FleetScreen();
      case 'property':
        return const PropertyScreen();
      case 'travel':
        return const TravelScreen();
      default:
        return const BookRideScreen();
    }
  }

  @override
  Widget build(BuildContext context) {
    final me = context.watch<AuthState>().me;

    return Scaffold(
      backgroundColor: bg,
      appBar: AppBar(
        title: const Row(mainAxisSize: MainAxisSize.min, children: [SankofaMark(size: 28, light: true), SizedBox(width: 10), Text('Sankofa')]),
        backgroundColor: navy,
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () => context.read<AuthState>().logout(),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _loadActiveRide,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text('Hello, ${me?.name?.split(' ').first ?? 'there'}', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, letterSpacing: -0.3, color: ink)),
            const SizedBox(height: 4),
            const Text('What would you like to do today?', style: TextStyle(color: slate)),
            const SizedBox(height: 16),
            if (_activeRide != null)
              Card(
                color: ink,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                child: ListTile(
                  onTap: () => Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => RideTrackingScreen(rideId: _activeRide!.id)),
                  ),
                  leading: const Icon(Icons.circle, color: Color(0xFF4ADE80), size: 10),
                  title: Text('${_activeRide!.pickupAddress} → ${_activeRide!.dropoffAddress}',
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                  subtitle: Text('Trip in progress · ${_activeRide!.status}', style: const TextStyle(color: Colors.white70)),
                  trailing: const Icon(Icons.chevron_right, color: Colors.white),
                ),
              ),
            const SizedBox(height: 16),
            const Text('Services', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, letterSpacing: -0.3, color: ink)),
            const SizedBox(height: 10),
            GridView.count(
              crossAxisCount: 4,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: 10,
              crossAxisSpacing: 10,
              childAspectRatio: 0.82,
              children: _tiles.map((t) {
                final live = t['live'] as bool;
                final key = t['key'] as String;
                return _TileCard(
                  serviceKey: key,
                  label: t['label'] as String,
                  live: live,
                  onTap: live
                      ? () => Navigator.push(context, MaterialPageRoute(builder: (_) => _screenFor(key)))
                      : null,
                );
              }).toList(),
            ),
          ],
        ),
      ),
    );
  }
}

class _TileCard extends StatelessWidget {
  final String serviceKey;
  final String label;
  final bool live;
  final VoidCallback? onTap;

  const _TileCard({required this.serviceKey, required this.label, required this.live, this.onTap});

  @override
  Widget build(BuildContext context) {
    final color = serviceColors[serviceKey] ?? navy;
    final icon = serviceIcons[serviceKey] ?? Icons.circle;
    return Opacity(
      opacity: live ? 1 : 0.5,
      child: Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(15),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(15),
          child: Container(
            decoration: BoxDecoration(borderRadius: BorderRadius.circular(15), border: Border.all(color: hair)),
            padding: const EdgeInsets.symmetric(vertical: 11, horizontal: 5),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(color: color.withOpacity(0.08), borderRadius: BorderRadius.circular(12)),
                  child: Icon(icon, color: color, size: 19),
                ),
                const SizedBox(height: 7),
                Text(label, style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: ink), textAlign: TextAlign.center),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
