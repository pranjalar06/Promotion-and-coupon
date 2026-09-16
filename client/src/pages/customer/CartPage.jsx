import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCart } from "../../context/CartContext";
import { formatMoney } from "../../utils/format";
import Spinner from "../../components/Spinner";
import ErrorBanner from "../../components/ErrorBanner";
import EmptyState from "../../components/EmptyState";
import AvailableCoupons from "../../components/AvailableCoupons";

export default function CartPage() {
  const { cart, loading, error, refresh, updateItemQuantity, removeItem, applyCoupon, removeCoupon } = useCart();
  const navigate = useNavigate();

  const [couponInput, setCouponInput] = useState("");
  const [couponError, setCouponError] = useState(null);
  const [applying, setApplying] = useState(false);
  const [removingCoupon, setRemovingCoupon] = useState(false);
  const [busyItemId, setBusyItemId] = useState(null);

  if (loading && !cart) return <Spinner label="Loading your cart..." />;
  if (error) return <ErrorBanner message={error.message || "Failed to load cart."} onRetry={refresh} />;
  if (!cart) return null;

  const hasItems = cart.items.length > 0;
  const hasDiscount = Number(cart.discount) > 0;
  const showEligibleRow = hasDiscount && cart.eligibleSubtotal !== cart.subtotal;

  async function handleQuantityChange(item, nextQuantity) {
    if (nextQuantity < 1) return;
    setBusyItemId(item.cartItemId);
    try {
      await updateItemQuantity(item.cartItemId, nextQuantity);
    } catch (err) {
      setCouponError(err.message);
    } finally {
      setBusyItemId(null);
    }
  }

  async function handleRemove(item) {
    setBusyItemId(item.cartItemId);
    try {
      await removeItem(item.cartItemId);
    } finally {
      setBusyItemId(null);
    }
  }

  async function submitCoupon(code) {
    if (!code.trim()) return;
    setApplying(true);
    setCouponError(null);
    try {
      await applyCoupon(code.trim());
      setCouponInput("");
    } catch (err) {
      setCouponError(err.message || "This coupon could not be applied.");
    } finally {
      setApplying(false);
    }
  }

  function handleApplyCoupon(e) {
    e.preventDefault();
    submitCoupon(couponInput);
  }

  async function handleRemoveCoupon() {
    setRemovingCoupon(true);
    setCouponError(null);
    try {
      await removeCoupon(cart.coupon.code);
    } catch (err) {
      setCouponError(err.message);
    } finally {
      setRemovingCoupon(false);
    }
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Your Cart</h1>

      {!hasItems ? (
        <EmptyState
          title="Your cart is empty"
          description="Browse products and add something you like."
          action={
            <Link to="/products" className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
              Browse Products
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white lg:col-span-2">
            <div className="hidden grid-cols-12 gap-2 border-b border-gray-200 bg-gray-50 px-4 py-2 text-xs font-medium uppercase text-gray-500 sm:grid">
              <span className="col-span-6">Product</span>
              <span className="col-span-3 text-center">Quantity</span>
              <span className="col-span-3 text-right">Price</span>
            </div>
            <ul className="divide-y divide-gray-100">
              {cart.items.map((item) => (
                <li key={item.cartItemId} className="grid grid-cols-12 items-center gap-2 px-4 py-4">
                  <div className="col-span-12 sm:col-span-6">
                    <p className="font-medium text-gray-900">{item.productName}</p>
                    <p className="text-xs text-gray-500">{item.category}</p>
                    {Number(item.discount) > 0 && (
                      <p className="text-xs font-medium text-green-600">-{formatMoney(item.discount)} discount</p>
                    )}
                    <button
                      onClick={() => handleRemove(item)}
                      disabled={busyItemId === item.cartItemId}
                      className="mt-1 text-xs font-medium text-red-500 hover:underline disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="col-span-6 flex items-center justify-start gap-2 sm:col-span-3 sm:justify-center">
                    <div className="flex items-center rounded-md border border-gray-300">
                      <button
                        onClick={() => handleQuantityChange(item, item.quantity - 1)}
                        disabled={busyItemId === item.cartItemId}
                        className="px-2 py-1 text-gray-600 hover:bg-gray-100"
                      >
                        -
                      </button>
                      <span className="w-8 text-center text-sm">{item.quantity}</span>
                      <button
                        onClick={() => handleQuantityChange(item, item.quantity + 1)}
                        disabled={busyItemId === item.cartItemId}
                        className="px-2 py-1 text-gray-600 hover:bg-gray-100"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div className="col-span-6 text-right sm:col-span-3">
                    <p className="font-semibold text-gray-900">{formatMoney(item.finalPrice)}</p>
                    {Number(item.discount) > 0 && (
                      <p className="text-xs text-gray-400 line-through">{formatMoney(item.lineTotal)}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-gray-900">Coupon Code</h2>
              {cart.coupon ? (
                <div className="mt-3 rounded-md bg-green-50 p-3 text-sm">
                  <p className="font-medium text-green-700">Coupon {cart.coupon.code} applied &#10003;</p>
                  <button
                    onClick={handleRemoveCoupon}
                    disabled={removingCoupon}
                    className="mt-2 text-xs font-medium text-red-500 hover:underline disabled:opacity-50"
                  >
                    {removingCoupon ? "Removing..." : "Remove Coupon"}
                  </button>
                </div>
              ) : (
                <form onSubmit={handleApplyCoupon} className="mt-3 flex gap-2">
                  <input
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                    placeholder="e.g. SAVE20"
                    className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                  <button
                    type="submit"
                    disabled={applying}
                    className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                  >
                    {applying ? "Applying..." : "Apply"}
                  </button>
                </form>
              )}
              {!cart.coupon && (
                <AvailableCoupons
                  cartId={cart.id}
                  onSelect={submitCoupon}
                  disabled={applying}
                  refreshKey={`${cart.subtotal}-${cart.items.length}`}
                />
              )}
              {couponError && <p className="mt-2 text-xs font-medium text-red-600">{couponError}</p>}
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-gray-900">Order Summary</h2>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500">Subtotal</dt>
                  <dd className="font-medium text-gray-900">{formatMoney(cart.subtotal)}</dd>
                </div>
                {showEligibleRow && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Eligible Subtotal</dt>
                    <dd className="font-medium text-gray-900">{formatMoney(cart.eligibleSubtotal)}</dd>
                  </div>
                )}
                {hasDiscount && (
                  <div className="flex justify-between text-green-600">
                    <dt>Discount</dt>
                    <dd className="font-medium">-{formatMoney(cart.discount)}</dd>
                  </div>
                )}
                <div className="flex justify-between border-t border-gray-100 pt-2 text-base font-bold text-gray-900">
                  <dt>Total</dt>
                  <dd>{formatMoney(cart.total)}</dd>
                </div>
              </dl>
              <button
                onClick={() => navigate("/checkout")}
                className="mt-4 w-full rounded-md bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
              >
                Proceed to Checkout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
