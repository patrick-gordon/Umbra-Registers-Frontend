import { items } from "../data/items";

export const initCatalog = () =>
  items.map((item, i) => ({
    ...item,
    stock: item.stock ?? 10,
    sortOrder: item.sortOrder ?? i + 1,
    category: item.category ?? "Uncategorized",
  }));

export const initCombos = () => [
  {
    id: "combo-breakfast",
    name: "Breakfast Combo",
    itemIds: ["1", "2"],
    bundlePrice: 8.5,
  },
  {
    id: "combo-sweet-pickup",
    name: "Sweet Pickup",
    itemIds: ["1", "3"],
    bundlePrice: 7,
  },
];

export const mkStore = (id, name) => ({
  id,
  name,
  catalog: initCatalog(),
  combos: initCombos(),
  discounts: [],
  registers: [{ id: `${id}-register-1`, name: "Register 1" }],
});

export const mkSession = () => ({
  phase: "employee",
  isRungUp: false,
  isProcessing: false,
  processingProgress: 0,
  processingError: "",
  selectedDiscountIds: [],
  stealMinigame: {
    active: false,
    startedAt: 0,
    endsAt: 0,
    durationMs: 10000,
    customerScore: 0,
    employeeScore: 0,
    winner: "",
  },
});

const parseTimeToMinutes = (value) => {
  if (typeof value !== "string" || !value.includes(":")) return null;
  const [hoursRaw, minutesRaw] = value.split(":");
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
};

const isNowInTimeWindow = (now, startTime, endTime) => {
  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = parseTimeToMinutes(endTime);
  if (startMinutes === null || endMinutes === null) return true;
  if (startMinutes === endMinutes) return true;

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  if (startMinutes < endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  }
  // Overnight window, e.g. 22:00 -> 02:00
  return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
};

const normalizeWeekdays = (weekdays) =>
  Array.isArray(weekdays)
    ? weekdays
        .map((day) => Number(day))
        .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    : [];

export const isDiscountActive = (discount, context = {}) => {
  const now = context.now instanceof Date ? context.now : new Date();
  const isForever = Boolean(discount.isForever);
  if (!isForever) {
    const start = discount.startDate
      ? new Date(`${discount.startDate}T00:00:00`)
      : null;
    const end = discount.endDate ? new Date(`${discount.endDate}T23:59:59`) : null;

    if (start && now < start) return false;
    if (end && now > end) return false;
  }

  const weekdays = normalizeWeekdays(discount.weekdays);
  if (weekdays.length > 0 && !weekdays.includes(now.getDay())) return false;

  if (
    (discount.startTime && !discount.endTime) ||
    (!discount.startTime && discount.endTime)
  ) {
    return false;
  }
  if (!isNowInTimeWindow(now, discount.startTime, discount.endTime)) return false;

  const eventTag = typeof discount.eventTag === "string" ? discount.eventTag.trim() : "";
  if (eventTag) {
    const activeEventTags = Array.isArray(context.activeEventTags)
      ? context.activeEventTags
      : [];
    if (!activeEventTags.includes(eventTag)) return false;
  }

  return true;
};

export const effectivePrice = (itemId, basePrice, discounts, context = {}) => {
  const resolveDiscountedPrice = (discount) => {
    const discountType =
      discount.discountType === "percentage" || discount.discountType === "fixed"
        ? discount.discountType
        : Number.isFinite(Number(discount.discountPercent))
          ? "percentage"
          : "fixed";

    if (discountType === "percentage") {
      const percentRaw = Number(
        discount.discountValue ?? discount.discountPercent,
      );
      if (!Number.isFinite(percentRaw) || percentRaw <= 0) return null;
      const percent = Math.min(100, percentRaw);
      return Math.max(0, basePrice * (1 - percent / 100));
    }

    const fixedPriceRaw = Number(discount.discountValue ?? discount.discountPrice);
    if (!Number.isFinite(fixedPriceRaw) || fixedPriceRaw < 0) return null;
    return Math.min(basePrice, fixedPriceRaw);
  };

  const prices = discounts
    .filter(
      (discount) =>
        (discount.applyToAllItems || discount.itemIds.includes(itemId)) &&
        isDiscountActive(discount, context),
    )
    .map(resolveDiscountedPrice)
    .filter((price) => Number.isFinite(price));

  return prices.length ? Math.min(...prices) : basePrice;
};
