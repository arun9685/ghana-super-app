import 'package:flutter/material.dart';
import '../../services/api_client.dart';
import '../../config/theme.dart';

class DriverApplyScreen extends StatefulWidget {
  final VoidCallback? onBack;
  const DriverApplyScreen({super.key, this.onBack});

  @override
  State<DriverApplyScreen> createState() => _DriverApplyScreenState();
}

class _DriverApplyScreenState extends State<DriverApplyScreen> {
  final _license = TextEditingController();
  final _make = TextEditingController();
  final _model = TextEditingController();
  final _color = TextEditingController();
  final _plate = TextEditingController();
  String _type = 'SEDAN';
  bool _submitting = false;
  String? _error;
  bool _submitted = false;

  Future<void> _submit() async {
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      await ApiClient.instance.post('/drivers/apply', body: {
        'licenseNumber': _license.text,
        'vehicle': {
          'type': _type,
          'make': _make.text,
          'model': _model.text,
          'color': _color.text,
          'plateNumber': _plate.text,
        },
      });
      setState(() => _submitted = true);
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Become a driver'),
        backgroundColor: navy,
        foregroundColor: Colors.white,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          tooltip: 'Back',
          onPressed: widget.onBack ?? () => Navigator.of(context).maybePop(),
        ),
      ),
      body: _submitted
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Text(
                      'Application submitted! An admin will review your documents — you can go online once approved.',
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 16),
                    ),
                    const SizedBox(height: 20),
                    ElevatedButton(
                      onPressed: widget.onBack ??
                          () => Navigator.of(context).maybePop(),
                      style: ElevatedButton.styleFrom(
                          backgroundColor: gold, foregroundColor: navy),
                      child: const Text('Back to home'),
                    ),
                  ],
                ),
              ),
            )
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                TextField(
                    controller: _license,
                    decoration: const InputDecoration(
                        labelText: 'License number',
                        border: OutlineInputBorder())),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  value: _type,
                  decoration: const InputDecoration(
                      labelText: 'Vehicle type', border: OutlineInputBorder()),
                  items: const ['MOTORBIKE', 'TUKTUK', 'SEDAN', 'SUV']
                      .map((t) => DropdownMenuItem(value: t, child: Text(t)))
                      .toList(),
                  onChanged: (v) => setState(() => _type = v ?? 'SEDAN'),
                ),
                const SizedBox(height: 12),
                TextField(
                    controller: _make,
                    decoration: const InputDecoration(
                        labelText: 'Make (e.g. Toyota)',
                        border: OutlineInputBorder())),
                const SizedBox(height: 12),
                TextField(
                    controller: _model,
                    decoration: const InputDecoration(
                        labelText: 'Model (e.g. Corolla)',
                        border: OutlineInputBorder())),
                const SizedBox(height: 12),
                TextField(
                    controller: _color,
                    decoration: const InputDecoration(
                        labelText: 'Color', border: OutlineInputBorder())),
                const SizedBox(height: 12),
                TextField(
                    controller: _plate,
                    decoration: const InputDecoration(
                        labelText: 'Plate number',
                        border: OutlineInputBorder())),
                if (_error != null)
                  Padding(
                      padding: const EdgeInsets.only(top: 12),
                      child: Text(_error!,
                          style: const TextStyle(color: Colors.red))),
                const SizedBox(height: 20),
                ElevatedButton(
                  onPressed: _submitting ? null : _submit,
                  style: ElevatedButton.styleFrom(
                      backgroundColor: gold,
                      foregroundColor: navy,
                      padding: const EdgeInsets.symmetric(vertical: 16)),
                  child:
                      Text(_submitting ? 'Submitting…' : 'Submit application'),
                ),
              ],
            ),
    );
  }
}
