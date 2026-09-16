import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import { formatMoney, formatDateTime } from "../../utils/format";
import Spinner from "../../components/Spinner";
import ErrorBanner from "../../components/ErrorBanner";

function StatCard({ label, value }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

export default function AdminDashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  function load() {
    setLoading(true);
    setError(null);
    api
      .get("/admin/dashboard")
      .then((res) => setDashboard(res.dashboard))
      .catch((err) => setError(err.message || "Failed to load dashboard."))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  if (loading) return <Spinner label="Loading dashboard..." />;
  if (error) return <ErrorBanner message={error} onRetry={load} />;
  if (!dashboard) return null;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <Link
          to="/admin/promotions/create"
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Create Promotion
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Active Promotions" value={dashboard.activePromotions} />
        <StatCard label="Total Promotions" value={dashboard.totalPromotions} />
        <StatCard label="Total Redemptions" value={dashboard.totalRedemptions} />
        <StatCard label="Coupons Used Today" value={dashboard.redemptionsToday} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <StatCard label="Total Discount Given" value={formatMoney(dashboard.totalDiscountGiven)} />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-gray-900">Top Used Coupons</h2>
          {dashboard.topCoupons.length === 0 ? (
            <p className="mt-3 text-sm text-gray-500">No redemptions yet.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {dashboard.topCoupons.map((c) => (
                <li key={c.code} className="flex justify-between">
                  <span className="font-medium text-gray-900">{c.code}</span>
                  <span className="text-gray-500">{c.redemptions} redemptions</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-gray-900">Recent Redemptions</h2>
          {dashboard.recentRedemptions.length === 0 ? (
            <p className="mt-3 text-sm text-gray-500">No redemptions yet.</p>
          ) : (
            <ul className="mt-3 space-y-3 text-sm">
              {dashboard.recentRedemptions.map((r) => (
                <li key={r.id} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{r.couponCode}</p>
                    <p className="text-xs text-gray-500">
                      {r.userName} &middot; {formatDateTime(r.createdAt)}
                    </p>
                  </div>
                  <span className="font-medium text-green-600">-{formatMoney(r.discountAmount)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
