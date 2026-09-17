// Same curated Accra landmark list as frontend/src/lib/locations.ts, for
// the same reason: no maps/places API key in this environment, so
// pickup/dropoff is a search-as-you-type list of real coordinates
// instead of tap-on-map. The backend's distance/fare math is computed
// from whichever two real points are picked — nothing here is faked.
class NamedPoint {
  final String name;
  final String area;
  final double lat;
  final double lng;
  const NamedPoint({required this.name, required this.area, required this.lat, required this.lng});
}

const List<NamedPoint> accraLocations = [
  NamedPoint(name: 'Kotoka International Airport', area: 'Airport', lat: 5.6052, lng: -0.1719),
  NamedPoint(name: 'Accra Mall', area: 'Spintex Rd', lat: 5.6180, lng: -0.1719),
  NamedPoint(name: 'Osu Oxford Street', area: 'Osu', lat: 5.5558, lng: -0.1827),
  NamedPoint(name: 'University of Ghana, Legon', area: 'Legon', lat: 5.6494, lng: -0.1866),
  NamedPoint(name: 'Circle (Kwame Nkrumah Interchange)', area: 'Circle', lat: 5.5637, lng: -0.2100),
  NamedPoint(name: 'Kaneshie Market', area: 'Kaneshie', lat: 5.5561, lng: -0.2350),
  NamedPoint(name: 'Labadi Beach', area: 'La', lat: 5.5560, lng: -0.1560),
  NamedPoint(name: 'East Legon', area: 'East Legon', lat: 5.6360, lng: -0.1580),
  NamedPoint(name: 'Achimota Mall', area: 'Achimota', lat: 5.6180, lng: -0.2280),
  NamedPoint(name: 'Dansoman', area: 'Dansoman', lat: 5.5390, lng: -0.2670),
  NamedPoint(name: 'Tema Community 1', area: 'Tema', lat: 5.6698, lng: -0.0166),
  NamedPoint(name: '37 Military Hospital', area: 'Liberation Rd', lat: 5.5820, lng: -0.1780),
];

List<NamedPoint> searchLocations(String query) {
  final q = query.trim().toLowerCase();
  if (q.isEmpty) return accraLocations;
  return accraLocations
      .where((p) => p.name.toLowerCase().contains(q) || p.area.toLowerCase().contains(q))
      .toList();
}
