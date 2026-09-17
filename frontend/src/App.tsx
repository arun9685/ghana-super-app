import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import Shell from "@/components/Shell";
import LoginPage from "@/pages/LoginPage";
import CustomerDashboard from "@/pages/CustomerDashboard";
import BookRide from "@/pages/BookRide";
import RideTracking from "@/pages/RideTracking";
import RideHistory from "@/pages/RideHistory";
import DriverApply from "@/pages/DriverApply";
import DriverDashboard from "@/pages/DriverDashboard";
import AdminDashboard from "@/pages/AdminDashboard";
import SupportPage from "@/pages/SupportPage";
import ProfilePage from "@/pages/ProfilePage";
import EatHome from "@/pages/eat/EatHome";
import EatOrders from "@/pages/eat/EatOrders";
import FixHome from "@/pages/fix/FixHome";
import UtilitiesHome from "@/pages/utilities/UtilitiesHome";
import LiquidityHome from "@/pages/liquidity/LiquidityHome";
import FleetHome from "@/pages/fleet/FleetHome";
import PropertyHome from "@/pages/property/PropertyHome";
import TravelHome from "@/pages/travel/TravelHome";

function Protected({ children }: { children: JSX.Element }) {
  const { me, loading } = useAuth();
  const location = useLocation();
  if (loading) return <FullScreenLoader />;
  if (!me) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}

function FullScreenLoader() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--gray-600)" }}>
      Loading Sankofa…
    </div>
  );
}

export default function App() {
  const { me } = useAuth();

  const nav = [
    { to: "/", label: "Home" },
    { to: "/rides", label: "My trips" },
    ...(me?.roles.includes("DRIVER") ? [{ to: "/drive", label: "Drive" }] : [{ to: "/drive/apply", label: "Become a driver" }]),
    ...(me?.roles.includes("PLATFORM_ADMIN") ? [{ to: "/admin", label: "Admin" }] : []),
    { to: "/support", label: "Support" },
    { to: "/profile", label: "Profile" },
  ];

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/*"
        element={
          <Protected>
            <Shell nav={nav}>
              <Routes>
                <Route path="/" element={<CustomerDashboard />} />
                <Route path="/book" element={<BookRide />} />
                <Route path="/rides" element={<RideHistory />} />
                <Route path="/rides/:id" element={<RideTracking />} />
                <Route path="/drive/apply" element={<DriverApply />} />
                <Route path="/drive" element={<DriverDashboard />} />
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/support" element={<SupportPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/eat" element={<EatHome />} />
                <Route path="/eat/orders" element={<EatOrders />} />
                <Route path="/eat/orders/:id" element={<EatOrders />} />
                <Route path="/fix" element={<FixHome />} />
                <Route path="/utilities" element={<UtilitiesHome />} />
                <Route path="/liquidity" element={<LiquidityHome />} />
                <Route path="/fleet" element={<FleetHome />} />
                <Route path="/property" element={<PropertyHome />} />
                <Route path="/travel" element={<TravelHome />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Shell>
          </Protected>
        }
      />
    </Routes>
  );
}
