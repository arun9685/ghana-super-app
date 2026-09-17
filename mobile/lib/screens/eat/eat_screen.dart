import 'package:flutter/material.dart';
import '../../services/api_client.dart';
import '../../config/theme.dart';

// "Eat" tile: browse restaurants, build a single-restaurant cart, place
// an order, and track it — same endpoints as frontend/src/pages/eat/*.tsx
// (GET /eat/restaurants, POST /eat/orders, GET /eat/orders[/:id]).
class EatScreen extends StatefulWidget {
  const EatScreen({super.key});

  @override
  State<EatScreen> createState() => _EatScreenState();
}

class _EatScreenState extends State<EatScreen> {
  List<dynamic> _restaurants = [];
  bool _loading = true;
  String? _error;
  final Map<String, Map<String, dynamic>> _cart = {}; // menuItemId -> {restaurantId, item, qty}

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final data = await ApiClient.instance.get('/eat/restaurants');
      setState(() {
        _restaurants = data as List;
        _loading = false;
      });
    } on ApiException catch (e) {
      setState(() {
        _error = e.message;
        _loading = false;
      });
    }
  }

  void _addToCart(String restaurantId, Map<String, dynamic> item) {
    setState(() {
      final currentRestaurant = _cart.values.isNotEmpty ? _cart.values.first['restaurantId'] as String : null;
      if (currentRestaurant != null && currentRestaurant != restaurantId) _cart.clear();
      final existing = _cart[item['id']];
      _cart[item['id']] = {'restaurantId': restaurantId, 'item': item, 'qty': (existing?['qty'] ?? 0) + 1};
    });
  }

  int get _cartTotalCents => _cart.values.fold(0, (sum, c) => sum + ((c['item']['priceCents'] as int) * (c['qty'] as int)));

  Future<void> _placeOrder() async {
    if (_cart.isEmpty) return;
    final restaurantId = _cart.values.first['restaurantId'] as String;
    try {
      final order = await ApiClient.instance.post('/eat/orders', body: {
        'restaurantId': restaurantId,
        'items': _cart.values.map((c) => {'menuItemId': c['item']['id'], 'quantity': c['qty']}).toList(),
        'deliveryAddress': 'My saved address',
        'deliveryLat': 5.6037,
        'deliveryLng': -0.187,
        'paymentMethod': 'CASH',
      });
      setState(() => _cart.clear());
      if (!mounted) return;
      Navigator.push(context, MaterialPageRoute(builder: (_) => EatOrderDetailScreen(orderId: order['id'])));
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: bg,
      appBar: AppBar(
        title: const Text('Eat'),
        backgroundColor: navy,
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            icon: const Icon(Icons.receipt_long),
            onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const EatOrdersScreen())),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Text(_error!, style: const TextStyle(color: red)))
              : ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    for (final r in _restaurants) _RestaurantCard(restaurant: r, onAdd: _addToCart),
                    if (_restaurants.isEmpty) const Padding(padding: EdgeInsets.only(top: 40), child: Center(child: Text('No restaurants available yet.', style: TextStyle(color: slate)))),
                  ],
                ),
      bottomNavigationBar: _cart.isNotEmpty
          ? SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: ElevatedButton(
                  onPressed: _placeOrder,
                  style: ElevatedButton.styleFrom(backgroundColor: gold, foregroundColor: ink, padding: const EdgeInsets.symmetric(vertical: 16)),
                  child: Text('Place order · GHS ${(_cartTotalCents / 100).toStringAsFixed(2)}'),
                ),
              ),
            )
          : null,
    );
  }
}

class _RestaurantCard extends StatelessWidget {
  final dynamic restaurant;
  final void Function(String restaurantId, Map<String, dynamic> item) onAdd;
  const _RestaurantCard({required this.restaurant, required this.onAdd});

  @override
  Widget build(BuildContext context) {
    final menuItems = (restaurant['menuItems'] as List?) ?? [];
    return Card(
      margin: const EdgeInsets.only(bottom: 14),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(restaurant['name'] ?? '', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
            Text('${restaurant['area'] ?? ''}', style: const TextStyle(fontSize: 12.5, color: slate)),
            const SizedBox(height: 10),
            for (final item in menuItems)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(item['name'] ?? '', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13.5)),
                          Text('GHS ${((item['priceCents'] as int) / 100).toStringAsFixed(2)}', style: const TextStyle(fontSize: 12.5, color: slate)),
                        ],
                      ),
                    ),
                    TextButton(
                      onPressed: () => onAdd(restaurant['id'], item),
                      style: TextButton.styleFrom(backgroundColor: navy, foregroundColor: Colors.white, padding: const EdgeInsets.symmetric(horizontal: 14)),
                      child: const Text('Add'),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class EatOrdersScreen extends StatefulWidget {
  const EatOrdersScreen({super.key});
  @override
  State<EatOrdersScreen> createState() => _EatOrdersScreenState();
}

class _EatOrdersScreenState extends State<EatOrdersScreen> {
  List<dynamic> _orders = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    ApiClient.instance.get('/eat/orders').then((data) {
      if (mounted) setState(() { _orders = data as List; _loading = false; });
    }).catchError((_) { if (mounted) setState(() => _loading = false); });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('My orders'), backgroundColor: navy, foregroundColor: Colors.white),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                for (final o in _orders)
                  Card(
                    child: ListTile(
                      title: Text(o['restaurant']?['name'] ?? ''),
                      subtitle: Text(o['status'] ?? ''),
                      onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => EatOrderDetailScreen(orderId: o['id']))),
                    ),
                  ),
                if (_orders.isEmpty) const Center(child: Padding(padding: EdgeInsets.only(top: 40), child: Text('No orders yet.', style: TextStyle(color: slate)))),
              ],
            ),
    );
  }
}

class EatOrderDetailScreen extends StatefulWidget {
  final String orderId;
  const EatOrderDetailScreen({super.key, required this.orderId});
  @override
  State<EatOrderDetailScreen> createState() => _EatOrderDetailScreenState();
}

class _EatOrderDetailScreenState extends State<EatOrderDetailScreen> {
  Map<String, dynamic>? _order;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final data = await ApiClient.instance.get('/eat/orders/${widget.orderId}');
    if (mounted) setState(() => _order = data as Map<String, dynamic>);
  }

  @override
  Widget build(BuildContext context) {
    final order = _order;
    return Scaffold(
      appBar: AppBar(title: const Text('Order'), backgroundColor: navy, foregroundColor: Colors.white),
      body: order == null
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Text(order['restaurant']?['name'] ?? '', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                const SizedBox(height: 8),
                Chip(label: Text(order['status'] ?? ''), backgroundColor: navyLight),
                const SizedBox(height: 16),
                for (final it in (order['items'] as List? ?? []))
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: Text('${it['quantity']}× ${it['menuItem']?['name'] ?? ''}'),
                  ),
                const Divider(),
                Text('Total: GHS ${((order['totalCents'] as int? ?? 0) / 100).toStringAsFixed(2)}', style: const TextStyle(fontWeight: FontWeight.bold)),
              ],
            ),
    );
  }
}
