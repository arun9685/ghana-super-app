import 'package:flutter/material.dart';
import '../../services/api_client.dart';
import '../../config/theme.dart';

const _types = [
  {'key': 'AIRTIME', 'label': 'Airtime'},
  {'key': 'DATA', 'label': 'Data bundle'},
  {'key': 'ELECTRICITY', 'label': 'ECG (Electricity)'},
  {'key': 'WATER', 'label': 'GWCL (Water)'},
  {'key': 'TV', 'label': 'TV subscription'},
];

const _providersByType = {
  'AIRTIME': ['MTN', 'Telecel', 'AirtelTigo'],
  'DATA': ['MTN', 'Telecel', 'AirtelTigo'],
  'ELECTRICITY': ['ECG'],
  'WATER': ['GWCL'],
  'TV': ['DSTV', 'GOtv', 'StarTimes'],
};

// "Utilities" tile: airtime/data top-ups and bill payments, backed by
// utility.provider.ts's mock aggregator until real telco credentials
// are wired in. Mirrors frontend/src/pages/utilities/UtilitiesHome.tsx.
class UtilitiesScreen extends StatefulWidget {
  const UtilitiesScreen({super.key});

  @override
  State<UtilitiesScreen> createState() => _UtilitiesScreenState();
}

class _UtilitiesScreenState extends State<UtilitiesScreen> {
  String _type = 'AIRTIME';
  String _provider = 'MTN';
  final _accountController = TextEditingController();
  final _amountController = TextEditingController();
  List<dynamic> _payments = [];
  String? _error;
  String? _success;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final data = await ApiClient.instance.get('/utilities');
      if (mounted) setState(() => _payments = data as List);
    } catch (_) {}
  }

  void _onTypeChange(String next) {
    setState(() {
      _type = next;
      _provider = _providersByType[next]!.first;
    });
  }

  Future<void> _submit() async {
    setState(() {
      _error = null;
      _success = null;
      _submitting = true;
    });
    try {
      final amount = double.tryParse(_amountController.text) ?? 0;
      await ApiClient.instance.post('/utilities/pay', body: {
        'type': _type,
        'provider': _provider,
        'accountRef': _accountController.text,
        'amountCents': (amount * 100).round(),
      });
      setState(() => _success = 'Payment submitted.');
      _accountController.clear();
      _amountController.clear();
      await _load();
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isPhoneType = _type == 'AIRTIME' || _type == 'DATA';
    return Scaffold(
      backgroundColor: bg,
      appBar: AppBar(
          title: const Text('Utilities'),
          backgroundColor: blue,
          foregroundColor: Colors.white),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final t in _types)
                ChoiceChip(
                  label: Text(t['label']!),
                  selected: _type == t['key'],
                  selectedColor: navyLight,
                  onSelected: (_) => _onTypeChange(t['key']!),
                ),
            ],
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
                  DropdownButtonFormField<String>(
                    value: _provider,
                    items: _providersByType[_type]!
                        .map((p) => DropdownMenuItem(value: p, child: Text(p)))
                        .toList(),
                    onChanged: (v) =>
                        setState(() => _provider = v ?? _provider),
                    decoration: const InputDecoration(
                        labelText: 'Provider', border: OutlineInputBorder()),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _accountController,
                    decoration: InputDecoration(
                        labelText: isPhoneType
                            ? 'Phone number'
                            : 'Account / meter number',
                        border: const OutlineInputBorder()),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _amountController,
                    keyboardType:
                        const TextInputType.numberWithOptions(decimal: true),
                    decoration: const InputDecoration(
                        labelText: 'Amount (GHS)',
                        border: OutlineInputBorder()),
                  ),
                  if (_error != null)
                    Padding(
                        padding: const EdgeInsets.only(top: 12),
                        child: Text(_error!,
                            style: const TextStyle(color: red, fontSize: 13))),
                  if (_success != null)
                    Padding(
                        padding: const EdgeInsets.only(top: 12),
                        child: Text(_success!,
                            style: const TextStyle(color: navy, fontSize: 13))),
                  const SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: _submitting ? null : _submit,
                    style: ElevatedButton.styleFrom(
                        backgroundColor: gold,
                        foregroundColor: ink,
                        minimumSize: const Size.fromHeight(48)),
                    child: Text(_submitting ? 'Processing…' : 'Pay now'),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 20),
          const Text('Recent payments',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
          const SizedBox(height: 10),
          for (final p in _payments)
            Card(
              margin: const EdgeInsets.symmetric(vertical: 4),
              child: ListTile(
                title: Text(
                    '${(p['type'] as String).replaceAll('_', ' ')} · ${p['provider']}'),
                subtitle: Text(p['accountRef'] ?? ''),
                trailing: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                        'GHS ${((p['amountCents'] as int) / 100).toStringAsFixed(2)}',
                        style: const TextStyle(fontWeight: FontWeight.bold)),
                    Text(p['status'] ?? '',
                        style: TextStyle(
                            fontSize: 11,
                            color: p['status'] == 'SUCCESS'
                                ? navy
                                : p['status'] == 'FAILED'
                                    ? red
                                    : slate)),
                  ],
                ),
              ),
            ),
          if (_payments.isEmpty)
            const Padding(
                padding: EdgeInsets.only(top: 8),
                child:
                    Text('No payments yet.', style: TextStyle(color: slate))),
        ],
      ),
    );
  }
}
