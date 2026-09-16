import { Link } from "react-router-dom";
import { formatMoney } from "../utils/format";

export default function ProductCard({ product, onAddToCart, adding, justAdded }) {
  return (
    <div className="group flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      <Link to={`/products/${product.id}`} className="block aspect-square overflow-hidden bg-gray-100">
        <img
          src={product.image}
          alt={product.name}
          className="h-full w-full object-cover transition-transform group-hover:scale-105"
          loading="lazy"
        />
      </Link>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <span className="text-xs font-medium uppercase tracking-wide text-brand-600">{product.category?.name}</span>
        <Link to={`/products/${product.id}`} className="line-clamp-2 text-sm font-semibold text-gray-900 hover:underline">
          {product.name}
        </Link>
        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="text-base font-bold text-gray-900">{formatMoney(product.price)}</span>
          {product.inStock ? (
            <span className="text-xs font-medium text-green-600">In Stock</span>
          ) : (
            <span className="text-xs font-medium text-red-500">Out of Stock</span>
          )}
        </div>
        <button
          onClick={() => onAddToCart(product)}
          disabled={!product.inStock || adding}
          className={`mt-3 w-full rounded-md py-2 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed ${
            justAdded ? "bg-green-600 hover:bg-green-600" : "bg-brand-600 hover:bg-brand-700 disabled:bg-gray-300"
          }`}
        >
          {justAdded ? "Added ✓" : adding ? "Adding..." : "Add to Cart"}
        </button>
      </div>
    </div>
  );
}
