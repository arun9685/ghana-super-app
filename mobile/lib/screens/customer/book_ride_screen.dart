import 'package:flutter/material.dart';
import '../../config/locations.dart';
import '../../services/api_client.dart';
import 'ride_tracking_screen.dart';
import '../../config/theme.dart';


class BookRideScreen extends StatefulWidget {
  const BookRideScreen({super.key});

  @override
  State<BookRideScreen> createState() => _BookRideScreenState();
}

class _BookRideScreenState extends State<BookRideScreen> {
  NamedPoint? _pickup;
  NamedPoint? _dropoff;
  String _vehicleType = 'SEDAN';
  Map<String, dynamic>? _estimate;
  bool _loadingEstimate = false;
  bool _booking = false;
  String? _error;

  final _vehicleTypes = const ['MOTORBIKE', 'TUKTUK', 'SEDAN', 'SUV'];

  Future<void> _pickLocation(bool isPickup) async {
    final selected = await showModalBottomSheet<NamedPoint>(
      context: context,
      isScrollControlled: true,
      builder: (context) => _LocationPicker(isPickup: isPickup),
    );
    if (selected != null) {
      setState(() {
        if (isPickup) {
          _pickup = selected;
        } else {
          _dropoff = selected;
        }
      });
      _maybeEstimate();
    }
  }

  Future<void> _maybeEstimate() async {
    if (_pickup == null || _dropoff == null) return;
    setState(() {
      _loadingEstimate = true;
      _error = null;
    });
    try {
      final data = await ApiClient.instance.post('/rides/estimate', body: {
        'pickup': {'lat': _pickup!.lat, 'lng': _pickup!.lng, 'address': _pickup!.name},
        'dropoff': {'lat': _dropoff!.lat, 'lng': _dropoff!.lng, 'address': _dropoff!.name},
        'vehicleType': _vehicleType,
      });
      setState(() => _estimate = data);
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      setState(() => _loadingEstimate = false);
    }
  }

  Future<void> _bookRide() async {
    if (_pickup == null || _dropoff == null) return;
    setState(() {
      _booking = true;
      _error = null;
    });
    try {
      final data = await ApiClient.instance.post('/rides', body: {
        'pickup': {'lat': _pickup!.lat, 'lng': _pickup!.lng, 'address': _pickup!.name},
        'dropoff': {'lat': _dropoff!.lat, 'lng': _dropoff!.lng, 'address': _dropoff!.name},
        'vehicleType': _vehicleType,
        'paymentMethod': 'CASH',
      });
      if (!mounted) return;
      Navigator.pushReplacement(context, MaterialPageRoute(builder: (_) => RideTrackingScreen(rideId: data['id'])));
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      setState(() => _booking = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final fare = _estimate?['fare'];
    return Scaffold(
      appBar: AppBar(title: const Text('Book a ride'), backgroundColor: navy, foregroundColor: Colors.white),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _LocationTile(label: 'Pickup', point: _pickup, icon: Icons.my_location, color: Colors.green, onTap: () => _pickLocation(true)),
          const SizedBox(height: 10),
          _LocationTile(label: 'Drop-off', point: _dropoff, icon: Icons.location_on, color: Colors.red, onTap: () => _pickLocation(false)),
          const SizedBox(height: 16),
          const Text('Vehicle type', style: TextStyle(fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            children: _vehicleTypes.map((v) {
              final selected = v == _vehicleType;
              return ChoiceChip(
                label: Text(v),
                selected: selected,
                selectedColor: gold,
                onSelected: (_) {
                  setState(() => _vehicleType = v);
                  _maybeEstimate();
                },
              );
            }).toList(),
          ),
          const SizedBox(height: 20),
          if (_loadingEstimate) const Center(child: CircularProgressIndicator()),
          if (fare != null && !_loadingEstimate)
            Card(
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('${_estimate!['distanceKm'].toStringAsFixed(1)} km · ${_estimate!['durationMin']} min',
                        style: const TextStyle(color: Colors.grey)),
                    const SizedBox(height: 6),
                    Text('GHS ${(fare['totalCents'] / 100).toStringAsFixed(2)}',
                        style: const TextStyle(fontSize: 26, fontWeight: FontWeight.bold)),
                  ],
                ),
              ),
            ),
          if (_error != null) Padding(padding: const EdgeInsets.only(top: 12), child: Text(_error!, style: const TextStyle(color: Colors.red))),
          const SizedBox(height: 20),
          ElevatedButton(
            onPressed: (_pickup != null && _dropoff != null && !_booking) ? _bookRide : null,
            style: ElevatedButton.styleFrom(backgroundColor: gold, foregroundColor: navy, padding: const EdgeInsets.symmetric(vertical: 16)),
            child: Text(_booking ? 'Booking…' : 'Book ride'),
          ),
        ],
      ),
    );
  }
}

class _LocationTile extends StatelessWidget {
  final String label;
  final NamedPoint? point;
  final IconData icon;
  final Color color;
  final VoidCallback onTap;

  const _LocationTile({required this.label, required this.point, required this.icon, required this.color, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      child: ListTile(
        onTap: onTap,
        leading: Icon(icon, color: color),
        title: Text(point?.name ?? 'Select $label'),
        subtitle: point != null ? Text(point!.area) : null,
        trailing: const Icon(Icons.chevron_right),
      ),
    );
  }
}

class _LocationPicker extends StatefulWidget {
  final bool isPickup;
  const _LocationPicker({required this.isPickup});

  @override
  State<_LocationPicker> createState() => _LocationPickerState();
}

class _LocationPickerState extends State<_LocationPicker> {
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final results = searchLocations(_query);
    return DraggableScrollableSheet(
      initialChildSize: 0.7,
      builder: (context, scrollController) => Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            Text('Select ${widget.isPickup ? "pickup" : "drop-off"}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
            const SizedBox(height: 10),
            TextField(
              decoration: const InputDecoration(hintText: 'Search a location…', prefixIcon: Icon(Icons.search), border: OutlineInputBorder()),
              onChanged: (v) => setState(() => _query = v),
            ),
            const SizedBox(height: 10),
            Expanded(
              child: ListView.builder(
                controller: scrollController,
                itemCount: results.length,
                itemBuilder: (context, i) {
                  final p = results[i];
                  return ListTile(
                    title: Text(p.name),
                    subtitle: Text(p.area),
                    onTap: () => Navigator.pop(context, p),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}
