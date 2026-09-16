import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../../services/api";
import { useCart } from "../../context/CartContext";
import ProductCard from "../../components/ProductCard";
import Spinner from "../../components/Spinner";
import ErrorBanner from "../../components/ErrorBanner";
import EmptyState from "../../components/EmptyState";

export default function ProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeCategory = searchParams.get("category") || "all";

  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [addingId, setAddingId] = useState(null);
  const [justAddedId, setJustAddedId] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const { addItem } = useCart();

  useEffect(() => {
    api.get("/categories").then((res) => setCategories(res.categories)).catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const query = activeCategory !== "all" ? `?category=${encodeURIComponent(activeCategory)}` : "";
    api
      .get(`/products${query}`)
      .then((res) => {
        if (!cancelled) setProducts(res.products);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Failed to load products.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeCategory]);

  async function handleAddToCart(product) {
    setAddingId(product.id);
    setFeedback(null);
    try {
      await addItem(product.id, 1);
      setFeedback({ type: "success", text: `${product.name} added to cart.` });
      setJustAddedId(product.id);
      setTimeout(() => setJustAddedId(null), 1500);
    } catch (err) {
      setFeedback({ type: "error", text: err.message || "Could not add item to cart." });
    } finally {
      setAddingId(null);
      setTimeout(() => setFeedback(null), 3000);
    }
  }

  function selectCategory(slug) {
    if (slug === "all") setSearchParams({});
    else setSearchParams({ category: slug });
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Products</h1>
        {feedback && (
          <span className={`text-sm font-medium ${feedback.type === "success" ? "text-green-600" : "text-red-600"}`}>
            {feedback.text}
          </span>
        )}
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <button
          onClick={() => selectCategory("all")}
          className={`rounded-full px-4 py-1.5 text-sm font-medium ${
            activeCategory === "all" ? "bg-brand-600 text-white" : "bg-white text-gray-700 ring-1 ring-gray-300"
          }`}
        >
          All Products
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => selectCategory(c.slug)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${
              activeCategory === c.slug ? "bg-brand-600 text-white" : "bg-white text-gray-700 ring-1 ring-gray-300"
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {loading && <Spinner label="Loading products..." />}
      {!loading && error && <ErrorBanner message={error} onRetry={() => setSearchParams(searchParams)} />}
      {!loading && !error && products.length === 0 && (
        <EmptyState title="No products found" description="Try a different category." />
      )}
      {!loading && !error && products.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              onAddToCart={handleAddToCart}
              adding={addingId === p.id}
              justAdded={justAddedId === p.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
