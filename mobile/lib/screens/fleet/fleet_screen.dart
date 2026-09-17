import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../services/api_client.dart';
import '../../state/auth_state.dart';
import '../../config/theme.dart';

const _vehicleTypes = ['MOTORBIKE', 'TUKTUK', 'SEDAN', 'SUV'];

// "Fleet" tile: for FLEET_OWNER accounts managing several vehicles.
// A CUSTOMER account self-upgrades by registering a fleet — the first
// successful POST /fleet auto-creates the fleet record and grants the
// role, same self-service pattern as Fix's applyAsArtisan. Mirrors
// frontend/src/pages/fleet/FleetHome.tsx.
class FleetScreen extends StatefulWidget {
  const FleetScreen({super.key});

  @override
  State<FleetScreen> createState() => _FleetScreenState();
}

class _FleetScreenState extends State<FleetScreen> {
  List<dynamic> _vehicles = [];
  String? _error;
  bool _busy = false;

  String _type = 'SEDAN';
  final _makeController = TextEditingController();
  final _modelController = TextEditingController();
  final _colorController = TextEditingController();
  final _plateController = TextEditingController();

  bool get _isFleetOwner =>
      context.read<AuthState>().me?.roles.contains('FLEET_OWNER') ?? false;

  @override
  void initState() {
    super.initState();
    if (_isFleetOwner) _load();
  }

  Future<void> _load() async {
    try {
      final data = await ApiClient.instance.get('/fleet/vehicles');
      if (mounted) setState(() => _vehicles = data as List);
    } catch (_) {}
  }

  Future<void> _registerFleet() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    // Captured before the first `await` — see fix_screen.dart's
    // _becomeArtisan for why (using `context` after an async gap risks
    // acting on a disposed widget's BuildContext).
    final authState = context.read<AuthState>();
    try {
      final me = authState.me;
      await ApiClient.instance
          .post('/fleet', body: {'name': '${me?.name ?? 'My'} Fleet'});
      await authState.bootstrap();
      await _load();
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _addVehicle() async {
    setState(() {
      _error = null;
      _busy = true;
    });
    try {
      await ApiClient.instance.post('/fleet/vehicles', body: {
        'type': _type,
        'make': _makeController.text,
        'model': _modelController.text,
        'color': _colorController.text,
        'plateNumber': _plateController.text,
      });
      _makeController.clear();
      _modelController.clear();
      _colorController.clear();
      _plateController.clear();
      await _load();
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!_isFleetOwner) {
      return Scaffold(
        backgroundColor: bg,
        appBar: AppBar(
            title: const Text('Fleet'),
            backgroundColor: purple,
            foregroundColor: Colors.white),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 64,
                  height: 64,
                  decoration: BoxDecoration(
                      color: purple.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(18)),
                  child: const Icon(Icons.local_shipping_rounded,
                      color: purple, size: 30),
                ),
                const SizedBox(height: 16),
                const Text('Register your fleet',
                    style:
                        TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                const SizedBox(height: 8),
                const Text(
                  'Own several vehicles? Register a fleet to add vehicles and assign approved drivers to them.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: slate, fontSize: 14),
                ),
                if (_error != null)
                  Padding(
                      padding: const EdgeInsets.only(top: 12),
                      child: Text(_error!, style: const TextStyle(color: red))),
                const SizedBox(height: 16),
                ElevatedButton(
                  onPressed: _busy ? null : _registerFleet,
                  style: ElevatedButton.styleFrom(
                      backgroundColor: gold, foregroundColor: ink),
                  child: Text(_busy ? 'Registering…' : 'Register my fleet'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: bg,
      appBar: AppBar(
          title: const Text('Fleet'),
          backgroundColor: purple,
          foregroundColor: Colors.white),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (_error != null)
            Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Text(_error!, style: const TextStyle(color: red))),
          Card(
            shape:
                RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Add a vehicle',
                      style:
                          TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    value: _type,
                    items: _vehicleTypes
                        .map((t) => DropdownMenuItem(value: t, child: Text(t)))
                        .toList(),
                    onChanged: (v) => setState(() => _type = v ?? _type),
                    decoration:
                        const InputDecoration(border: OutlineInputBorder()),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                      controller: _makeController,
                      decoration: const InputDecoration(
                          labelText: 'Make (e.g. Toyota)',
                          border: OutlineInputBorder())),
                  const SizedBox(height: 10),
                  TextField(
                      controller: _modelController,
                      decoration: const InputDecoration(
                          labelText: 'Model (e.g. Corolla)',
                          border: OutlineInputBorder())),
                  const SizedBox(height: 10),
                  TextField(
                      controller: _colorController,
                      decoration: const InputDecoration(
                          labelText: 'Color', border: OutlineInputBorder())),
                  const SizedBox(height: 10),
                  TextField(
                      controller: _plateController,
                      decoration: const InputDecoration(
                          labelText: 'Plate number',
                          border: OutlineInputBorder())),
                  const SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: _busy ? null : _addVehicle,
                    style: ElevatedButton.styleFrom(
                        backgroundColor: gold,
                        foregroundColor: ink,
                        minimumSize: const Size.fromHeight(48)),
                    child: const Text('Add vehicle'),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          Card(
            shape:
                RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Fleet vehicles (${_vehicles.length})',
                      style: const TextStyle(
                          fontWeight: FontWeight.bold, fontSize: 16)),
                  const SizedBox(height: 10),
                  for (final v in _vehicles)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('${v['color']} ${v['make']} ${v['model']}',
                                    style: const TextStyle(
                                        fontWeight: FontWeight.w600,
                                        fontSize: 14)),
                                Text('${v['plateNumber']} · ${v['type']}',
                                    style: const TextStyle(
                                        fontSize: 12, color: slate)),
                              ],
                            ),
                          ),
                          if (v['assignedDriver'] != null)
                            Chip(
                              label: Text(
                                  v['assignedDriver']['user']?['name'] ??
                                      v['assignedDriver']['user']?['phone'] ??
                                      '',
                                  style: const TextStyle(
                                      fontSize: 11, color: Colors.white)),
                              backgroundColor: navy,
                            )
                          else
                            const Chip(
                                label: Text('Unassigned',
                                    style: TextStyle(fontSize: 11)),
                                backgroundColor: hair),
                        ],
                      ),
                    ),
                  if (_vehicles.isEmpty)
                    const Text('No vehicles yet — add one to get started.',
                        style: TextStyle(fontSize: 13, color: slate)),
                  const SizedBox(height: 10),
                  const Text(
                    "To assign a driver, use an approved driver's profile ID via the API (POST /fleet/vehicles/:id/assign) — a driver picker UI can be added once fleet accounts are onboarded.",
                    style: TextStyle(fontSize: 11, color: slate),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
