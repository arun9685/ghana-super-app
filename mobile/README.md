# Sankofa mobile (Flutter)

Native mobile client covering all eight service tiles — Move (login, book
a ride, live tracking, driver online/accept/complete flow), Eat, Fix,
Utilities, Liquidity, Fleet, Property, and Travel — wired to the real
backend in `../backend`, no mock data, same REST + Socket.IO contract the
web app (`../frontend`) uses. Every screen goes through the same
`ApiClient` (`lib/services/api_client.dart`), matching the corresponding
web page's endpoint set feature-for-feature.

**Important**: this build environment has no Flutter SDK installed, so
this source tree was written carefully but never compiled or run here.
The steps below turn it into a runnable project on your own machine.

## 1. Install Flutter

If you don't already have it: https://docs.flutter.dev/get-started/install

Verify with:

```bash
flutter doctor
```

## 2. Turn this folder into a real Flutter project

This folder has `lib/` and `pubspec.yaml` but not the platform
scaffolding (`android/`, `ios/`, etc.) that `flutter create` normally
generates — that scaffolding is large, platform-specific boilerplate
that isn't meaningful to hand-write, and `flutter create` regenerates it
reliably in seconds.

From **outside** this folder:

```bash
flutter create sankofa_mobile
```

Then copy this folder's `lib/` and `pubspec.yaml` over the generated
project's own `lib/` and `pubspec.yaml` (overwrite them), keeping the
generated `android/`, `ios/`, `web/`, etc. folders as `flutter create`
made them.

```bash
# from this mobile/ folder
cp -r lib/* ../sankofa_mobile/lib/
cp pubspec.yaml ../sankofa_mobile/pubspec.yaml
cd ../sankofa_mobile
flutter pub get
```

## 3. Point it at your backend

The API/socket URLs are compile-time constants (see `lib/config/env.dart`),
overridable with `--dart-define`:

```bash
# Android emulator (10.0.2.2 is the emulator's alias for your host machine)
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000/api/v1 --dart-define=SOCKET_URL=http://10.0.2.2:3000

# iOS simulator (can use localhost directly)
flutter run --dart-define=API_BASE_URL=http://localhost:3000/api/v1 --dart-define=SOCKET_URL=http://localhost:3000

# Physical device — use your computer's LAN IP instead of localhost
flutter run --dart-define=API_BASE_URL=http://192.168.1.x:3000/api/v1 --dart-define=SOCKET_URL=http://192.168.1.x:3000
```

Make sure the backend (`docker-compose up` from the repo root, or
`npm run dev` in `backend/`) is running and reachable from wherever the
app runs.

## 4. Run it

```bash
flutter run
```

Log in the same way as the web app: enter a phone number, then read the
OTP from the backend's console logs (`SMS_PROVIDER=console`, the default
in `.env.example`).

## Design system

Colors, the logo mark, and per-service accent colors (`lib/config/theme.dart`)
are ported directly from the approved Sankofa POC's design tokens (green
`#0A7A4B` primary, gold `#F0B429` accent, ink/slate neutrals) — the same
tokens the web app's `frontend/src/styles/theme.css` uses, so mobile, web,
and the original POC share one brand. One honest gap: the POC draws a
custom hand-illustrated SVG icon per service (car, food, tool, wallet,
etc.). The web app ports those exact SVG paths (`frontend/src/components/Icons.tsx`).
Reproducing all of them as Flutter `CustomPainter`s was more than this
round's budget allowed, so this app uses Flutter's closest built-in
Material icons instead (`Icons.directions_car_filled_rounded` for Move,
`Icons.restaurant_rounded` for Eat, etc. — see `serviceIcons` in
`theme.dart`). They're conceptually the same icon, not the same drawing.
If pixel-exact icons matter here too, porting the SVG paths as
`CustomPainter`s (the same technique already used for the trip map,
`lib/widgets/trip_map_painter.dart`) is the way to close that gap.

## What's real vs. simplified

- **Real, end-to-end**: auth (OTP), fare estimate, ride booking, live
  status + driver location over the same Socket.IO events the web app
  uses, driver online/offline + arrived/start/complete lifecycle.
- **Simplified, same as the web app**: pickup/dropoff is a curated list
  of real Accra landmarks (`lib/config/locations.dart`) rather than a
  live map/places picker — this sandbox had no Maps/Places API key, and
  swapping in `google_maps_flutter` + a Places key is a drop-in
  replacement for `BookRideScreen`'s picker once you have one. The trip
  map is a schematic two-point diagram (`lib/widgets/trip_map_painter.dart`)
  for the same reason, same approach as `frontend/src/components/TripMap.tsx`.
- **Not wired up**: real device GPS. `DriverDashboardScreen` pings a
  fixed Accra coordinate every 8s while online, as a placeholder for
  `geolocator`'s live position stream — swap the `Timer.periodic` body
  for a `Geolocator.getPositionStream()` listener once you add that
  package.

## Project layout

```
lib/
  config/        env.dart (API/socket URLs), locations.dart (landmark list), theme.dart (colors/logo/service maps)
  services/      api_client.dart (REST + token refresh), socket_service.dart
  models/        models.dart (Me, Ride, LatLng)
  state/         auth_state.dart (ChangeNotifier session state)
  screens/
    auth/        login_screen.dart
    customer/    customer_dashboard_screen.dart, book_ride_screen.dart, ride_tracking_screen.dart
    driver/      driver_apply_screen.dart, driver_dashboard_screen.dart
    eat/         eat_screen.dart (browse/order/track)
    fix/         fix_screen.dart (request service, become an artisan, accept jobs)
    utilities/   utilities_screen.dart (airtime/data/bill pay)
    liquidity/   liquidity_screen.dart (wallet + microloans)
    fleet/       fleet_screen.dart (register fleet, manage vehicles)
    property/    property_screen.dart (browse/list/enquire)
    travel/      travel_screen.dart (flight/bus booking)
  widgets/       trip_map_painter.dart
  main.dart
```

## Feature parity with web

Every tile on `CustomerDashboardScreen` is live and pushes its own screen,
calling the exact same endpoints as the matching page under
`../frontend/src/pages/`: Eat → `eat_screen.dart` / `EatHome.tsx`, Fix →
`fix_screen.dart` / `FixHome.tsx` (including the self-service "become an
artisan" upgrade and the artisan-only jobs panel), Utilities →
`utilities_screen.dart` / `UtilitiesHome.tsx`, Liquidity →
`liquidity_screen.dart` / `LiquidityHome.tsx`, Fleet →
`fleet_screen.dart` / `FleetHome.tsx` (including the self-service
"register my fleet" upgrade), Property → `property_screen.dart` /
`PropertyHome.tsx` (browse/mine tabs), Travel → `travel_screen.dart` /
`TravelHome.tsx`.
