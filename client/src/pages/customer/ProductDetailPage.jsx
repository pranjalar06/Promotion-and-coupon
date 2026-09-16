import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "../../services/api";
import { useCart } from "../../context/CartContext";
import { formatMoney } from "../../utils/format";
import Spinner from "../../components/Spinner";
import ErrorBanner from "../../components/ErrorBanner";

export default function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addItem } = useCart();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState(null);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api
      .get(`/products/${id}`)
      .then((res) => setProduct(res.product))
      .catch((err) => setError(err.message || "Product not found."))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleAddToCart() {
    setAdding(true);
    setAddError(null);
    setAdded(false);
    try {
      await addItem(product.id, quantity);
      setAdded(true);
    } catch (err) {
      setAddError(err.message || "Could not add item to cart.");
    } finally {
      setAdding(false);
    }
  }

  if (loading) return <Spinner label="Loading product..." />;
  if (error || !product) {
    return (
      <div className="space-y-4">
        <ErrorBanner message={error || "Product not found."} />
        <button onClick={() => navigate("/products")} className="text-sm font-medium text-brand-600 hover:underline">
          Back to products
        </button>
      </div>
    );
  }

  return (
    <div>
      <Link to="/products" className="mb-4 inline-block text-sm text-gray-500 hover:text-gray-700">
        &larr; Back to products
      </Link>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div className="overflow-hidden rounded-xl bg-gray-100">
          <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
        </div>
        <div>
          <span className="text-xs font-medium uppercase tracking-wide text-brand-600">{product.category?.name}</span>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">{product.name}</h1>
          <p className="mt-3 text-sm leading-relaxed text-gray-600">{product.description}</p>
          <p className="mt-4 text-2xl font-bold text-gray-900">{formatMoney(product.price)}</p>
          <p className={`mt-1 text-sm font-medium ${product.inStock ? "text-green-600" : "text-red-500"}`}>
            {product.inStock ? `In Stock (${product.stock} available)` : "Out of Stock"}
          </p>

          <div className="mt-6 flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700">Quantity</span>
            <div className="flex items-center rounded-md border border-gray-300">
              <button
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="px-3 py-1.5 text-gray-600 hover:bg-gray-100"
              >
                -
              </button>
              <span className="w-10 text-center text-sm font-medium">{quantity}</span>
              <button
                onClick={() => setQuantity((q) => Math.min(product.stock || 1, q + 1))}
                className="px-3 py-1.5 text-gray-600 hover:bg-gray-100"
              >
                +
              </button>
            </div>
          </div>

          <ErrorBanner message={addError} />
          {added && <p className="mt-3 text-sm font-medium text-green-600">Added to cart.</p>}

          <button
            onClick={handleAddToCart}
            disabled={!product.inStock || adding}
            className="mt-4 w-full rounded-md bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-gray-300 sm:w-auto sm:px-8"
          >
            {adding ? "Adding..." : "Add to Cart"}
          </button>
        </div>
      </div>
    </div>
  );
}
