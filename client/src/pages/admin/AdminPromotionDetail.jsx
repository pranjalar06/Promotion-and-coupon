import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../../services/api";
import { formatMoney, formatDate, formatDateTime } from "../../utils/format";
import PromotionForm from "../../components/PromotionForm";
import Spinner from "../../components/Spinner";
import ErrorBanner from "../../components/ErrorBanner";

function discountLabel(promo) {
  return promo.discountType === "PERCENTAGE" ? `${Number(promo.discountValue)}% OFF` : `${formatMoney(promo.discountValue)} OFF`;
}

export default function AdminPromotionDetail() {
  const { id } = useParams();
  const [promotion, setPromotion] = useState(null);
  const [categories, setCategories] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  function load() {
    setLoading(true);
    setError(null);
    Promise.all([api.get(`/admin/promotions/${id}`), api.get("/admin/categories")])
      .then(([promoRes, catRes]) => {
        setPromotion(promoRes.promotion);
        setCategories(catRes.categories);
      })
      .catch((err) => setError(err.message || "Failed to load promotion."))
      .finally(() => setLoading(false));
  }

  useEffect(load, [id]);

  async function toggleStatus() {
    setBusy(true);
    try {
      const action = promotion.status === "ACTIVE" ? "pause" : "activate";
      await api.post(`/admin/promotions/${id}/${action}`);
      load();
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdate(payload) {
    await api.patch(`/admin/promotions/${id}`, payload);
    setEditing(false);
    load();
  }

  if (loading) return <Spinner label="Loading promotion..." />;
  if (error || !promotion) return <ErrorBanner message={error || "Promotion not found."} />;

  return (
    <div className="max-w-3xl">
      <Link to="/admin/promotions" className="mb-4 inline-block text-sm text-gray-500 hover:text-gray-700">
        &larr; Back to promotions
      </Link>

      {editing ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h1 className="mb-6 text-xl font-bold text-gray-900">Edit {promotion.code}</h1>
          <PromotionForm
            initial={promotion}
            categories={categories}
            onSubmit={handleUpdate}
            submitLabel="Save Changes"
            codeEditable={false}
          />
          <button onClick={() => setEditing(false)} className="mt-3 text-sm text-gray-500 hover:underline">
            Cancel
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{promotion.code}</h1>
              <p className="text-sm text-gray-500">{promotion.name}</p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                promotion.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"
              }`}
            >
              {promotion.status}
            </span>
          </div>

          <p className="mt-4 text-lg font-semibold text-gray-900">{discountLabel(promotion)}</p>
          {promotion.maximumDiscount && (
            <p className="text-sm text-gray-600">Maximum Discount: {formatMoney(promotion.maximumDiscount)}</p>
          )}
          <p className="text-sm text-gray-600">Minimum Order: {formatMoney(promotion.minimumOrderValue)}</p>

          <div className="mt-4">
            <p className="text-xs font-medium uppercase text-gray-500">Eligible Categories</p>
            <p className="mt-1 text-sm text-gray-900">
              {promotion.appliesToAllCategories ? "All Categories" : promotion.categories.map((c) => c.name).join(", ") || "None"}
            </p>
          </div>

          <div className="mt-4">
            <p className="text-xs font-medium uppercase text-gray-500">Valid</p>
            <p className="mt-1 text-sm text-gray-900">
              {formatDate(promotion.startAt)} &rarr; {formatDate(promotion.endAt)}
            </p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium uppercase text-gray-500">Usage</p>
              <p className="mt-1 text-sm text-gray-900">
                {promotion.currentUsage} / {promotion.totalUsageLimit ?? "∞"}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase text-gray-500">Per User</p>
              <p className="mt-1 text-sm text-gray-900">{promotion.perUserUsageLimit ?? "Unlimited"}</p>
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <button
              onClick={() => setEditing(true)}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Edit
            </button>
            <button
              onClick={toggleStatus}
              disabled={busy}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {promotion.status === "ACTIVE" ? "Pause" : "Activate"}
            </button>
          </div>
        </div>
      )}

      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-gray-900">Recent Redemptions</h2>
        {promotion.recentRedemptions.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">No redemptions yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-gray-100 text-sm">
            {promotion.recentRedemptions.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium text-gray-900">{r.userName}</p>
                  <p className="text-xs text-gray-500">{formatDateTime(r.createdAt)}</p>
                </div>
                <span className="font-medium text-green-600">-{formatMoney(r.discountAmount)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
