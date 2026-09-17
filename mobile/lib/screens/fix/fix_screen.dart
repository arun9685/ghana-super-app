import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../services/api_client.dart';
import '../../state/auth_state.dart';
import '../../config/theme.dart';

const _categories = ['PLUMBING', 'ELECTRICAL', 'CLEANING', 'CARPENTRY', 'PAINTING', 'APPLIANCE_REPAIR', 'OTHER'];

const _statusLabel = {
  'REQUESTED': 'Requested',
  'ACCEPTED': 'Accepted',
  'IN_PROGRESS': 'In progress',
  'COMPLETED': 'Completed',
  'CANCELLED': 'Cancelled',
};

String _pretty(String s) => s.replaceAll('_', ' ');

// "Fix" tile: request an artisan for a home-service job, browse
// available artisans in a category, track requests already placed, and
// — for ARTISAN accounts — accept open jobs. Mirrors
// frontend/src/pages/fix/FixHome.tsx's exact endpoint set.
class FixScreen extends StatefulWidget {
  const FixScreen({super.key});

  @override
  State<FixScreen> createState() => _FixScreenState();
}

class _FixScreenState extends State<FixScreen> {
  String _category = 'PLUMBING';
  final _descController = TextEditingController();
  final _addressController = TextEditingController();
  List<dynamic> _artisans = [];
  List<dynamic> _myRequests = [];
  List<dynamic> _openRequests = [];
  String? _error;
  String? _success;
  bool _applying = false;
  bool _submitting = false;

  bool get _isArtisan => context.read<AuthState>().me?.roles.contains('ARTISAN') ?? false;

  @override
  void initState() {
    super.initState();
    _loadAll();
  }

  Future<void> _loadAll() async {
    try {
      final artisans = await ApiClient.instance.get('/fix/artisans', query: {'category': _category});
      if (mounted) setState(() => _artisans = artisans as List);
    } catch (_) {}
    try {
      final mine = await ApiClient.instance.get('/fix/requests');
      if (mounted) setState(() => _myRequests = mine as List);
    } catch (_) {}
    if (_isArtisan) {
      try {
        final open = await ApiClient.instance.get('/fix/requests', query: {'open': 'true'});
        if (mounted) setState(() => _openRequests = open as List);
      } catch (_) {}
    }
  }

