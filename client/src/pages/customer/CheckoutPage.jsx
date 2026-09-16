import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";
import api from "../../services/api";
import { formatMoney } from "../../utils/format";
import Spinner from "../../components/Spinner";
import ErrorBanner from "../../components/ErrorBanner";

function newIdempotencyKey() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `key-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function CheckoutPage() {
  const { user } = useAuth();
  const { cart, loading, refresh } = useCart();
  const navigate = useNavigate();

  const [form, setForm] = useState({ name: user?.name || "", email: user?.email || "", address: "" });
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);
  const [processing, setProcessing] = useState(null); // "SUCCESS" | "FAILED" | null
  const [submitError, setSubmitError] = useState(null);
  const [view, setView] = useState("form"); // "form" | "failed" | "success"
  const [completedOrder, setCompletedOrder] = useState(null);

  useEffect(() => {
    setForm((f) => ({ ...f, name: user?.name || f.name, email: user?.email || f.email }));
  }, [user]);

  if (loading && !cart) return <Spinner label="Loading checkout..." />;
  if (view === "form" && cart && cart.items.length === 0) return <Navigate to="/cart" replace />;

  async function submitCheckout(paymentOutcome) {
    setProcessing(paymentOutcome);
    setSubmitError(null);
    try {
      const result = await api.post("/orders/checkout", {
        customerName: form.name,
        customerEmail: form.email,
        customerAddress: form.address,
        paymentOutcome,
        idempotencyKey,
      });

      if (result.paymentStatus === "FAILED") {
        setView("failed");
      } else {
        setCompletedOrder(result.order);
        setView("success");
      }
      setIdempotencyKey(newIdempotencyKey());
      await refresh();
    } catch (err) {
      setSubmitError(err.message || "Checkout failed. Please try again.");
    } finally {
      setProcessing(null);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
  }

  if (view === "failed") {
    return (
      <div className="mx-auto max-w-md rounded-xl border border-red-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-2xl text-red-600">
          !
        </div>
        <h1 className="text-lg font-bold text-gray-900">Payment Failed</h1>
        <p className="mt-2 text-sm text-gray-600">Your payment was not completed.</p>
        <p className="mt-1 text-sm text-gray-600">Your cart has been preserved.</p>
        <button
          onClick={() => setView("form")}
          className="mt-6 w-full rounded-md bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Return to Cart
        </button>
      </div>
    );
  }

  if (view === "success" && completedOrder) {
    return (
      <div className="mx-auto max-w-md rounded-xl border border-green-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-2xl text-green-600">
          &#10003;
        </div>
        <h1 className="text-lg font-bold text-gray-900">Order Placed Successfully</h1>
        <p className="mt-2 text-sm text-gray-600">Order #{completedOrder.id.slice(0, 8).toUpperCase()}</p>
        <p className="mt-1 text-2xl font-bold text-gray-900">{formatMoney(completedOrder.total)}</p>
        <div className="mt-6 flex flex-col gap-2">
          <Link
            to={`/orders/${completedOrder.id}`}
            className="w-full rounded-md bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
          >
            View Order
          </Link>
          <Link to="/products" className="w-full rounded-md border border-gray-300 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">
            Continue Shopping
          </Link>
        </div>
      </div>
    );
  }

  if (!cart) return null;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Checkout</h1>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-gray-900">Customer Information</h2>
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Address</label>
              <textarea
                required
                rows={3}
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          </form>

          <div className="mt-6 border-t border-gray-100 pt-4">
            <h2 className="text-sm font-semibold text-gray-900">Payment Simulation</h2>
            <p className="mt-1 text-xs text-gray-500">No real payment information is required.</p>
            <ErrorBanner message={submitError} />
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => submitCheckout("FAILED")}
                disabled={Boolean(processing) || !form.name || !form.email || !form.address}
                className="flex-1 rounded-md border border-red-300 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
              >
                {processing === "FAILED" ? "Processing..." : "Payment Failed"}
              </button>
              <button
                type="button"
                onClick={() => submitCheckout("SUCCESS")}
                disabled={Boolean(processing) || !form.name || !form.email || !form.address}
                className="flex-1 rounded-md bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {processing === "SUCCESS" ? "Processing..." : "Pay & Place Order"}
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-gray-900">Order Summary</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {cart.items.map((item) => (
              <li key={item.cartItemId} className="flex justify-between text-gray-600">
                <span>
                  {item.productName} &times; {item.quantity}
                </span>
                <span className="font-medium text-gray-900">{formatMoney(item.finalPrice)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-2 border-t border-gray-100 pt-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Subtotal</dt>
              <dd className="font-medium text-gray-900">{formatMoney(cart.subtotal)}</dd>
            </div>
            {Number(cart.discount) > 0 && (
              <div className="flex justify-between text-green-600">
                <dt>Discount {cart.coupon ? `(${cart.coupon.code})` : ""}</dt>
                <dd className="font-medium">-{formatMoney(cart.discount)}</dd>
              </div>
            )}
            <div className="flex justify-between border-t border-gray-100 pt-2 text-base font-bold text-gray-900">
              <dt>Total</dt>
              <dd>{formatMoney(cart.total)}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
