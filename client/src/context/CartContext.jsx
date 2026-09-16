import { createContext, useContext, useCallback, useEffect, useState } from "react";
import api from "../services/api";
import { useAuth } from "./AuthContext";

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setCart(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { cart: fresh } = await api.get("/carts/me");
      setCart(fresh);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function withCartId(fn) {
    let cartId = cart?.id;
    if (!cartId) {
      const { cart: fresh } = await api.get("/carts/me");
      cartId = fresh.id;
      setCart(fresh);
    }
    return fn(cartId);
  }

  const addItem = useCallback(
    (productId, quantity = 1) =>
      withCartId(async (cartId) => {
        const { cart: updated } = await api.post(`/carts/${cartId}/items`, { productId, quantity });
        setCart(updated);
        return updated;
      }),
    [cart]
  );

  const updateItemQuantity = useCallback(
    (cartItemId, quantity) =>
      withCartId(async (cartId) => {
        const { cart: updated } = await api.patch(`/carts/${cartId}/items/${cartItemId}`, { quantity });
        setCart(updated);
        return updated;
      }),
    [cart]
  );

  const removeItem = useCallback(
    (cartItemId) =>
      withCartId(async (cartId) => {
        const { cart: updated } = await api.delete(`/carts/${cartId}/items/${cartItemId}`);
        setCart(updated);
        return updated;
      }),
    [cart]
  );

  const applyCoupon = useCallback(
    (code) =>
      withCartId(async (cartId) => {
        const pricing = await api.post(`/carts/${cartId}/coupons`, { code });
        await refresh();
        return pricing;
      }),
    [cart, refresh]
  );

  const removeCoupon = useCallback(
    (code) =>
      withCartId(async (cartId) => {
        const pricing = await api.delete(`/carts/${cartId}/coupons/${encodeURIComponent(code)}`);
        await refresh();
        return pricing;
      }),
    [cart, refresh]
  );

  const itemCount = (cart?.items || []).reduce((sum, item) => sum + item.quantity, 0);

  const value = { cart, loading, error, itemCount, refresh, addItem, updateItemQuantity, removeItem, applyCoupon, removeCoupon };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
