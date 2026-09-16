import { useEffect, useState } from "react";

function toDatetimeLocal(value) {
  if (!value) return "";
  const d = new Date(value);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function defaultForm(initial) {
  return {
    code: initial?.code || "",
    name: initial?.name || "",
    discountType: initial?.discountType || "PERCENTAGE",
    discountValue: initial?.discountValue ?? "",
    maximumDiscount: initial?.maximumDiscount ?? "",
    minimumOrderValue: initial?.minimumOrderValue ?? "0",
    appliesToAllCategories: initial?.appliesToAllCategories ?? true,
    categoryIds: initial?.categories ? initial.categories.map((c) => c.id) : [],
    startAt: toDatetimeLocal(initial?.startAt) || toDatetimeLocal(new Date()),
    endAt: toDatetimeLocal(initial?.endAt) || "",
    totalUsageLimit: initial?.totalUsageLimit ?? "",
    perUserUsageLimit: initial?.perUserUsageLimit ?? "",
    status: initial?.status || "ACTIVE",
  };
}

function validate(form) {
  const errors = [];
  if (!form.code.trim()) errors.push("Coupon code cannot be empty.");
  if (!form.name.trim()) errors.push("Promotion name is required.");
  const discountValue = Number(form.discountValue);
  if (!form.discountValue || isNaN(discountValue) || discountValue <= 0) {
    errors.push("Discount value must be positive.");
  } else if (form.discountType === "PERCENTAGE" && (discountValue < 0 || discountValue > 100)) {
    errors.push("Percentage must be between 0 and 100.");
  }
  if (form.maximumDiscount !== "" && Number(form.maximumDiscount) <= 0) {
    errors.push("Maximum discount must be positive.");
  }
  if (form.minimumOrderValue !== "" && Number(form.minimumOrderValue) < 0) {
    errors.push("Minimum order value cannot be negative.");
  }
  if (!form.appliesToAllCategories && form.categoryIds.length === 0) {
    errors.push("At least one category must be selected when using selected-category mode.");
  }
  if (!form.startAt || !form.endAt) {
    errors.push("Start and end dates are required.");
  } else if (new Date(form.endAt) <= new Date(form.startAt)) {
    errors.push("End date must be after start date.");
  }
  if (form.totalUsageLimit !== "" && Number(form.totalUsageLimit) < 0) errors.push("Usage limits cannot be negative.");
  if (form.perUserUsageLimit !== "" && Number(form.perUserUsageLimit) < 0) errors.push("Usage limits cannot be negative.");
  return errors;
}

export default function PromotionForm({ initial, categories, onSubmit, submitLabel, codeEditable = true }) {
  const [form, setForm] = useState(() => defaultForm(initial));
  const [errors, setErrors] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState(null);

  useEffect(() => {
    setForm(defaultForm(initial));
  }, [initial]);

  function toggleCategory(id) {
    setForm((f) => ({
      ...f,
      categoryIds: f.categoryIds.includes(id) ? f.categoryIds.filter((c) => c !== id) : [...f.categoryIds, id],
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const validationErrors = validate(form);
    setErrors(validationErrors);
    setServerError(null);
    if (validationErrors.length > 0) return;

    setSubmitting(true);
    try {
      await onSubmit({
        ...form,
        code: form.code.trim().toUpperCase(),
        discountValue: Number(form.discountValue),
        maximumDiscount: form.maximumDiscount === "" ? null : Number(form.maximumDiscount),
        minimumOrderValue: Number(form.minimumOrderValue || 0),
        totalUsageLimit: form.totalUsageLimit === "" ? null : Number(form.totalUsageLimit),
        perUserUsageLimit: form.perUserUsageLimit === "" ? null : Number(form.perUserUsageLimit),
        startAt: new Date(form.startAt).toISOString(),
        endAt: new Date(form.endAt).toISOString(),
      });
    } catch (err) {
      setServerError(err.message || "Could not save this promotion.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {(errors.length > 0 || serverError) && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <ul className="list-inside list-disc space-y-0.5">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
            {serverError && <li>{serverError}</li>}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700">Coupon Code</label>
          <input
            value={form.code}
            disabled={!codeEditable}
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
            className={`${inputClass} ${!codeEditable ? "bg-gray-100 text-gray-500" : ""}`}
            placeholder="SAVE20"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Promotion Name</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Discount Type</label>
          <select
            value={form.discountType}
            onChange={(e) => setForm({ ...form, discountType: e.target.value })}
            className={inputClass}
          >
            <option value="PERCENTAGE">Percentage</option>
            <option value="FLAT">Flat</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Discount Value {form.discountType === "PERCENTAGE" ? "(%)" : "(₹)"}
          </label>
          <input
            type="number"
            step="0.01"
            value={form.discountValue}
            onChange={(e) => setForm({ ...form, discountValue: e.target.value })}
            className={inputClass}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Maximum Discount (₹, optional)</label>
          <input
            type="number"
            step="0.01"
            value={form.maximumDiscount}
            onChange={(e) => setForm({ ...form, maximumDiscount: e.target.value })}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Minimum Order Value (₹)</label>
          <input
            type="number"
            step="0.01"
            value={form.minimumOrderValue}
            onChange={(e) => setForm({ ...form, minimumOrderValue: e.target.value })}
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Category Eligibility</label>
        <div className="mt-2 space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              checked={form.appliesToAllCategories}
              onChange={() => setForm({ ...form, appliesToAllCategories: true })}
            />
            All Categories
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              checked={!form.appliesToAllCategories}
              onChange={() => setForm({ ...form, appliesToAllCategories: false })}
            />
            Selected Categories
          </label>
          {!form.appliesToAllCategories && (
            <div className="ml-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {categories.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={form.categoryIds.includes(c.id)} onChange={() => toggleCategory(c.id)} />
                  {c.name}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700">Start Date</label>
          <input
            type="datetime-local"
            value={form.startAt}
            onChange={(e) => setForm({ ...form, startAt: e.target.value })}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">End Date</label>
          <input
            type="datetime-local"
            value={form.endAt}
            onChange={(e) => setForm({ ...form, endAt: e.target.value })}
            className={inputClass}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Total Usage Limit (optional)</label>
          <input
            type="number"
            value={form.totalUsageLimit}
            onChange={(e) => setForm({ ...form, totalUsageLimit: e.target.value })}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Per User Usage Limit (optional)</label>
          <input
            type="number"
            value={form.perUserUsageLimit}
            onChange={(e) => setForm({ ...form, perUserUsageLimit: e.target.value })}
            className={inputClass}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Status</label>
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={inputClass}>
            <option value="ACTIVE">Active</option>
            <option value="PAUSED">Paused</option>
          </select>
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-md bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60 sm:w-auto sm:px-8"
      >
        {submitting ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}