  Future<void> _becomeArtisan() async {
    setState(() => _applying = true);
    try {
      await ApiClient.instance.post('/fix/artisans/apply', body: {'category': _category, 'bio': ''});
      await context.read<AuthState>().bootstrap();
      await _loadAll();
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _applying = false);
    }
  }

  Future<void> _submitRequest() async {
    setState(() {
      _error = null;
      _success = null;
      _submitting = true;
    });
    try {
      await ApiClient.instance.post('/fix/requests', body: {
        'category': _category,
        'description': _descController.text,
        'address': _addressController.text,
        'lat': 5.6037,
        'lng': -0.187,
      });
      _descController.clear();
      _addressController.clear();
      setState(() => _success = 'Request sent — nearby artisans will be notified.');
      await _loadAll();
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _acceptJob(String id) async {
    final controller = TextEditingController();
    final quoted = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Quoted price (GHS)'),
        content: TextField(controller: controller, keyboardType: TextInputType.number, decoration: const InputDecoration(hintText: 'e.g. 150')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(ctx, controller.text), child: const Text('Accept')),
        ],
      ),
    );
    if (quoted == null || quoted.isEmpty) return;
    final cents = ((double.tryParse(quoted) ?? 0) * 100).round();
    try {
      await ApiClient.instance.post('/fix/requests/$id/accept', body: {'quotedPriceCents': cents});
      await _loadAll();
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isArtisan = _isArtisan;
    return Scaffold(
      backgroundColor: bg,
      appBar: AppBar(
        title: const Text('Fix'),
        backgroundColor: teal,
        foregroundColor: Colors.white,
        actions: [
          if (!isArtisan)
            TextButton(
              onPressed: _applying ? null : _becomeArtisan,
              child: Text(_applying ? 'Applying…' : 'Become an artisan', style: const TextStyle(color: Colors.white)),
            ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (_error != null) Padding(padding: const EdgeInsets.only(bottom: 12), child: Text(_error!, style: const TextStyle(color: red))),
          if (_success != null) Padding(padding: const EdgeInsets.only(bottom: 12), child: Text(_success!, style: const TextStyle(color: navy))),
          Card(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Request a service', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    value: _category,
                    items: _categories.map((c) => DropdownMenuItem(value: c, child: Text(_pretty(c)))).toList(),
                    onChanged: (v) {
                      if (v == null) return;
                      setState(() => _category = v);
                      _loadAll();
                    },
                    decoration: const InputDecoration(labelText: 'Category', border: OutlineInputBorder()),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _descController,
                    maxLines: 3,
                    decoration: const InputDecoration(labelText: 'What do you need done?', border: OutlineInputBorder()),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _addressController,
                    decoration: const InputDecoration(labelText: 'Address', border: OutlineInputBorder()),
                  ),
                  const SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: _submitting ? null : _submitRequest,
                    style: ElevatedButton.styleFrom(backgroundColor: gold, foregroundColor: ink, padding: const EdgeInsets.symmetric(vertical: 14), minimumSize: const Size.fromHeight(48)),
                    child: Text(_submitting ? 'Sending…' : 'Find an artisan'),
                  ),
                  const SizedBox(height: 18),
                  Text('Artisans in ${_pretty(_category).toLowerCase()}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                  const SizedBox(height: 8),
                  for (final a in _artisans)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 4),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(a['user']?['name'] ?? a['user']?['phone'] ?? '', style: const TextStyle(fontSize: 13)),
                          Text('★ ${(a['ratingAvg'] as num).toStringAsFixed(1)} · ${a['completedJobCount']} jobs', style: const TextStyle(fontSize: 13, color: slate)),
                        ],
                      ),
                    ),
                  if (_artisans.isEmpty) const Text('No artisans registered in this category yet.', style: TextStyle(fontSize: 13, color: slate)),
                ],
              ),
            ),
          ),
          if (isArtisan) ...[
            const SizedBox(height: 16),
            Card(
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Jobs near you', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                    const SizedBox(height: 10),
                    for (final r in _openRequests)
                      Card(
                        margin: const EdgeInsets.symmetric(vertical: 4),
                        color: bg,
                        elevation: 0,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: const BorderSide(color: hair)),
                        child: Padding(
                          padding: const EdgeInsets.all(12),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(_pretty(r['category'] ?? ''), style: const TextStyle(fontWeight: FontWeight.w600)),
                              const SizedBox(height: 4),
                              Text(r['description'] ?? '', style: const TextStyle(fontSize: 13, color: slate)),
                              const SizedBox(height: 4),
                              Text(r['address'] ?? '', style: const TextStyle(fontSize: 12, color: slate)),
                              const SizedBox(height: 8),
                              ElevatedButton(
                                onPressed: () => _acceptJob(r['id']),
                                style: ElevatedButton.styleFrom(backgroundColor: navy, foregroundColor: Colors.white),
                                child: const Text('Accept & quote'),
                              ),
                            ],
                          ),
                        ),
                      ),
                    if (_openRequests.isEmpty) const Text('No open requests right now.', style: TextStyle(fontSize: 13, color: slate)),
                  ],
                ),
              ),
            ),
          ],
          const SizedBox(height: 20),
          const Text('My requests', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
          const SizedBox(height: 10),
          for (final r in _myRequests)
            Card(
              margin: const EdgeInsets.symmetric(vertical: 4),
              child: ListTile(
                title: Text(_pretty(r['category'] ?? '')),
                subtitle: Text(
                  r['quotedPriceCents'] != null
                      ? '${r['description'] ?? ''}\nQuoted: GHS ${((r['quotedPriceCents'] as int) / 100).toStringAsFixed(2)}'
                      : r['description'] ?? '',
                ),
                isThreeLine: r['quotedPriceCents'] != null,
                trailing: Chip(label: Text(_statusLabel[r['status']] ?? r['status'] ?? '', style: const TextStyle(fontSize: 11)), backgroundColor: navyLight),
              ),
            ),
          if (_myRequests.isEmpty) const Padding(padding: EdgeInsets.only(top: 8), child: Text('No requests yet.', style: TextStyle(color: slate))),
        ],
      ),
    );
  }
}
