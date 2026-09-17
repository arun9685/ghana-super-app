import 'package:flutter/material.dart';

// Same hex values as the approved Sankofa POC's design tokens
// (sankofa-app.jsx's `T`/`SH` objects) and the web app's theme.css —
// one shared source so mobile, web, and the original POC all render
// the same brand.
const navy = Color(0xFF0A7A4B); // primary brand color (POC's `T.green`)
const navyDark = Color(0xFF065C38); // POC's `T.greenD`
const navyLight = Color(0xFFE6F4ED); // POC's `T.greenL` (tint, for badges)
const gold = Color(0xFFF0B429); // POC's `T.gold`
const goldDark = Color(0xFFB07D08); // POC's `T.goldD`
const ink = Color(0xFF0B0F0D); // POC's `T.ink`
const slate = Color(0xFF5B6661); // POC's `T.slate`
const mute = Color(0xFF8A938E); // POC's `T.mute`
const hair = Color(0xFFE8EBE9); // POC's `T.hair`
const bg = Color(0xFFF5F7F6); // POC's `T.bg`
const red = Color(0xFFD64545);
const blue = Color(0xFF2B6CB0);
const purple = Color(0xFF6B46C1);
const teal = Color(0xFF2C7A7B);
const brown = Color(0xFF8B5E34);
const travelTeal = Color(0xFF1F7A8C);

// Sankofa's mark — a return-arrow inside a rounded badge ("Sankofa": go
// back and get it), same shape as the web app's SankofaLogo component,
// ported from the POC's `Logo`.
class SankofaMark extends StatelessWidget {
  final double size;
  final bool light;
  const SankofaMark({super.key, this.size = 40, this.light = false});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: light ? Colors.white.withOpacity(0.16) : navy,
        borderRadius: BorderRadius.circular(size * 0.29),
        border: light ? Border.all(color: Colors.white.withOpacity(0.28)) : null,
      ),
      child: CustomPaint(painter: _ArrowPainter(), size: Size(size, size)),
    );
  }
}

class _ArrowPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.white
      ..style = PaintingStyle.stroke
      ..strokeWidth = size.width * 0.09
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    final scale = size.width / 24;
    Offset pt(double x, double y) => Offset(x * scale, y * scale);

    // Same two paths as the POC's inline SVG logo mark: a hooked arc
    // ("M17 7.5A5.5 5.5 0 1 0 8.5 16") plus its arrowhead
    // ("M13 3.5 17 7.5l-4 4"), approximated with Flutter's arc/line APIs.
    final arcRect = Rect.fromCircle(center: pt(12.5, 11.5), radius: 5.5 * scale);
    canvas.drawArc(arcRect, -1.65, 4.9, false, paint);

    final arrowPath = Path()
      ..moveTo(pt(13, 3.5).dx, pt(13, 3.5).dy)
      ..lineTo(pt(17, 7.5).dx, pt(17, 7.5).dy)
      ..lineTo(pt(13, 11.5).dx, pt(13, 11.5).dy);
    canvas.drawPath(arrowPath, paint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

// Per-service accent colors, matching the POC's `SERVICES` array exactly.
const Map<String, Color> serviceColors = {
  'move': navy,
  'eat': red,
  'utilities': blue,
  'fix': teal,
  'liquidity': goldDark,
  'fleet': purple,
  'property': brown,
  'travel': travelTeal,
};

const Map<String, IconData> serviceIcons = {
  'move': Icons.directions_car_filled_rounded,
  'eat': Icons.restaurant_rounded,
  'utilities': Icons.bolt_rounded,
  'fix': Icons.build_rounded,
  'liquidity': Icons.account_balance_wallet_rounded,
  'fleet': Icons.local_shipping_rounded,
  'property': Icons.home_rounded,
  'travel': Icons.flight_rounded,
};
