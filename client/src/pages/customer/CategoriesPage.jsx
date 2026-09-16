import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import Spinner from "../../components/Spinner";
import ErrorBanner from "../../components/ErrorBanner";
import EmptyState from "../../components/EmptyState";

export default function CategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .get("/categories")
      .then((res) => setCategories(res.categories))
      .catch((err) => setError(err.message || "Failed to load categories."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Categories</h1>
      {loading && <Spinner label="Loading categories..." />}
      {!loading && error && <ErrorBanner message={error} />}
      {!loading && !error && categories.length === 0 && <EmptyState title="No categories available" />}
      {!loading && !error && categories.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {categories.map((c) => (
            <Link
              key={c.id}
              to={`/products?category=${c.slug}`}
              className="flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white text-center shadow-sm transition-shadow hover:shadow-md"
            >
              <span className="text-2xl">🛍️</span>
              <span className="font-semibold text-gray-900">{c.name}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
