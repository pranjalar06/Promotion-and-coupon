import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { CartProvider } from "./context/CartContext";
import { ProtectedRoute, AdminRoute, GuestOnlyRoute } from "./components/ProtectedRoute";

import CustomerLayout from "./layouts/CustomerLayout";
import AdminLayout from "./layouts/AdminLayout";

import SignIn from "./pages/auth/SignIn";
import SignUp from "./pages/auth/SignUp";

import ProductsPage from "./pages/customer/ProductsPage";
import ProductDetailPage from "./pages/customer/ProductDetailPage";
import CategoriesPage from "./pages/customer/CategoriesPage";
import CartPage from "./pages/customer/CartPage";
import CheckoutPage from "./pages/customer/CheckoutPage";
import OrdersPage from "./pages/customer/OrdersPage";
import OrderDetailPage from "./pages/customer/OrderDetailPage";

import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminPromotionsList from "./pages/admin/AdminPromotionsList";
import AdminPromotionCreate from "./pages/admin/AdminPromotionCreate";
import AdminPromotionDetail from "./pages/admin/AdminPromotionDetail";
import AdminProducts from "./pages/admin/AdminProducts";
import AdminCategories from "./pages/admin/AdminCategories";

function AppProviders({ children }) {
  return (
    <AuthProvider>
      <CartProvider>{children}</CartProvider>
    </AuthProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppProviders>
        <Routes>
          <Route path="/" element={<Navigate to="/products" replace />} />

          <Route element={<GuestOnlyRoute />}>
            <Route path="/signin" element={<SignIn />} />
            <Route path="/signup" element={<SignUp />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route element={<CustomerLayout />}>
              <Route path="/products" element={<ProductsPage />} />
              <Route path="/products/:id" element={<ProductDetailPage />} />
              <Route path="/categories" element={<CategoriesPage />} />
              <Route path="/cart" element={<CartPage />} />
              <Route path="/checkout" element={<CheckoutPage />} />
              <Route path="/orders" element={<OrdersPage />} />
              <Route path="/orders/:id" element={<OrderDetailPage />} />
            </Route>
          </Route>

          <Route element={<AdminRoute />}>
            <Route element={<AdminLayout />}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/promotions" element={<AdminPromotionsList />} />
              <Route path="/admin/promotions/create" element={<AdminPromotionCreate />} />
              <Route path="/admin/promotions/:id" element={<AdminPromotionDetail />} />
              <Route path="/admin/products" element={<AdminProducts />} />
              <Route path="/admin/categories" element={<AdminCategories />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/products" replace />} />
        </Routes>
      </AppProviders>
    </BrowserRouter>
  );
}
