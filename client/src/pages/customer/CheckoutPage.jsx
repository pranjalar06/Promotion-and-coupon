import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useCart } from "../../context/CartContext";
import api from "../../services/api";
import { formatMoney } from "../../utils/format";
import Spinner from "../../components/Spinner";
import ErrorBanner from "../../components/ErrorBanner";

function newIdempotencyKey() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `key-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// No real payment gateway: this page offers exactly two outcomes.
// "SUCCESS" -> the coupon (if any) is redeemed, stock is reserved, the order
// is created, and the cart is cleared. "FAILED" -> a full rollback / no-op:
// nothing is written, the coupon stays unused, the cart is untouched.
export default function CheckoutPage() {
  const { cart, loading, refresh } = useCart();

  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);
  const [processing, setProcessing] = useState(null); // "SUCCESS" | "FAILED" | null
  const [submitError, setSubmitError] = useState(null);
  const [view, setView] = useState("confirm"); // "confirm" | "failed" | "success"
  const [completedOrder, setCompletedOrder] = useState(null);

  if (loading && !cart) return <Spinner label="Loading checkout..." />;
  if (view === "confirm" && cart && cart.items.length === 0) return <Navigate to="/cart" replace />;

  async function submitCheckout(paymentOutcome) {
    setProcessing(paymentOutcome);
    setSubmitError(null);
    try {
      const result = await api.post("/orders/checkout", { paymentOutcome, idempotencyKey });

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

  if (view === "failed") {
    return (
      <div className="mx-auto max-w-md rounded-xl border border-red-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-2xl text-red-600">
          !
        </div>
        <h1 className="text-lg font-bold text-gray-900">Payment Failed</h1>
        <p className="mt-2 text-sm text-gray-600">Nothing was charged or redeemed.</p>
        <p className="mt-1 text-sm text-gray-600">Your cart has been preserved.</p>
        <button
          onClick={() => setView("confirm")}
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
          <h2 className="text-sm font-semibold text-gray-900">Confirm Your Order</h2>
          <p className="mt-1 text-xs text-gray-500">
            Choose an outcome below — this is a simulation, no payment details are collected.
          </p>
          <ErrorBanner message={submitError} />
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => submitCheckout("FAILED")}
              disabled={Boolean(processing)}
              className="flex-1 rounded-md border border-red-300 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
            >
              {processing === "FAILED" ? "Rolling back..." : "Payment Failed"}
            </button>
            <button
              type="button"
              onClick={() => submitCheckout("SUCCESS")}
              disabled={Boolean(processing)}
              className="flex-1 rounded-md bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {processing === "SUCCESS" ? "Placing order..." : "Pay & Place Order"}
            </button>
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
