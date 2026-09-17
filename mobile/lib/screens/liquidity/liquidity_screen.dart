import 'package:flutter/material.dart';
import '../../services/api_client.dart';
import '../../config/theme.dart';

const _loanStatusColor = {
  'PENDING': slate,
  'APPROVED': navy,
  'REJECTED': red,
  'DISBURSED': navy,
  'REPAID': ink,
  'DEFAULTED': red,
};

// "Liquidity" tile: an in-app wallet (top-up + ledger) and microloan
// applications, decisioned from the admin panel until a real
// credit-scoring integration replaces loan.provider.ts's manual review.
// Mirrors frontend/src/pages/liquidity/LiquidityHome.tsx.
class LiquidityScreen extends StatefulWidget {
  const LiquidityScreen({super.key});

  @override
  State<LiquidityScreen> createState() => _LiquidityScreenState();
}

class _LiquidityScreenState extends State<LiquidityScreen> {
  Map<String, dynamic>? _wallet;
  List<dynamic> _loans = [];
  final _topUpController = TextEditingController();
  final _loanAmountController = TextEditingController();
  final _loanPurposeController = TextEditingController();
  String? _error;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final wallet = await ApiClient.instance.get('/liquidity/wallet');
      if (mounted) setState(() => _wallet = wallet as Map<String, dynamic>);
    } catch (_) {}
    try {
      final loans = await ApiClient.instance.get('/liquidity/loans');
      if (mounted) setState(() => _loans = loans as List);
    } catch (_) {}
  }

  Future<void> _topUp() async {
    setState(() {
      _error = null;
      _busy = true;
    });
    try {
      final amount = double.tryParse(_topUpController.text) ?? 0;
      await ApiClient.instance.post('/liquidity/wallet/topup', body: {'amountCents': (amount * 100).round(), 'method': 'MOBILE_MONEY'});
      _topUpController.clear();
      await _load();
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _applyLoan() async {
    setState(() {
      _error = null;
      _busy = true;
    });
    try {
      final amount = double.tryParse(_loanAmountController.text) ?? 0;
      await ApiClient.instance.post('/liquidity/loans', body: {
        'amountCents': (amount * 100).round(),
        if (_loanPurposeController.text.isNotEmpty) 'purpose': _loanPurposeController.text,
      });
      _loanAmountController.clear();
      _loanPurposeController.clear();
      await _load();
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final balanceCents = (_wallet?['balanceCents'] as int?) ?? 0;
    final transactions = (_wallet?['transactions'] as List?) ?? [];
    return Scaffold(
      backgroundColor: bg,
      appBar: AppBar(title: const Text('Liquidity'), backgroundColor: goldDark, foregroundColor: Colors.white),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(color: ink, borderRadius: BorderRadius.circular(18)),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Wallet balance', style: TextStyle(color: Colors.white70, fontSize: 13)),
                const SizedBox(height: 6),
                Text('GHS ${(balanceCents / 100).toStringAsFixed(2)}', style: const TextStyle(color: Colors.white, fontSize: 30, fontWeight: FontWeight.bold)),
              ],
            ),
          ),
          const SizedBox(height: 16),
          if (_error != null) Padding(padding: const EdgeInsets.only(bottom: 12), child: Text(_error!, style: const TextStyle(color: red))),
          Card(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Top up wallet', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _topUpController,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    decoration: const InputDecoration(labelText: 'Amount (GHS)', border: OutlineInputBorder()),
                  ),
                  const SizedBox(height: 12),
                  ElevatedButton(
                    onPressed: _busy ? null : _topUp,
                    style: ElevatedButton.styleFrom(backgroundColor: gold, foregroundColor: ink, minimumSize: const Size.fromHeight(48)),
                    child: const Text('Top up'),
                  ),
                  const SizedBox(height: 18),
                  const Text('Recent activity', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                  const SizedBox(height: 8),
                  for (final t in transactions)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 4),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Expanded(child: Text(t['note'] ?? t['type'] ?? '', style: const TextStyle(fontSize: 13))),
                          Text(
                            '${['WITHDRAWAL', 'TRANSFER_OUT', 'PAYMENT'].contains(t['type']) ? '-' : '+'}GHS ${((t['amountCents'] as int) / 100).toStringAsFixed(2)}',
                            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                          ),
                        ],
                      ),
                    ),
                  if (transactions.isEmpty) const Text('No activity yet.', style: TextStyle(fontSize: 13, color: slate)),
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
                  const Text('Apply for a microloan', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _loanAmountController,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    decoration: const InputDecoration(labelText: 'Amount (GHS)', border: OutlineInputBorder()),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _loanPurposeController,
                    decoration: const InputDecoration(labelText: 'Purpose (optional)', border: OutlineInputBorder()),
                  ),
                  const SizedBox(height: 12),
                  ElevatedButton(
                    onPressed: _busy ? null : _applyLoan,
                    style: ElevatedButton.styleFrom(backgroundColor: navy, foregroundColor: Colors.white, minimumSize: const Size.fromHeight(48)),
                    child: const Text('Submit application'),
                  ),
                  const SizedBox(height: 18),
                  const Text('My applications', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                  const SizedBox(height: 8),
                  for (final l in _loans)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 4),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Expanded(
                            child: Text(
                              'GHS ${((l['amountCents'] as int) / 100).toStringAsFixed(2)}${l['purpose'] != null ? ' · ${l['purpose']}' : ''}',
                              style: const TextStyle(fontSize: 13),
                            ),
                          ),
                          Chip(
                            label: Text(l['status'] ?? '', style: const TextStyle(fontSize: 11, color: Colors.white)),
                            backgroundColor: _loanStatusColor[l['status']] ?? slate,
                            padding: EdgeInsets.zero,
                            visualDensity: VisualDensity.compact,
                          ),
                        ],
                      ),
                    ),
                  if (_loans.isEmpty) const Text('No loan applications yet.', style: TextStyle(fontSize: 13, color: slate)),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
