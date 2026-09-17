export type Role =
  | "CUSTOMER"
  | "DRIVER"
  | "FLEET_OWNER"
  | "RESTAURANT"
  | "DELIVERY_PARTNER"
  | "ARTISAN"
  | "CORPORATE_ADMIN"
  | "CORPORATE_USER"
  | "PLATFORM_ADMIN";

export interface Me {
  id: string;
  phone: string;
  email: string | null;
  name: string | null;
  isPhoneVerified: boolean;
  roles: Role[];
  createdAt: string;
}

export type VehicleType = "MOTORBIKE" | "TUKTUK" | "SEDAN" | "SUV";

export type RideStatus =
  | "REQUESTED"
  | "SEARCHING"
  | "ASSIGNED"
  | "ARRIVED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_DRIVERS_FOUND";

export interface RideDriverInfo {
  driverProfileId: string;
  name: string | null;
  phone: string;
  ratingAvg: number;
  vehicle: { make: string; model: string; color: string; plateNumber: string; type: VehicleType };
}

export interface Ride {
  id: string;
  status: RideStatus;
  requestedVehicleType: VehicleType;
  pickupLat: number;
  pickupLng: number;
  pickupAddress: string;
  dropoffLat: number;
  dropoffLng: number;
  dropoffAddress: string;
  distanceKm: number | null;
  durationMin: number | null;
  estimatedFareCents: number;
  finalFareCents: number | null;
  currency: string;
  paymentMethod: "CASH" | "MOMO" | "CARD" | "WALLET";
  createdAt: string;
  driverProfile?: {
    id: string;
    ratingAvg: number;
    user: { name: string | null; phone: string };
    vehicle: { make: string; model: string; color: string; plateNumber: string; type: VehicleType } | null;
  } | null;
  customer?: { name: string | null; phone: string };
}

export interface FareEstimate {
  distanceKm: number;
  durationMin: number;
  fare: {
    vehicleType: VehicleType;
    baseFareCents: number;
    distanceFareCents: number;
    timeFareCents: number;
    bookingFeeCents: number;
    surgeMultiplier: number;
    subtotalCents: number;
    totalCents: number;
    currency: string;
  };
}

export function formatMoney(cents: number, currency = "GHS"): string {
  return `${currency} ${(cents / 100).toFixed(2)}`;
}
