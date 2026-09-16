import { useEffect, useState } from "react";
import api from "../services/api";
import { formatMoney } from "../utils/format";

function discountLabel(promo) {
  return promo.discountType === "PERCENTAGE" ? `${promo.discountValue}% OFF` : `${formatMoney(promo.discountValue)} OFF`;
}

export default function AvailableCoupons({ cartId, onSelect, disabled, refreshKey }) {
  const [promotions, setPromotions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!cartId) return;
    setLoading(true);
    api
      .get(`/carts/${cartId}/coupons/available`)
      .then((res) => setPromotions(res.promotions))
      .catch((err) => setError(err.message || "Failed to load coupons."))
      .finally(() => setLoading(false));
  }, [cartId, refreshKey]);

  if (loading) return <p className="mt-3 text-xs text-gray-500">Loading available coupons...</p>;
  if (error) return <p className="mt-3 text-xs text-red-600">{error}</p>;
  if (promotions.length === 0) return <p className="mt-3 text-xs text-gray-500">No coupons available right now.</p>;

  return (
    <div className="mt-3">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Available Coupons</p>
      <ul className="mt-2 max-h-56 space-y-2 overflow-y-auto pr-1">
        {promotions.map((promo) => (
          <li
            key={promo.code}
            className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2 ${
              promo.eligible ? "border-gray-200 bg-gray-50" : "border-gray-200 bg-gray-100 opacity-70"
            }`}
          >
            <div className="min-w-0">
              <p className={`truncate text-sm font-semibold ${promo.eligible ? "text-gray-900" : "text-gray-400"}`}>
                {promo.code}
              </p>
              <p className={`text-xs ${promo.eligible ? "text-gray-500" : "text-gray-400"}`}>
                {discountLabel(promo)} &middot; Min {formatMoney(promo.minimumOrderValue)}
                {!promo.appliesToAllCategories && promo.categories.length > 0
                  ? ` · ${promo.categories.join(", ")}`
                  : ""}
              </p>
              {!promo.eligible && promo.reasonMessage && (
                <p className="mt-0.5 text-xs text-gray-400">{promo.reasonMessage}</p>
              )}
            </div>
            <button
              onClick={() => onSelect(promo.code)}
              disabled={disabled || !promo.eligible}
              title={!promo.eligible ? promo.reasonMessage || "Not eligible for your current cart" : undefined}
              className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold ${
                promo.eligible
                  ? "bg-gray-700 text-white hover:bg-gray-800 disabled:opacity-60"
                  : "cursor-not-allowed bg-gray-200 text-gray-400"
              }`}
            >
              Use
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
