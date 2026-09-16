import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import { formatMoney } from "../../utils/format";
import Spinner from "../../components/Spinner";
import ErrorBanner from "../../components/ErrorBanner";
import EmptyState from "../../components/EmptyState";

function discountLabel(promo) {
  return promo.discountType === "PERCENTAGE" ? `${Number(promo.discountValue)}%` : formatMoney(promo.discountValue);
}

function categoriesLabel(promo) {
  if (promo.appliesToAllCategories) return "All";
  return promo.categories.map((c) => c.name).join(", ") || "None";
}

export default function AdminPromotionsList() {
  const [promotions, setPromotions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  function load() {
    setLoading(true);
    setError(null);
    api
      .get("/admin/promotions")
      .then((res) => setPromotions(res.promotions))
      .catch((err) => setError(err.message || "Failed to load promotions."))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function toggleStatus(promo) {
    setBusyId(promo.id);
    try {
      const action = promo.status === "ACTIVE" ? "pause" : "activate";
      await api.post(`/admin/promotions/${promo.id}/${action}`);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Promotions</h1>
        <Link
          to="/admin/promotions/create"
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Create Promotion
        </Link>
      </div>

      {loading && <Spinner label="Loading promotions..." />}
      {!loading && error && <ErrorBanner message={error} onRetry={load} />}
      {!loading && !error && promotions.length === 0 && (
        <EmptyState title="No promotions yet" description="Create your first coupon to get started." />
      )}
      {!loading && !error && promotions.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase text-gray-500">
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Discount</th>
                <th className="px-4 py-3">Categories</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Usage</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {promotions.map((promo) => (
                <tr key={promo.id}>
                  <td className="px-4 py-3 font-semibold text-gray-900">{promo.code}</td>
                  <td className="px-4 py-3">{discountLabel(promo)}</td>
                  <td className="px-4 py-3 text-gray-600">{categoriesLabel(promo)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        promo.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"
                      }`}
                    >
                      {promo.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {promo.currentUsage}/{promo.totalUsageLimit ?? "∞"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-3">
                      <Link to={`/admin/promotions/${promo.id}`} className="font-medium text-brand-600 hover:underline">
                        View
                      </Link>
                      <button
                        onClick={() => toggleStatus(promo)}
                        disabled={busyId === promo.id}
                        className="font-medium text-gray-600 hover:underline disabled:opacity-50"
                      >
                        {promo.status === "ACTIVE" ? "Pause" : "Activate"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
