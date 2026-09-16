import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import { formatMoney, formatDateTime } from "../../utils/format";
import Spinner from "../../components/Spinner";
import ErrorBanner from "../../components/ErrorBanner";
import EmptyState from "../../components/EmptyState";

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  function load() {
    setLoading(true);
    setError(null);
    api
      .get("/orders")
      .then((res) => setOrders(res.orders))
      .catch((err) => setError(err.message || "Failed to load orders."))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Order History</h1>
      {loading && <Spinner label="Loading your orders..." />}
      {!loading && error && <ErrorBanner message={error} onRetry={load} />}
      {!loading && !error && orders.length === 0 && (
        <EmptyState
          title="No orders yet"
          description="Your placed orders will appear here."
          action={
            <Link to="/products" className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
              Start Shopping
            </Link>
          }
        />
      )}
      {!loading && !error && orders.length > 0 && (
        <div className="space-y-3">
          {orders.map((order) => (
            <Link
              key={order.id}
              to={`/orders/${order.id}`}
              className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-semibold text-gray-900">ORD-{order.id.slice(0, 8).toUpperCase()}</p>
                <p className="text-xs text-gray-500">{formatDateTime(order.createdAt)}</p>
              </div>
              <div className="text-sm text-gray-600">{order.itemCount} Item{order.itemCount !== 1 ? "s" : ""}</div>
              <div className="font-bold text-gray-900">{formatMoney(order.total)}</div>
              <span
                className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${
                  order.status === "COMPLETED" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                }`}
              >
                {order.status === "COMPLETED" ? "Completed" : "Failed"}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
