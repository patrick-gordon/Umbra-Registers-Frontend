import { items } from "../data/items";

export const initCatalog = () =>
  items.map((item, i) => ({
    ...item,
    stock: item.stock ?? 10,
    sortOrder: item.sortOrder ?? i + 1,
    category: item.category ?? "Uncategorized",
  }));

export const mkStore = (id, name) => ({
  id,
  name,
  catalog: initCatalog(),
  discounts: [],
  registers: [{ id: `${id}-register-1`, name: "Register 1" }],
});

export const mkSession = () => ({
  phase: "employee",
  isRungUp: false,
  selectedDiscountIds: [],
});

export const isDiscountActive = (discount) => {
  const now = new Date();
  const start = discount.startDate
    ? new Date(`${discount.startDate}T00:00:00`)
    : null;
  const end = discount.endDate ? new Date(`${discount.endDate}T23:59:59`) : null;

  if (start && now < start) return false;
  if (end && now > end) return false;
  return true;
};

export const effectivePrice = (itemId, basePrice, discounts) => {
  const prices = discounts
    .filter(
      (discount) =>
        discount.itemIds.includes(itemId) &&
        isDiscountActive(discount) &&
        discount.discountPrice >= 0,
    )
    .map((discount) => discount.discountPrice);

  return prices.length ? Math.min(...prices) : basePrice;
};
