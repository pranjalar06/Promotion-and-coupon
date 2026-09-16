import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const navLinkClass = ({ isActive }) =>
  `rounded-md px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? "bg-gray-800 text-white" : "text-gray-300 hover:bg-gray-800 hover:text-white"
  }`;

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  function handleSignOut() {
    logout();
    navigate("/signin", { replace: true });
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="sticky top-0 z-20 bg-gray-900">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-6">
            <NavLink to="/admin" className="text-lg font-bold tracking-widest text-white">
              ADMIN
            </NavLink>
            <nav className="hidden items-center gap-1 lg:flex">
              <NavLink to="/admin" className={navLinkClass} end>
                Dashboard
              </NavLink>
              <NavLink to="/admin/promotions" className={navLinkClass}>
                Promotions
              </NavLink>
              <NavLink to="/admin/promotions/create" className={navLinkClass}>
                Create Promotion
              </NavLink>
              <NavLink to="/admin/products" className={navLinkClass}>
                Products
              </NavLink>
              <NavLink to="/admin/categories" className={navLinkClass}>
                Categories
              </NavLink>
            </nav>
          </div>

          <div className="hidden items-center gap-3 lg:flex">
            <span className="text-sm text-gray-300">{user?.name}</span>
            <button
              onClick={handleSignOut}
              className="rounded-md border border-gray-600 px-3 py-1.5 text-sm font-medium text-gray-200 hover:bg-gray-800"
            >
              Sign Out
            </button>
          </div>

          <button
            className="rounded-md border border-gray-600 p-2 text-gray-200 lg:hidden"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>

        {menuOpen && (
          <div className="border-t border-gray-800 bg-gray-900 px-4 py-3 lg:hidden">
            <nav className="flex flex-col gap-1">
              <NavLink to="/admin" className={navLinkClass} end onClick={() => setMenuOpen(false)}>
                Dashboard
              </NavLink>
              <NavLink to="/admin/promotions" className={navLinkClass} onClick={() => setMenuOpen(false)}>
                Promotions
              </NavLink>
              <NavLink to="/admin/promotions/create" className={navLinkClass} onClick={() => setMenuOpen(false)}>
                Create Promotion
              </NavLink>
              <NavLink to="/admin/products" className={navLinkClass} onClick={() => setMenuOpen(false)}>
                Products
              </NavLink>
              <NavLink to="/admin/categories" className={navLinkClass} onClick={() => setMenuOpen(false)}>
                Categories
              </NavLink>
              <div className="mt-2 flex items-center justify-between border-t border-gray-800 pt-2">
                <span className="text-sm text-gray-300">{user?.name}</span>
                <button onClick={handleSignOut} className="text-sm font-medium text-red-400">
                  Sign Out
                </button>
              </div>
            </nav>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}
