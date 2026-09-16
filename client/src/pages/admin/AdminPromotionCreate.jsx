import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import PromotionForm from "../../components/PromotionForm";
import Spinner from "../../components/Spinner";

export default function AdminPromotionCreate() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState(null);

  useEffect(() => {
    api.get("/admin/categories").then((res) => setCategories(res.categories));
  }, []);

  async function handleSubmit(payload) {
    const res = await api.post("/admin/promotions", payload);
    navigate(`/admin/promotions/${res.promotion.id}`);
  }

  if (!categories) return <Spinner label="Loading form..." />;

  return (
    <div className="max-w-3xl">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Create Promotion</h1>
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <PromotionForm categories={categories} onSubmit={handleSubmit} submitLabel="Create Promotion" />
      </div>
    </div>
  );
}
