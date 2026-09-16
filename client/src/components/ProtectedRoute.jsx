import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Spinner from "./Spinner";

export function ProtectedRoute() {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Spinner label="Checking your session..." />;
  if (!isAuthenticated) return <Navigate to="/signin" state={{ from: location }} replace />;
  return <Outlet />;
}

export function AdminRoute() {
  const { isAuthenticated, isAdmin, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Spinner label="Checking your session..." />;
  if (!isAuthenticated) return <Navigate to="/signin" state={{ from: location }} replace />;
  if (!isAdmin) return <Navigate to="/products" replace />;
  return <Outlet />;
}

export function GuestOnlyRoute() {
  const { isAuthenticated, isAdmin, loading } = useAuth();
  if (loading) return <Spinner label="Checking your session..." />;
  if (isAuthenticated) return <Navigate to={isAdmin ? "/admin" : "/products"} replace />;
  return <Outlet />;
}
