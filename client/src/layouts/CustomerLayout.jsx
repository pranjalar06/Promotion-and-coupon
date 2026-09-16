import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";

const navLinkClass = ({ isActive }) =>
  `rounded-md px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? "bg-brand-50 text-brand-700" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
  }`;

export default function CustomerLayout() {
  const { user, logout } = useAuth();
  const { itemCount } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  function handleSignOut() {
    logout();
    navigate("/signin", { replace: true });
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-6">
            <NavLink to="/products" className="text-lg font-bold tracking-tight text-brand-700">
              PROMO<span className="text-gray-900">STORE</span>
            </NavLink>
            <nav className="hidden items-center gap-1 md:flex">
              <NavLink to="/products" className={navLinkClass} end>
                Products
              </NavLink>
              <NavLink to="/categories" className={navLinkClass}>
                Categories
              </NavLink>
              <NavLink to="/cart" className={navLinkClass}>
                Cart{itemCount > 0 ? ` (${itemCount})` : ""}
              </NavLink>
              <NavLink to="/orders" className={navLinkClass}>
                Orders
              </NavLink>
            </nav>
          </div>

          <div className="hidden items-center gap-3 md:flex">
            <span className="text-sm text-gray-600">{user?.name}</span>
            <button
              onClick={handleSignOut}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Sign Out
            </button>
          </div>

          <button
            className="rounded-md border border-gray-300 p-2 text-gray-600 md:hidden"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>

        {menuOpen && (
          <div className="border-t border-gray-200 bg-white px-4 py-3 md:hidden">
            <nav className="flex flex-col gap-1">
              <NavLink to="/products" className={navLinkClass} end onClick={() => setMenuOpen(false)}>
                Products
              </NavLink>
              <NavLink to="/categories" className={navLinkClass} onClick={() => setMenuOpen(false)}>
                Categories
              </NavLink>
              <NavLink to="/cart" className={navLinkClass} onClick={() => setMenuOpen(false)}>
                Cart{itemCount > 0 ? ` (${itemCount})` : ""}
              </NavLink>
              <NavLink to="/orders" className={navLinkClass} onClick={() => setMenuOpen(false)}>
                Orders
              </NavLink>
              <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-2">
                <span className="text-sm text-gray-600">{user?.name}</span>
                <button onClick={handleSignOut} className="text-sm font-medium text-red-600">
                  Sign Out
                </button>
              </div>
            </nav>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}
