import 'package:flutter/material.dart';
import '../../services/api_client.dart';
import '../../config/theme.dart';

const _typeLabel = {
  'RENT': 'For rent',
  'SALE': 'For sale',
  'SHORT_STAY': 'Short stay'
};

// "Property" tile: browse active listings, enquire, and — under "My
// listings" — post your own (starts PENDING_REVIEW until an admin
// approves it). Mirrors frontend/src/pages/property/PropertyHome.tsx.
class PropertyScreen extends StatefulWidget {
  const PropertyScreen({super.key});

  @override
  State<PropertyScreen> createState() => _PropertyScreenState();
}

class _PropertyScreenState extends State<PropertyScreen> {
  List<dynamic> _listings = [];
  List<dynamic> _myListings = [];
  bool _mine = false;
  String? _error;
  bool _busy = false;

  String _type = 'RENT';
  final _titleController = TextEditingController();
  final _descController = TextEditingController();
  final _areaController = TextEditingController();
  final _priceController = TextEditingController();
  final _bedroomsController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final listings = await ApiClient.instance.get('/property/listings');
      if (mounted) setState(() => _listings = listings as List);
    } catch (_) {}
    try {
      final mine = await ApiClient.instance.get('/property/listings/mine');
      if (mounted) setState(() => _myListings = mine as List);
    } catch (_) {}
  }

  Future<void> _enquire(String listingId) async {
    final controller = TextEditingController();
    final message = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Your message to the owner'),
        content: TextField(controller: controller, maxLines: 3),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          TextButton(
              onPressed: () => Navigator.pop(ctx, controller.text),
              child: const Text('Send')),
        ],
      ),
    );
    if (message == null || message.isEmpty) return;
    try {
      await ApiClient.instance.post('/property/listings/$listingId/enquiries',
          body: {'message': message});
      if (mounted)
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('Enquiry sent!')));
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    }
  }

  Future<void> _submitListing() async {
    setState(() {
      _error = null;
      _busy = true;
    });
    try {
      final price = double.tryParse(_priceController.text) ?? 0;
      await ApiClient.instance.post('/property/listings', body: {
        'title': _titleController.text,
        'description': _descController.text,
        'type': _type,
        'priceCents': (price * 100).round(),
        'area': _areaController.text,
        if (_bedroomsController.text.isNotEmpty)
          'bedrooms': int.tryParse(_bedroomsController.text),
      });
      _titleController.clear();
      _descController.clear();
      _areaController.clear();
      _priceController.clear();
      _bedroomsController.clear();
      await _load();
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: bg,
      appBar: AppBar(
          title: const Text('Property'),
          backgroundColor: brown,
          foregroundColor: Colors.white),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => setState(() => _mine = false),
                    style: OutlinedButton.styleFrom(
                        backgroundColor: !_mine ? navy : null,
                        foregroundColor: !_mine ? Colors.white : navy),
                    child: const Text('Browse listings'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => setState(() => _mine = true),
                    style: OutlinedButton.styleFrom(
                        backgroundColor: _mine ? navy : null,
                        foregroundColor: _mine ? Colors.white : navy),
                    child: const Text('My listings'),
                  ),
                ),
              ],
            ),
          ),
          if (_error != null)
            Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Text(_error!, style: const TextStyle(color: red))),
          Expanded(
            child: _mine ? _buildMine() : _buildBrowse(),
          ),
        ],
      ),
    );
  }

  Widget _buildBrowse() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        for (final l in _listings)
          Card(
            margin: const EdgeInsets.only(bottom: 14),
            shape:
                RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Chip(
                          label: Text(_typeLabel[l['type']] ?? l['type'] ?? '',
                              style: const TextStyle(fontSize: 11, color: ink)),
                          backgroundColor: gold.withOpacity(0.3)),
                      if (l['bedrooms'] != null)
                        Text('${l['bedrooms']} bed',
                            style: const TextStyle(fontSize: 12, color: slate)),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Text(l['title'] ?? '',
                      style: const TextStyle(
                          fontWeight: FontWeight.bold, fontSize: 16)),
                  Text(l['area'] ?? '',
                      style: const TextStyle(fontSize: 13, color: slate)),
                  const SizedBox(height: 8),
                  Text(l['description'] ?? '',
                      style: const TextStyle(fontSize: 13, color: slate)),
                  const SizedBox(height: 12),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                          'GHS ${((l['priceCents'] as int) / 100).toStringAsFixed(0)}',
                          style: const TextStyle(fontWeight: FontWeight.bold)),
                      ElevatedButton(
                        onPressed: () => _enquire(l['id']),
                        style: ElevatedButton.styleFrom(
                            backgroundColor: navy,
                            foregroundColor: Colors.white),
                        child: const Text('Enquire'),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        if (_listings.isEmpty)
          const Padding(
              padding: EdgeInsets.only(top: 40),
              child: Center(
                  child: Text('No active listings right now.',
                      style: TextStyle(color: slate)))),
      ],
    );
  }

  Widget _buildMine() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Card(
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Post a listing',
                    style:
                        TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                const SizedBox(height: 12),
                TextField(
                    controller: _titleController,
                    decoration: const InputDecoration(
                        labelText: 'Title', border: OutlineInputBorder())),
                const SizedBox(height: 10),
                TextField(
                    controller: _descController,
                    maxLines: 3,
                    decoration: const InputDecoration(
                        labelText: 'Description',
                        border: OutlineInputBorder())),
                const SizedBox(height: 10),
                DropdownButtonFormField<String>(
                  value: _type,
                  items: const [
                    DropdownMenuItem(value: 'RENT', child: Text('For rent')),
                    DropdownMenuItem(value: 'SALE', child: Text('For sale')),
                    DropdownMenuItem(
                        value: 'SHORT_STAY', child: Text('Short stay')),
                  ],
                  onChanged: (v) => setState(() => _type = v ?? _type),
                  decoration:
                      const InputDecoration(border: OutlineInputBorder()),
                ),
                const SizedBox(height: 10),
                TextField(
                    controller: _areaController,
                    decoration: const InputDecoration(
                        labelText: 'Area (e.g. East Legon, Accra)',
                        border: OutlineInputBorder())),
                const SizedBox(height: 10),
                TextField(
                    controller: _priceController,
                    keyboardType:
                        const TextInputType.numberWithOptions(decimal: true),
                    decoration: const InputDecoration(
                        labelText: 'Price (GHS)',
                        border: OutlineInputBorder())),
                const SizedBox(height: 10),
                TextField(
                    controller: _bedroomsController,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                        labelText: 'Bedrooms (optional)',
                        border: OutlineInputBorder())),
                const SizedBox(height: 16),
                ElevatedButton(
                  onPressed: _busy ? null : _submitListing,
                  style: ElevatedButton.styleFrom(
                      backgroundColor: gold,
                      foregroundColor: ink,
                      minimumSize: const Size.fromHeight(48)),
                  child: const Text('Submit for review'),
                ),
                const SizedBox(height: 8),
                const Text(
                    'New listings are reviewed by an admin before they go live.',
                    style: TextStyle(fontSize: 11, color: slate)),
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
                const Text('My listings',
                    style:
                        TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                const SizedBox(height: 10),
                for (final l in _myListings)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 6),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(l['title'] ?? '',
                                  style: const TextStyle(
                                      fontWeight: FontWeight.w600,
                                      fontSize: 14)),
                              Text(
                                  'GHS ${((l['priceCents'] as int) / 100).toStringAsFixed(0)}',
                                  style: const TextStyle(
                                      fontSize: 12, color: slate)),
                            ],
                          ),
                        ),
                        Chip(
                          label: Text(l['status'] ?? '',
                              style: const TextStyle(
                                  fontSize: 11, color: Colors.white)),
                          backgroundColor: l['status'] == 'ACTIVE'
                              ? navy
                              : l['status'] == 'REMOVED'
                                  ? red
                                  : slate,
                        ),
                      ],
                    ),
                  ),
                if (_myListings.isEmpty)
                  const Text("You haven't posted a listing yet.",
                      style: TextStyle(fontSize: 13, color: slate)),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
