import { Navigate, Outlet } from "react-router-dom";
import { getAuth } from "@/lib/auth";

const ProtectedRoute = () => {
  const auth = getAuth();
  const isAuthenticated = !!auth.accessToken; // Check if accessToken exists

  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
};

export default ProtectedRoute;