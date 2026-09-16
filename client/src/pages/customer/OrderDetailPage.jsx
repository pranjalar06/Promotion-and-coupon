import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../../services/api";
import { formatMoney, formatDateTime } from "../../utils/format";
import Spinner from "../../components/Spinner";
import ErrorBanner from "../../components/ErrorBanner";

export default function OrderDetailPage() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    api
      .get(`/orders/${id}`)
      .then((res) => setOrder(res.order))
      .catch((err) => setError(err.message || "Order not found."))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Spinner label="Loading order..." />;
  if (error || !order) return <ErrorBanner message={error || "Order not found."} />;

  return (
    <div>
      <Link to="/orders" className="mb-4 inline-block text-sm text-gray-500 hover:text-gray-700">
        &larr; Back to orders
      </Link>
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex flex-col justify-between gap-2 border-b border-gray-100 pb-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-lg font-bold text-gray-900">ORD-{order.id.slice(0, 8).toUpperCase()}</h1>
            <p className="text-xs text-gray-500">{formatDateTime(order.createdAt)}</p>
          </div>
          <span
            className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${
              order.status === "COMPLETED" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
            }`}
          >
            {order.status === "COMPLETED" ? "Completed" : "Failed"}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
          <div>
            <p className="text-gray-500">Name</p>
            <p className="font-medium text-gray-900">{order.customer.name}</p>
          </div>
          <div>
            <p className="text-gray-500">Email</p>
            <p className="font-medium text-gray-900">{order.customer.email}</p>
          </div>
          <div>
            <p className="text-gray-500">Address</p>
            <p className="font-medium text-gray-900">{order.customer.address}</p>
          </div>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase text-gray-500">
                <th className="py-2">Product</th>
                <th className="py-2 text-center">Qty</th>
                <th className="py-2 text-right">Unit Price</th>
                <th className="py-2 text-right">Final Price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {order.items.map((item) => (
                <tr key={item.id}>
                  <td className="py-3">
                    <p className="font-medium text-gray-900">{item.productName}</p>
                    <p className="text-xs text-gray-500">{item.category}</p>
                  </td>
                  <td className="py-3 text-center">{item.quantity}</td>
                  <td className="py-3 text-right">{formatMoney(item.unitPrice)}</td>
                  <td className="py-3 text-right font-medium text-gray-900">{formatMoney(item.finalPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <dl className="mt-6 ml-auto max-w-xs space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-500">Subtotal</dt>
            <dd className="font-medium text-gray-900">{formatMoney(order.subtotal)}</dd>
          </div>
          {Number(order.discount) > 0 && (
            <div className="flex justify-between text-green-600">
              <dt>Discount {order.couponCode ? `(${order.couponCode})` : ""}</dt>
              <dd className="font-medium">-{formatMoney(order.discount)}</dd>
            </div>
          )}
          <div className="flex justify-between border-t border-gray-100 pt-2 text-base font-bold text-gray-900">
            <dt>Total</dt>
            <dd>{formatMoney(order.total)}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
