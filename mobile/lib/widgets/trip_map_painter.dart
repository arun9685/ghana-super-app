import 'package:flutter/material.dart';

class TripPoint {
  final double lat;
  final double lng;
  const TripPoint(this.lat, this.lng);
}

// Same schematic (not geographically accurate) two-point diagram as
// frontend/src/components/TripMap.tsx: draws the relationship between
// real pickup/dropoff/driver coordinates without needing a maps API key.
class TripMapWidget extends StatelessWidget {
  final TripPoint pickup;
  final TripPoint dropoff;
  final TripPoint? driver;

  const TripMapWidget({super.key, required this.pickup, required this.dropoff, this.driver});

  @override
  Widget build(BuildContext context) {
    return AspectRatio(
      aspectRatio: 560 / 260,
      child: CustomPaint(
        painter: _TripMapPainter(pickup: pickup, dropoff: dropoff, driver: driver),
        child: Container(),
      ),
    );
  }
}

class _TripMapPainter extends CustomPainter {
  final TripPoint pickup;
  final TripPoint dropoff;
  final TripPoint? driver;

  _TripMapPainter({required this.pickup, required this.dropoff, this.driver});

  @override
  void paint(Canvas canvas, Size size) {
    final bgPaint = Paint()..color = const Color(0xFFF5F7F6);
    canvas.drawRect(Offset.zero & size, bgPaint);

    final gridPaint = Paint()
      ..color = const Color(0xFFE8EBE9)
      ..strokeWidth = 1;
    for (double x = 0; x < size.width; x += 28) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), gridPaint);
    }
    for (double y = 0; y < size.height; y += 28) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), gridPaint);
    }

    final lats = [pickup.lat, dropoff.lat, if (driver != null) driver!.lat];
    final lngs = [pickup.lng, dropoff.lng, if (driver != null) driver!.lng];
    final minLat = lats.reduce((a, b) => a < b ? a : b) - 0.004;
    final maxLat = lats.reduce((a, b) => a > b ? a : b) + 0.004;
    final minLng = lngs.reduce((a, b) => a < b ? a : b) - 0.004;
    final maxLng = lngs.reduce((a, b) => a > b ? a : b) + 0.004;

    Offset toXY(double lat, double lng) {
      final x = ((lng - minLng) / ((maxLng - minLng) == 0 ? 1 : (maxLng - minLng))) * (size.width - 80) + 40;
      final y = size.height - (((lat - minLat) / ((maxLat - minLat) == 0 ? 1 : (maxLat - minLat))) * (size.height - 80) + 40);
      return Offset(x, y);
    }

    final p = toXY(pickup.lat, pickup.lng);
    final d = toXY(dropoff.lat, dropoff.lng);

    final linePaint = Paint()
      ..color = const Color(0xFF0B0F0D).withOpacity(0.5)
      ..strokeWidth = 3;
    canvas.drawLine(p, d, linePaint);

    canvas.drawCircle(p, 9, Paint()..color = const Color(0xFF0A7A4B));
    canvas.drawCircle(p, 9, Paint()..color = Colors.white..style = PaintingStyle.stroke..strokeWidth = 3);
    _drawLabel(canvas, 'Pickup', p + const Offset(14, -4), const Color(0xFF0B0F0D));

    canvas.drawCircle(d, 9, Paint()..color = const Color(0xFFD64545));
    canvas.drawCircle(d, 9, Paint()..color = Colors.white..style = PaintingStyle.stroke..strokeWidth = 3);
    _drawLabel(canvas, 'Drop-off', d + const Offset(14, -4), const Color(0xFF0B0F0D));

    if (driver != null) {
      final dr = toXY(driver!.lat, driver!.lng);
      canvas.drawCircle(dr, 11, Paint()..color = const Color(0xFFF0B429));
      canvas.drawCircle(dr, 11, Paint()..color = Colors.white..style = PaintingStyle.stroke..strokeWidth = 3);
      _drawLabel(canvas, 'Driver', dr + const Offset(16, -4), const Color(0xFFB07D08));
    }
  }

  void _drawLabel(Canvas canvas, String text, Offset offset, Color color) {
    final tp = TextPainter(
      text: TextSpan(text: text, style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.bold)),
      textDirection: TextDirection.ltr,
    );
    tp.layout();
    tp.paint(canvas, offset);
  }

  @override
  bool shouldRepaint(covariant _TripMapPainter oldDelegate) =>
      oldDelegate.pickup.lat != pickup.lat || oldDelegate.driver?.lat != driver?.lat;
}
