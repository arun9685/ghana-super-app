// A curated set of real Accra landmarks with real coordinates, standing
// in for a places-autocomplete/map picker. This environment has no
// Google Maps / Mapbox API key, so pickup/dropoff selection is a search-
// as-you-type list instead of a tap-on-map — the backend's distance,
// duration and fare math is genuinely computed from whichever two real
// points are chosen (see backend/src/common/geo.ts), it isn't faked.
export interface NamedPoint {
  name: string;
  area: string;
  lat: number;
  lng: number;
}

export const ACCRA_LOCATIONS: NamedPoint[] = [
  { name: "Kotoka International Airport", area: "Airport", lat: 5.6052, lng: -0.1719 },
  { name: "Accra Mall", area: "Spintex Rd", lat: 5.6180, lng: -0.1719 },
  { name: "Osu Oxford Street", area: "Osu", lat: 5.5558, lng: -0.1827 },
  { name: "University of Ghana, Legon", area: "Legon", lat: 5.6494, lng: -0.1866 },
  { name: "Circle (Kwame Nkrumah Interchange)", area: "Circle", lat: 5.5637, lng: -0.2100 },
  { name: "Kaneshie Market", area: "Kaneshie", lat: 5.5561, lng: -0.2350 },
  { name: "Labadi Beach", area: "La", lat: 5.5560, lng: -0.1560 },
  { name: "East Legon", area: "East Legon", lat: 5.6360, lng: -0.1580 },
  { name: "Achimota Mall", area: "Achimota", lat: 5.6180, lng: -0.2280 },
  { name: "Dansoman", area: "Dansoman", lat: 5.5390, lng: -0.2670 },
  { name: "Tema Community 1", area: "Tema", lat: 5.6698, lng: -0.0166 },
  { name: "37 Military Hospital", area: "Liberation Rd", lat: 5.5820, lng: -0.1780 },
];

export function searchLocations(query: string): NamedPoint[] {
  const q = query.trim().toLowerCase();
  if (!q) return ACCRA_LOCATIONS;
  return ACCRA_LOCATIONS.filter(
    (p) => p.name.toLowerCase().includes(q) || p.area.toLowerCase().includes(q)
  );
}
