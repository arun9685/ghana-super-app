import 'package:flutter/material.dart';
import '../../services/api_client.dart';
import '../../config/theme.dart';

const _statusColor = {
  'PENDING': slate,
  'CONFIRMED': navy,
  'CANCELLED': red,
  'COMPLETED': ink,
};

// "Travel" tile: flight & inter-city bus bookings, fares from a mock
// provider (travel.provider.ts) until a real GDS/bus-operator
// integration is wired in — the booking lifecycle itself (create ->
// confirm -> cancel) is real. Mirrors frontend/src/pages/travel/TravelHome.tsx.
class TravelScreen extends StatefulWidget {
  const TravelScreen({super.key});

  @override
  State<TravelScreen> createState() => _TravelScreenState();
}

class _TravelScreenState extends State<TravelScreen> {
  String _type = 'BUS';
  final _originController = TextEditingController();
  final _destinationController = TextEditingController();
  DateTime? _departureDate;
  int _passengerCount = 1;
  List<dynamic> _bookings = [];
  String? _error;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final data = await ApiClient.instance.get('/travel/bookings');
      if (mounted) setState(() => _bookings = data as List);
    } catch (_) {}
  }

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(context: context, initialDate: now, firstDate: now, lastDate: now.add(const Duration(days: 365)));
    if (picked != null) setState(() => _departureDate = picked);
  }

  Future<void> _book() async {
    if (_departureDate == null) {
      setState(() => _error = 'Pick a departure date.');
      return;
    }
    setState(() {
      _error = null;
      _busy = true;
    });
    try {
      await ApiClient.instance.post('/travel/bookings', body: {
        'type': _type,
        'origin': _originController.text,
        'destination': _destinationController.text,
        'departureDate': _departureDate!.toIso8601String(),
        'passengerCount': _passengerCount,
      });
      _originController.clear();
      _destinationController.clear();
      setState(() {
        _departureDate = null;
        _passengerCount = 1;
      });
      await _load();
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _cancel(String id) async {
    try {
      await ApiClient.instance.post('/travel/bookings/$id/cancel');
      await _load();
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: bg,
      appBar: AppBar(title: const Text('Travel'), backgroundColor: travelTeal, foregroundColor: Colors.white),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (_error != null) Padding(padding: const EdgeInsets.only(bottom: 12), child: Text(_error!, style: const TextStyle(color: red))),
          Card(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: () => setState(() => _type = 'BUS'),
                          icon: const Icon(Icons.local_shipping_rounded, size: 16),
                          label: const Text('Bus'),
                          style: OutlinedButton.styleFrom(backgroundColor: _type == 'BUS' ? navy : null, foregroundColor: _type == 'BUS' ? Colors.white : navy),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: () => setState(() => _type = 'FLIGHT'),
                          icon: const Icon(Icons.flight_rounded, size: 16),
                          label: const Text('Flight'),
                          style: OutlinedButton.styleFrom(backgroundColor: _type == 'FLIGHT' ? navy : null, foregroundColor: _type == 'FLIGHT' ? Colors.white : navy),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  TextField(controller: _originController, decoration: const InputDecoration(labelText: 'From', hintText: 'Accra', border: OutlineInputBorder())),
                  const SizedBox(height: 10),
                  TextField(controller: _destinationController, decoration: const InputDecoration(labelText: 'To', hintText: 'Kumasi', border: OutlineInputBorder())),
                  const SizedBox(height: 10),
                  InkWell(
                    onTap: _pickDate,
                    child: InputDecorator(
                      decoration: const InputDecoration(labelText: 'Departure date', border: OutlineInputBorder()),
                      child: Text(_departureDate == null ? 'Select date' : '${_departureDate!.toLocal()}'.split(' ').first),
                    ),
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      const Text('Passengers', style: TextStyle(fontSize: 13, color: slate)),
                      const Spacer(),
                      IconButton(onPressed: () => setState(() => _passengerCount = (_passengerCount - 1).clamp(1, 10)), icon: const Icon(Icons.remove_circle_outline)),
                      Text('$_passengerCount'),
                      IconButton(onPressed: () => setState(() => _passengerCount = (_passengerCount + 1).clamp(1, 10)), icon: const Icon(Icons.add_circle_outline)),
                    ],
                  ),
                  const SizedBox(height: 12),
                  ElevatedButton(
                    onPressed: _busy ? null : _book,
                    style: ElevatedButton.styleFrom(backgroundColor: gold, foregroundColor: ink, minimumSize: const Size.fromHeight(48)),
                    child: Text(_busy ? 'Booking…' : 'Search & book'),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          Card(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('My bookings', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                  const SizedBox(height: 10),
                  for (final b in _bookings)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Row(
                                children: [
                                  Icon(b['type'] == 'FLIGHT' ? Icons.flight_rounded : Icons.local_shipping_rounded, size: 14, color: travelTeal),
                                  const SizedBox(width: 6),
                                  Text('${b['origin']} → ${b['destination']}', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                                ],
                              ),
                              Chip(
                                label: Text(b['status'] ?? '', style: const TextStyle(fontSize: 11, color: Colors.white)),
                                backgroundColor: _statusColor[b['status']] ?? slate,
                                padding: EdgeInsets.zero,
                                visualDensity: VisualDensity.compact,
                              ),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text(
                            '${DateTime.tryParse(b['departureDate'] ?? '')?.toLocal().toString().split(' ').first ?? ''} · ${b['passengerCount']} passenger${(b['passengerCount'] ?? 1) > 1 ? 's' : ''}'
                            '${b['priceCents'] != null ? ' · GHS ${((b['priceCents'] as int) / 100).toStringAsFixed(2)}' : ''}',
                            style: const TextStyle(fontSize: 12, color: slate),
                          ),
                          if (b['status'] == 'PENDING' || b['status'] == 'CONFIRMED')
                            Align(
                              alignment: Alignment.centerLeft,
                              child: TextButton(onPressed: () => _cancel(b['id']), child: const Text('Cancel')),
                            ),
                          const Divider(),
                        ],
                      ),
                    ),
                  if (_bookings.isEmpty) const Text('No bookings yet.', style: TextStyle(fontSize: 13, color: slate)),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
