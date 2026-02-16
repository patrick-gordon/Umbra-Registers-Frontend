import { useEffect, useMemo, useReducer, useRef } from "react";
import {
  effectivePrice,
  isDiscountActive,
  mkSession,
  mkStore,
} from "../utils/registerUtils";
import {
  getRegisterTier,
  MAX_REGISTER_TIER,
  REGISTER_TIERS,
} from "../config/registerTiers";
import { isFiveM, onNuiMessage, postNui } from "../utils/fivemNui";
import { businessInteractions } from "../prototype/businessInteractions";
import { RegisterContext } from "./registerStoreContext";
import {
  NUI_ERROR_CODES,
  getNuiErrorInfo,
  normalizeNuiErrorCode,
} from "../../shared/nuiErrorCodes";

const mkRegisterStats = () => ({
  totalSales: 0,
  totalTransactions: 0,
  paidTransactions: 0,
  stolenTransactions: 0,
  stealAttempts: 0,
  blockedStealAttempts: 0,
  itemsSold: 0,
  itemsStolen: 0,
  lastPaidTotal: 0,
  lastTransactionAt: "",
});

const ABUSE_EVENT_KEYS = Object.freeze({
  RAPID_STEAL: "rapidSteal",
  DUPLICATE_ACTION: "duplicateAction",
  FAILED_UPGRADE: "failedUpgrade",
});

const ABUSE_RULES = Object.freeze({
  [ABUSE_EVENT_KEYS.RAPID_STEAL]: {
    code: "RAPID_STEALS",
    label: "Rapid steals",
    severity: "high",
    threshold: 3,
    windowMs: 30000,
    signalKey: "rapidStealEvents",
  },
  [ABUSE_EVENT_KEYS.DUPLICATE_ACTION]: {
    code: "DUPLICATE_ACTION_SPAM",
    label: "Duplicate action spam",
    severity: "medium",
    threshold: 4,
    windowMs: 45000,
    signalKey: "duplicateActionEvents",
  },
  [ABUSE_EVENT_KEYS.FAILED_UPGRADE]: {
    code: "UPGRADE_ABUSE",
    label: "Tier upgrade abuse",
    severity: "medium",
    threshold: 3,
    windowMs: 120000,
    signalKey: "failedUpgradeEvents",
  },
});

const mkAbuseSignal = () => ({
  rapidStealEvents: [],
  duplicateActionEvents: [],
  failedUpgradeEvents: [],
  lastFlaggedAt: "",
});

const pruneEventTimestamps = (timestamps, windowMs, nowTs) =>
  timestamps.filter(
    (timestamp) => Number.isFinite(timestamp) && nowTs - timestamp <= windowMs,
  );

const normalizeAbuseSignal = (signal) => {
  if (!signal || typeof signal !== "object") return mkAbuseSignal();
  return {
    rapidStealEvents: Array.isArray(signal.rapidStealEvents)
      ? signal.rapidStealEvents.filter((timestamp) => Number.isFinite(timestamp))
      : [],
    duplicateActionEvents: Array.isArray(signal.duplicateActionEvents)
      ? signal.duplicateActionEvents.filter((timestamp) => Number.isFinite(timestamp))
      : [],
    failedUpgradeEvents: Array.isArray(signal.failedUpgradeEvents)
      ? signal.failedUpgradeEvents.filter((timestamp) => Number.isFinite(timestamp))
      : [],
    lastFlaggedAt:
      typeof signal.lastFlaggedAt === "string" ? signal.lastFlaggedAt : "",
  };
};

const buildSuspiciousFlags = (signal, nowTs = Date.now()) => {
  const normalized = normalizeAbuseSignal(signal);
  return Object.values(ABUSE_RULES).reduce((flags, rule) => {
    const recentEvents = pruneEventTimestamps(
      normalized[rule.signalKey] ?? EMPTY_ARRAY,
      rule.windowMs,
      nowTs,
    );
    if (recentEvents.length >= rule.threshold) {
      flags.push({
        code: rule.code,
        label: rule.label,
        severity: rule.severity,
        count: recentEvents.length,
        windowMs: rule.windowMs,
      });
    }
    return flags;
  }, []);
};

const severityRank = { low: 1, medium: 2, high: 3 };

const EMPTY_ARRAY = Object.freeze([]);
const EMPTY_OBJECT = Object.freeze({});
const EMPTY_SESSION = Object.freeze(mkSession());
const COMBO_LINE_PREFIX = "combo:";

const buildComboLineId = (comboId) => `${COMBO_LINE_PREFIX}${comboId}`;

const isComboTrayLine = (trayItem) =>
  trayItem?.lineType === "combo" ||
  (typeof trayItem?.id === "string" && trayItem.id.startsWith(COMBO_LINE_PREFIX));

const resolveTrayItemId = (trayItem) => trayItem?.itemId ?? trayItem?.id;

const normalizeCombo = (combo) => {
  const itemIds = Array.isArray(combo?.itemIds)
    ? [...new Set(combo.itemIds.filter((itemId) => typeof itemId === "string" && itemId.trim()))]
    : [];
  const bundlePrice = Number(combo?.bundlePrice);
  return {
    ...combo,
    id: typeof combo?.id === "string" ? combo.id : "",
    name: typeof combo?.name === "string" ? combo.name : "",
    itemIds,
    bundlePrice:
      Number.isFinite(bundlePrice) && bundlePrice >= 0 ? bundlePrice : 0,
  };
};

const calcComboBasePrice = (combo, catalogById) =>
  combo.itemIds.reduce(
    (sum, itemId) => sum + (catalogById.get(itemId)?.price ?? 0),
    0,
  );

const buildStockUsageFromTray = (trayLines, comboById) =>
  trayLines.reduce((usage, trayItem) => {
    const qty = Number(trayItem?.qty) || 0;
    if (qty <= 0) return usage;

    if (isComboTrayLine(trayItem)) {
      const comboId =
        trayItem.comboId ??
        (typeof trayItem.id === "string"
          ? trayItem.id.replace(COMBO_LINE_PREFIX, "")
          : "");
      const comboItemIds =
        trayItem.itemIds ?? comboById.get(comboId)?.itemIds ?? EMPTY_ARRAY;
      comboItemIds.forEach((itemId) => {
        usage[itemId] = (usage[itemId] ?? 0) + qty;
      });
      return usage;
    }

    const itemId = resolveTrayItemId(trayItem);
    usage[itemId] = (usage[itemId] ?? 0) + qty;
    return usage;
  }, {});

const countItemsInTray = (trayLines) =>
  trayLines.reduce((sum, trayItem) => {
    const qty = Number(trayItem?.qty) || 0;
    if (qty <= 0) return sum;
    const unitsPerLine =
      isComboTrayLine(trayItem) && Array.isArray(trayItem.itemIds) && trayItem.itemIds.length
        ? trayItem.itemIds.length
        : 1;
    return sum + qty * unitsPerLine;
  }, 0);

const resolveOrganizationMembership = (payload) => {
  if (!payload || typeof payload !== "object") return null;

  const membershipFlags = [
    payload.isOrganizationMember,
    payload.isOrgMember,
    payload.organizationMember,
    payload.isBusinessMember,
  ];

  for (const flag of membershipFlags) {
    if (typeof flag === "boolean") return flag;
  }

  const directOrgId =
    payload.organizationId ?? payload.orgId ?? payload.businessId ?? payload.organization?.id;
  if (typeof directOrgId === "string" && directOrgId.trim()) return true;

  const interaction = payload.interaction ?? payload.interactionContext;
  if (interaction && typeof interaction === "object") {
    const interactionFlags = [
      interaction.isOrganizationMember,
      interaction.isOrgMember,
      interaction.organizationMember,
      interaction.isBusinessMember,
    ];
    for (const flag of interactionFlags) {
      if (typeof flag === "boolean") return flag;
    }

    const interactionOrgId =
      interaction.organizationId ??
      interaction.orgId ??
      interaction.businessId ??
      interaction.organization?.id;
    if (typeof interactionOrgId === "string" && interactionOrgId.trim()) return true;
  }

  return null;
};

// Single source of truth for UI + interaction state.
// Backend may override parts of this via `syncState`.
const createInitialState = () => ({
  view: "employee",
  currentRole: "manager",
  uiVisible: !isFiveM(),
  isOrganizationMember: false,
  activeEventTags: [],
  nuiPendingAction: "",
  nuiError: "",
  lastNuiEvent: "",
  interactionContext: null,
  stores: [mkStore("store-1", "Store 1")],
  activeStoreId: "store-1",
  activeRegisterId: "store-1-register-1",
  traysByRegister: { "store-1-register-1": [] },
  sessionsByRegister: { "store-1-register-1": mkSession() },
  registerTierByRegister: { "store-1-register-1": 1 },
  registerStatsByRegister: { "store-1-register-1": mkRegisterStats() },
  abuseSignalsByRegister: { "store-1-register-1": mkAbuseSignal() },
  receiptsByRegister: {},
  managerCategoryFilter: "All Categories",
  newStoreName: "",
  newRegisterName: "",
  newItem: { name: "", price: "", stock: "", sortOrder: "", category: "" },
  newDiscount: {
    name: "",
    discountPrice: "",
    promotionType: "standard",
    startDate: "",
    endDate: "",
    startTime: "",
    endTime: "",
    weekdays: [],
    eventTag: "",
    itemIds: [],
  },
  newCombo: {
    name: "",
    bundlePrice: "",
    itemIds: [],
  },
});

function reducer(state, action) {
  switch (action.type) {
    case "SET":
      return { ...state, [action.key]: action.value };
    case "PATCH":
      return { ...state, ...action.payload };
    case "SET_SESSION": {
      const registerId = action.registerId;
      const currentSession = state.sessionsByRegister[registerId] ?? mkSession();
      const nextSession = action.updater(currentSession);
      return {
        ...state,
        sessionsByRegister: {
          ...state.sessionsByRegister,
          [registerId]: nextSession,
        },
      };
    }
    case "SET_ABUSE_SIGNAL": {
      const registerId = action.registerId;
      const currentSignal = normalizeAbuseSignal(
        state.abuseSignalsByRegister[registerId],
      );
      const nextSignal = normalizeAbuseSignal(action.updater(currentSignal));
      return {
        ...state,
        abuseSignalsByRegister: {
          ...state.abuseSignalsByRegister,
          [registerId]: nextSignal,
        },
      };
    }
    default:
      return state;
  }
}

export function RegisterProvider({ children }) {
  const [appState, dispatch] = useReducer(reducer, undefined, createInitialState);

  const activeStore =
    appState.stores.find((store) => store.id === appState.activeStoreId) ?? appState.stores[0];
  const catalog = activeStore?.catalog ?? EMPTY_ARRAY;
  const storeCombos = activeStore?.combos ?? EMPTY_ARRAY;
  const combos = useMemo(
    () =>
      storeCombos
        .map(normalizeCombo)
        .filter((combo) => combo.id && combo.name && combo.itemIds.length >= 2),
    [storeCombos],
  );
  const discounts = activeStore?.discounts ?? EMPTY_ARRAY;
  const registers = activeStore?.registers ?? EMPTY_ARRAY;
  const tray = appState.traysByRegister[appState.activeRegisterId] ?? EMPTY_ARRAY;
  const session = appState.sessionsByRegister[appState.activeRegisterId] ?? EMPTY_SESSION;
  const catalogById = useMemo(
    () => new Map(catalog.map((item) => [item.id, item])),
    [catalog],
  );
  const comboById = useMemo(
    () => new Map(combos.map((combo) => [combo.id, combo])),
    [combos],
  );
  const stockUsageByItemId = useMemo(
    () => buildStockUsageFromTray(tray, comboById),
    [tray, comboById],
  );
  const remainingStockByItemId = useMemo(
    () =>
      catalog.reduce((stockMap, item) => {
        stockMap[item.id] = Math.max(0, item.stock - (stockUsageByItemId[item.id] ?? 0));
        return stockMap;
      }, {}),
    [catalog, stockUsageByItemId],
  );
  const registerStatsByRegister = appState.registerStatsByRegister ?? EMPTY_OBJECT;
  const abuseSignalsByRegister = appState.abuseSignalsByRegister ?? EMPTY_OBJECT;
  const registerTierByRegister = appState.registerTierByRegister ?? EMPTY_OBJECT;
  const activeRegisterTierLevel = registerTierByRegister[appState.activeRegisterId] ?? 1;
  const activeRegisterTier = getRegisterTier(activeRegisterTierLevel);
  const discountActivityContext = useMemo(
    () => ({ activeEventTags: appState.activeEventTags }),
    [appState.activeEventTags],
  );
  const registerName =
    registers.find((register) => register.id === appState.activeRegisterId)?.name ??
    "Register";

  const selectedDiscounts = useMemo(
    () =>
      discounts.filter(
        (discount) =>
          session.selectedDiscountIds.includes(discount.id) &&
          isDiscountActive(discount, discountActivityContext),
      ),
    [discounts, session.selectedDiscountIds, discountActivityContext],
  );

  const sortedCatalog = useMemo(
    () =>
      [...catalog].sort((a, b) =>
        a.sortOrder === b.sortOrder
          ? a.name.localeCompare(b.name)
          : a.sortOrder - b.sortOrder,
      ),
    [catalog],
  );

  const customerItems = useMemo(
    () =>
      sortedCatalog.map((item) => {
        const price = session.isRungUp
          ? effectivePrice(item.id, item.price, selectedDiscounts, discountActivityContext)
          : item.price;
        return { ...item, effectivePrice: price, hasDiscount: price < item.price };
      }),
    [sortedCatalog, session.isRungUp, selectedDiscounts, discountActivityContext],
  );

  const availableCombos = useMemo(
    () =>
      combos
        .map((combo) => {
          const comboItems = combo.itemIds.map((itemId) => catalogById.get(itemId));
          if (comboItems.some((item) => !item)) return null;
          const basePrice = calcComboBasePrice(combo, catalogById);
          return {
            ...combo,
            itemNames: comboItems.map((item) => item.name),
            basePrice,
            savings: Math.max(0, basePrice - combo.bundlePrice),
            isInStock: combo.itemIds.every(
              (itemId) => (remainingStockByItemId[itemId] ?? 0) > 0,
            ),
          };
        })
        .filter(Boolean),
    [combos, catalogById, remainingStockByItemId],
  );

  const managerItems = useMemo(() => {
    const filtered =
      appState.managerCategoryFilter === "All Categories"
        ? catalog
        : catalog.filter((item) => item.category === appState.managerCategoryFilter);

    return [...filtered].sort((a, b) =>
      a.category === b.category
        ? a.sortOrder === b.sortOrder
          ? a.name.localeCompare(b.name)
          : a.sortOrder - b.sortOrder
        : a.category.localeCompare(b.category),
    );
  }, [catalog, appState.managerCategoryFilter]);

  const categories = useMemo(
    () => [...new Set(catalog.map((item) => item.category || "Uncategorized"))].sort(),
    [catalog],
  );

  const availableSessionDiscounts = useMemo(() => {
    const trayItemIds = new Set(Object.keys(stockUsageByItemId));
    return discounts.filter(
      (discount) =>
        isDiscountActive(discount, discountActivityContext) &&
        discount.itemIds.some((itemId) => trayItemIds.has(itemId)),
    );
  }, [discounts, stockUsageByItemId, discountActivityContext]);

  const total = useMemo(
    () => tray.reduce((sum, trayItem) => sum + trayItem.unitPrice * trayItem.qty, 0),
    [tray],
  );

  const managerRegisterStats = useMemo(
    () =>
      registers.map((register) => {
        const stats = {
          ...mkRegisterStats(),
          ...(registerStatsByRegister[register.id] ?? {}),
        };
        const abuseSignal = normalizeAbuseSignal(abuseSignalsByRegister[register.id]);
        const suspiciousFlags = buildSuspiciousFlags(abuseSignal);
        const highestSeverity = suspiciousFlags.reduce((maxSeverity, flag) => {
          if ((severityRank[flag.severity] ?? 0) > (severityRank[maxSeverity] ?? 0)) {
            return flag.severity;
          }
          return maxSeverity;
        }, "low");
        const tierLevel = registerTierByRegister[register.id] ?? 1;
        const tier = getRegisterTier(tierLevel);
        const theftRate =
          stats.totalTransactions > 0
            ? stats.stolenTransactions / stats.totalTransactions
            : 0;
        const avgTicket =
          stats.paidTransactions > 0 ? stats.totalSales / stats.paidTransactions : 0;
        return {
          registerId: register.id,
          registerName: register.name,
          tierLevel,
          tierName: tier.name,
          processingMs: tier.processingMs,
          unlocks: tier.unlocks,
          suspiciousFlags,
          hasSuspiciousFlags: suspiciousFlags.length > 0,
          highestSuspicionSeverity: highestSeverity,
          rapidStealEventCount: abuseSignal.rapidStealEvents.length,
          duplicateActionEventCount: abuseSignal.duplicateActionEvents.length,
          failedUpgradeEventCount: abuseSignal.failedUpgradeEvents.length,
          ...stats,
          theftRate,
          avgTicket,
        };
      }),
    [
      registers,
      registerStatsByRegister,
      registerTierByRegister,
      abuseSignalsByRegister,
    ],
  );

  const hasOrganizationAccess = appState.isOrganizationMember || !isFiveM();

  const allowedViews = useMemo(() => {
    if (!hasOrganizationAccess) return ["customer"];
    if (appState.currentRole === "manager") return ["manager", "employee", "customer"];
    if (appState.currentRole === "employee") return ["employee", "customer"];
    return ["customer"];
  }, [appState.currentRole, hasOrganizationAccess]);

  const setStateValue = (key, value) => dispatch({ type: "SET", key, value });
  const patchState = (payload) => dispatch({ type: "PATCH", payload });

  const setActiveStore = (updater) => {
    const nextStores = appState.stores.map((store) =>
      store.id === activeStore.id ? updater(store) : store,
    );
    setStateValue("stores", nextStores);
  };

  const setSession = (registerId, updater) => {
    dispatch({ type: "SET_SESSION", registerId, updater });
  };

  const setRegisterStats = (registerId, updater) => {
    const current = registerStatsByRegister[registerId] ?? mkRegisterStats();
    setStateValue("registerStatsByRegister", {
      ...registerStatsByRegister,
      [registerId]: updater(current),
    });
  };

  const setAbuseSignal = (registerId, updater) => {
    dispatch({ type: "SET_ABUSE_SIGNAL", registerId, updater });
  };

  const recordSuspiciousEvent = (registerId, eventKey) => {
    const rule = ABUSE_RULES[eventKey];
    if (!rule || !registerId) return;
    const nowTs = Date.now();
    setAbuseSignal(registerId, (signal) => {
      const currentEvents = Array.isArray(signal[rule.signalKey])
        ? signal[rule.signalKey]
        : [];
      const nextEvents = pruneEventTimestamps(
        [...currentEvents, nowTs],
        rule.windowMs,
        nowTs,
      );
      const nextSignal = {
        ...signal,
        [rule.signalKey]: nextEvents,
      };
      const nextFlags = buildSuspiciousFlags(nextSignal, nowTs);
      if (nextFlags.length > 0) {
        nextSignal.lastFlaggedAt = new Date(nowTs).toISOString();
      }
      return nextSignal;
    });
  };

  const clearReceiptForRegister = (registerId) => {
    if (!appState.receiptsByRegister[registerId]) return;
    const nextReceipts = { ...appState.receiptsByRegister };
    delete nextReceipts[registerId];
    setStateValue("receiptsByRegister", nextReceipts);
  };

  const completeCustomerPaid = (
    registerId,
    amount,
    itemsInTransaction,
    receiptItems,
    meta = {},
  ) => {
    const completedAt = new Date().toISOString();
    const registerLabel =
      registers.find((register) => register.id === registerId)?.name ?? "Register";
    const receipt = {
      id: `rcpt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      storeId: activeStore?.id ?? "",
      storeName: activeStore?.name ?? "Store",
      registerId,
      registerName: registerLabel,
      paidAt: completedAt,
      items: receiptItems,
      itemCount: itemsInTransaction,
      total: amount,
      paymentMethod: "Card",
    };
    patchState({
      traysByRegister: { ...appState.traysByRegister, [registerId]: [] },
      sessionsByRegister: {
        ...appState.sessionsByRegister,
        [registerId]: mkSession(),
      },
      receiptsByRegister: {
        ...appState.receiptsByRegister,
        [registerId]: receipt,
      },
    });
    setRegisterStats(registerId, (current) => ({
      ...current,
      totalSales: current.totalSales + amount,
      totalTransactions: current.totalTransactions + 1,
      paidTransactions: current.paidTransactions + 1,
      itemsSold: current.itemsSold + itemsInTransaction,
      lastPaidTotal: amount,
      lastTransactionAt: completedAt,
    }));
    void sendNuiEvent("customerPaid", {
      storeId: activeStore?.id,
      registerId,
      total: amount,
      ...meta,
    });
  };

  const completeCustomerStole = (registerId, itemsInTransaction, meta = {}) => {
    const completedAt = new Date().toISOString();
    const nextReceipts = { ...appState.receiptsByRegister };
    delete nextReceipts[registerId];
    patchState({
      traysByRegister: { ...appState.traysByRegister, [registerId]: [] },
      sessionsByRegister: {
        ...appState.sessionsByRegister,
        [registerId]: mkSession(),
      },
      receiptsByRegister: nextReceipts,
    });
    setRegisterStats(registerId, (current) => ({
      ...current,
      totalTransactions: current.totalTransactions + 1,
      stolenTransactions: current.stolenTransactions + 1,
      itemsStolen: current.itemsStolen + itemsInTransaction,
      lastTransactionAt: completedAt,
    }));
    void sendNuiEvent("customerStole", {
      storeId: activeStore?.id,
      registerId,
      ...meta,
    });
  };

  const resolveStealMinigame = (registerId) => {
    const currentSession = appState.sessionsByRegister[registerId] ?? mkSession();
    if (currentSession.phase !== "stealMinigame" || !currentSession.stealMinigame?.active) {
      return;
    }

    const customerScore = currentSession.stealMinigame.customerScore ?? 0;
    const employeeScore = currentSession.stealMinigame.employeeScore ?? 0;
    const customerWins = customerScore > employeeScore;
    const winner = customerWins ? "customer" : "employee";
    const itemsInTransaction = countItemsInTray(
      appState.traysByRegister[registerId] ?? EMPTY_ARRAY,
    );

    if (customerWins) {
      completeCustomerStole(registerId, itemsInTransaction, {
        minigame: { winner, customerScore, employeeScore },
      });
      return;
    }

    setSession(registerId, (sessionState) => ({
      ...sessionState,
      phase: "customer",
      stealMinigame: {
        ...(sessionState.stealMinigame ?? {}),
        active: false,
        winner,
      },
    }));
    playStealBlockedSiren();
    setRegisterStats(registerId, (current) => ({
      ...current,
      blockedStealAttempts: current.blockedStealAttempts + 1,
      lastTransactionAt: new Date().toISOString(),
    }));
    void sendNuiEvent("stealMinigameResolved", {
      storeId: activeStore?.id,
      registerId,
      winner,
      customerScore,
      employeeScore,
    });
  };

  const buildNormalizedTrayForRegister = ({
    trayLines,
    currentSession,
    catalogItems,
    comboItems,
    discountItems,
    discountContext = discountActivityContext,
    useDiscountPricing = currentSession.isRungUp,
  }) => {
    const catalogMap = new Map(catalogItems.map((item) => [item.id, item]));
    const comboMap = new Map(comboItems.map((combo) => [combo.id, combo]));
    const sessionDiscounts = discountItems.filter(
      (discount) =>
        currentSession.selectedDiscountIds.includes(discount.id) &&
        isDiscountActive(discount, discountContext),
    );
    const remainingStock = catalogItems.reduce((map, item) => {
      map[item.id] = item.stock;
      return map;
    }, {});
    const nextTray = [];

    const addLine = (line) => {
      const existing = nextTray.find((candidate) => candidate.id === line.id);
      if (!existing) {
        nextTray.push(line);
        return;
      }
      existing.qty += line.qty;
    };

    trayLines.forEach((trayItem) => {
      const requestedQty = Number(trayItem?.qty) || 0;
      if (requestedQty <= 0) return;

      if (isComboTrayLine(trayItem)) {
        const comboId =
          trayItem.comboId ??
          (typeof trayItem.id === "string"
            ? trayItem.id.replace(COMBO_LINE_PREFIX, "")
            : "");
        const combo = comboMap.get(comboId);
        if (!combo) return;
        if (combo.itemIds.some((itemId) => !catalogMap.has(itemId))) return;

        const maxQty = combo.itemIds.reduce(
          (minQty, itemId) => Math.min(minQty, remainingStock[itemId] ?? 0),
          Number.POSITIVE_INFINITY,
        );
        const qty = Math.min(requestedQty, maxQty);
        if (!Number.isFinite(qty) || qty <= 0) return;
        combo.itemIds.forEach((itemId) => {
          remainingStock[itemId] = Math.max(0, (remainingStock[itemId] ?? 0) - qty);
        });

        addLine({
          id: buildComboLineId(combo.id),
          lineType: "combo",
          comboId: combo.id,
          itemIds: combo.itemIds,
          name: combo.name,
          basePrice: calcComboBasePrice(combo, catalogMap),
          unitPrice: combo.bundlePrice,
          qty,
        });
        return;
      }

      const itemId = resolveTrayItemId(trayItem);
      const item = catalogMap.get(itemId);
      if (!item) return;

      const qty = Math.min(requestedQty, remainingStock[item.id] ?? item.stock);
      if (qty <= 0) return;
      remainingStock[item.id] = Math.max(0, (remainingStock[item.id] ?? item.stock) - qty);

      addLine({
        id: item.id,
        lineType: "item",
        itemId: item.id,
        name: item.name,
        basePrice: item.price,
        unitPrice: useDiscountPricing
          ? effectivePrice(item.id, item.price, sessionDiscounts, discountContext)
          : item.price,
        qty,
      });
    });

    return nextTray;
  };

  // Recomputes tray prices/qty after manager changes (prices, stock, discounts) or session updates.
  // This keeps frontend totals deterministic with currently selected discounts.
  const syncStoreTrays = (
    storeId,
    nextCatalog,
    nextDiscounts,
    nextCombos = combos,
    sessions = appState.sessionsByRegister,
  ) => {
    const store = appState.stores.find((candidate) => candidate.id === storeId);
    if (!store) return;

    const registerIds = store.registers.map((register) => register.id);
    const nextTrays = { ...appState.traysByRegister };

    registerIds.forEach((registerId) => {
      const currentSession = sessions[registerId] ?? mkSession();
      nextTrays[registerId] = buildNormalizedTrayForRegister({
        trayLines: appState.traysByRegister[registerId] ?? EMPTY_ARRAY,
        currentSession,
        catalogItems: nextCatalog,
        comboItems: nextCombos,
        discountItems: nextDiscounts,
      });
    });

    setStateValue("traysByRegister", nextTrays);
  };

  const playPaymentChime = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = 900;
      gain.gain.value = 0.07;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch (error) {
      void error;
    }
  };

  const playStealBlockedSiren = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(720, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(980, ctx.currentTime + 0.12);
      osc.frequency.linearRampToValueAtTime(720, ctx.currentTime + 0.24);
      osc.frequency.linearRampToValueAtTime(980, ctx.currentTime + 0.36);
      osc.frequency.linearRampToValueAtTime(650, ctx.currentTime + 0.48);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.09, ctx.currentTime + 0.02);
      gain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.52);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.54);
    } catch (error) {
      void error;
    }
  };

  // Standardized outbound NUI call wrapper so every action gets consistent pending/error UI.
  const sendNuiEvent = async (eventName, payload) => {
    setStateValue("nuiPendingAction", eventName);
    setStateValue("nuiError", "");
    const response = await postNui(eventName, payload);
    if (!response.ok) {
      const code = normalizeNuiErrorCode(
        response.error?.code,
        NUI_ERROR_CODES.NUI_ERROR,
      );
      const errorInfo = getNuiErrorInfo(code);
      const message = response.error?.message || errorInfo.defaultMessage;
      setStateValue("nuiError", `[${code}] ${message}`);
      const registerId = payload?.registerId ?? appState.activeRegisterId;
      if (code === NUI_ERROR_CODES.DUPLICATE_ACTION) {
        recordSuspiciousEvent(registerId, ABUSE_EVENT_KEYS.DUPLICATE_ACTION);
      }
      if (
        code === NUI_ERROR_CODES.TIER_NOT_ELIGIBLE &&
        eventName === "registerTierUpgraded"
      ) {
        recordSuspiciousEvent(registerId, ABUSE_EVENT_KEYS.FAILED_UPGRADE);
      }
    }
    setStateValue("lastNuiEvent", eventName);
    setStateValue("nuiPendingAction", "");
    return response;
  };

  const isManager = hasOrganizationAccess && appState.currentRole === "manager";
  const canUseEmployeeActions =
    hasOrganizationAccess &&
    (appState.currentRole === "manager" || appState.currentRole === "employee");

  const markTrayDirty = (registerId) => {
    setSession(registerId, (currentSession) => ({
      ...currentSession,
      isRungUp: false,
      processingError: "",
    }));
  };

  const setActiveRegisterTray = (nextTray) => {
    setStateValue("traysByRegister", {
      ...appState.traysByRegister,
      [appState.activeRegisterId]: nextTray,
    });
    markTrayDirty(appState.activeRegisterId);
  };

  const canAddComboToTray = (combo, currentTray) => {
    if (!combo || combo.itemIds.length === 0) return false;
    const stockUsage = buildStockUsageFromTray(currentTray, comboById);
    return combo.itemIds.every((itemId) => {
      const item = catalogById.get(itemId);
      if (!item) return false;
      return (stockUsage[itemId] ?? 0) < item.stock;
    });
  };

  const actions = {
    setView: (value) => {
      if (!allowedViews.includes(value)) return;
      setStateValue("view", value);
    },
    closeUi: () => {
      setStateValue("uiVisible", false);
      void sendNuiEvent("close", {});
    },
    clearNuiError: () => setStateValue("nuiError", ""),
    // Prototype helper: simulate entering a register from a polyzone/prop in a given role.
    openInteractionAsRole: ({ role, businessId, interactionId, registerId }) => {
      const requestedView = role === "manager" ? "manager" : role;
      const payload = {
        role,
        view: requestedView,
        storeId: appState.activeStoreId,
        registerId: registerId ?? appState.activeRegisterId,
        interaction: {
          businessId,
          interactionId,
        },
      };
      patchState({
        uiVisible: true,
        isOrganizationMember: role === "manager" || role === "employee",
        currentRole: role,
        view:
          role === "manager" || role === "employee"
            ? requestedView
            : "customer",
        activeRegisterId: payload.registerId,
        interactionContext: payload.interaction,
      });
      void sendNuiEvent("openRegister", payload);
    },
    onStoreChange: (storeId) => {
      const store = appState.stores.find((candidate) => candidate.id === storeId);
      if (!store) return;
      patchState({
        activeStoreId: store.id,
        activeRegisterId: store.registers[0].id,
        managerCategoryFilter: "All Categories",
        interactionContext: null,
      });
    },
    onRegisterChange: (value) => setStateValue("activeRegisterId", value),
    onStoreNameChange: (value) => setStateValue("newStoreName", value),
    onRegisterNameChange: (value) => setStateValue("newRegisterName", value),
    onCategoryFilterChange: (value) => setStateValue("managerCategoryFilter", value),
    onNewItemChange: (field, value) =>
      setStateValue("newItem", { ...appState.newItem, [field]: value }),
    onNewDiscountChange: (field, value) =>
      setStateValue("newDiscount", { ...appState.newDiscount, [field]: value }),
    onNewComboChange: (field, value) =>
      setStateValue("newCombo", { ...appState.newCombo, [field]: value }),
    onSelectRegister: (value) => setStateValue("activeRegisterId", value),
    onUpgradeRegisterTier: (registerId) => {
      if (!isManager) return;
      const currentLevel = registerTierByRegister[registerId] ?? 1;
      if (currentLevel >= MAX_REGISTER_TIER) {
        recordSuspiciousEvent(registerId, ABUSE_EVENT_KEYS.FAILED_UPGRADE);
        return;
      }
      const nextLevel = currentLevel + 1;
      setStateValue("registerTierByRegister", {
        ...registerTierByRegister,
        [registerId]: nextLevel,
      });
      void sendNuiEvent("registerTierUpgraded", {
        storeId: activeStore?.id,
        registerId,
        previousTierLevel: currentLevel,
        nextTierLevel: nextLevel,
      });
    },

    onAddStore: () => {
      if (!isManager) return;
      const name = appState.newStoreName.trim();
      if (!name) return;
      const id = `store-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const firstRegisterId = `${id}-register-1`;
      patchState({
        stores: [...appState.stores, mkStore(id, name)],
        traysByRegister: { ...appState.traysByRegister, [firstRegisterId]: [] },
        sessionsByRegister: {
          ...appState.sessionsByRegister,
          [firstRegisterId]: mkSession(),
        },
        registerTierByRegister: {
          ...registerTierByRegister,
          [firstRegisterId]: 1,
        },
        registerStatsByRegister: {
          ...registerStatsByRegister,
          [firstRegisterId]: mkRegisterStats(),
        },
        abuseSignalsByRegister: {
          ...abuseSignalsByRegister,
          [firstRegisterId]: mkAbuseSignal(),
        },
        activeStoreId: id,
        activeRegisterId: firstRegisterId,
        managerCategoryFilter: "All Categories",
        newStoreName: "",
      });
    },

    onRemoveStore: (id) => {
      if (!isManager) return;
      if (appState.stores.length <= 1) return;
      const removed = appState.stores.find((store) => store.id === id);
      if (!removed) return;
      const nextStores = appState.stores.filter((store) => store.id !== id);
      const nextTrays = { ...appState.traysByRegister };
      const nextSessions = { ...appState.sessionsByRegister };
      const nextRegisterTiers = { ...registerTierByRegister };
      const nextRegisterStats = { ...registerStatsByRegister };
      const nextAbuseSignals = { ...abuseSignalsByRegister };
      removed.registers.forEach((register) => {
        delete nextTrays[register.id];
        delete nextSessions[register.id];
        delete nextRegisterTiers[register.id];
        delete nextRegisterStats[register.id];
        delete nextAbuseSignals[register.id];
      });
      patchState({
        stores: nextStores,
        traysByRegister: nextTrays,
        sessionsByRegister: nextSessions,
        registerTierByRegister: nextRegisterTiers,
        registerStatsByRegister: nextRegisterStats,
        abuseSignalsByRegister: nextAbuseSignals,
        ...(appState.activeStoreId === id
          ? {
              activeStoreId: nextStores[0].id,
              activeRegisterId: nextStores[0].registers[0].id,
              managerCategoryFilter: "All Categories",
            }
          : {}),
      });
    },

    onAddRegister: () => {
      if (!isManager) return;
      const name = appState.newRegisterName.trim();
      if (!name) return;
      const id = `${activeStore.id}-register-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;
      setActiveStore((store) => ({
        ...store,
        registers: [...store.registers, { id, name }],
      }));
      patchState({
        traysByRegister: { ...appState.traysByRegister, [id]: [] },
        sessionsByRegister: { ...appState.sessionsByRegister, [id]: mkSession() },
        registerTierByRegister: { ...registerTierByRegister, [id]: 1 },
        registerStatsByRegister: { ...registerStatsByRegister, [id]: mkRegisterStats() },
        abuseSignalsByRegister: { ...abuseSignalsByRegister, [id]: mkAbuseSignal() },
        activeRegisterId: id,
        newRegisterName: "",
      });
    },

    onRemoveRegister: (id) => {
      if (!isManager) return;
      if (registers.length <= 1) return;
      const nextRegisters = registers.filter((register) => register.id !== id);
      setActiveStore((store) => ({ ...store, registers: nextRegisters }));
      const nextTrays = { ...appState.traysByRegister };
      const nextSessions = { ...appState.sessionsByRegister };
      const nextRegisterTiers = { ...registerTierByRegister };
      const nextRegisterStats = { ...registerStatsByRegister };
      const nextAbuseSignals = { ...abuseSignalsByRegister };
      delete nextTrays[id];
      delete nextSessions[id];
      delete nextRegisterTiers[id];
      delete nextRegisterStats[id];
      delete nextAbuseSignals[id];
      patchState({
        traysByRegister: nextTrays,
        sessionsByRegister: nextSessions,
        registerTierByRegister: nextRegisterTiers,
        registerStatsByRegister: nextRegisterStats,
        abuseSignalsByRegister: nextAbuseSignals,
        ...(appState.activeRegisterId === id
          ? { activeRegisterId: nextRegisters[0].id }
          : {}),
      });
    },

    // Employee flow starts here: build tray -> ring up -> hand to customer phase.
    onAddToTray: (id) => {
      if (!canUseEmployeeActions || session.phase !== "employee" || session.isProcessing)
        return;
      const item = catalog.find((catalogItem) => catalogItem.id === id);
      if (!item) return;

      const currentTray = appState.traysByRegister[appState.activeRegisterId] ?? [];
      const existing = currentTray.find(
        (trayItem) => !isComboTrayLine(trayItem) && resolveTrayItemId(trayItem) === id,
      );
      const stockUsage = buildStockUsageFromTray(currentTray, comboById);
      if ((stockUsage[item.id] ?? 0) >= item.stock) return;

      const nextTray = existing
        ? currentTray.map((trayItem) =>
            trayItem.id === id
              ? { ...trayItem, qty: trayItem.qty + 1, unitPrice: item.price }
              : trayItem,
          )
        : [
            ...currentTray,
            {
              id: item.id,
              lineType: "item",
              itemId: item.id,
              name: item.name,
              basePrice: item.price,
              unitPrice: item.price,
              qty: 1,
            },
          ];

      setActiveRegisterTray(nextTray);
    },

    onAddComboToTray: (comboId) => {
      if (!canUseEmployeeActions || session.phase !== "employee" || session.isProcessing)
        return;
      const combo = comboById.get(comboId);
      if (!combo) return;

      const currentTray = appState.traysByRegister[appState.activeRegisterId] ?? [];
      if (!canAddComboToTray(combo, currentTray)) return;

      const lineId = buildComboLineId(combo.id);
      const existing = currentTray.find((trayItem) => trayItem.id === lineId);
      const comboBasePrice = calcComboBasePrice(combo, catalogById);
      const nextTray = existing
        ? currentTray.map((trayItem) =>
            trayItem.id === lineId ? { ...trayItem, qty: trayItem.qty + 1 } : trayItem,
          )
        : [
            ...currentTray,
            {
              id: lineId,
              lineType: "combo",
              comboId: combo.id,
              itemIds: combo.itemIds,
              name: combo.name,
              basePrice: comboBasePrice,
              unitPrice: combo.bundlePrice,
              qty: 1,
            },
          ];

      setActiveRegisterTray(nextTray);
    },

    onIncreaseTrayLine: (lineId) => {
      if (!canUseEmployeeActions || session.phase !== "employee" || session.isProcessing)
        return;
      const currentTray = appState.traysByRegister[appState.activeRegisterId] ?? [];
      const trayItem = currentTray.find((line) => line.id === lineId);
      if (!trayItem) return;

      if (isComboTrayLine(trayItem)) {
        const comboId =
          trayItem.comboId ??
          (typeof trayItem.id === "string"
            ? trayItem.id.replace(COMBO_LINE_PREFIX, "")
            : "");
        const combo = comboById.get(comboId);
        if (!combo) return;
        if (!canAddComboToTray(combo, currentTray)) return;
        const comboLineId = buildComboLineId(combo.id);
        const nextTray = currentTray.map((line) =>
          line.id === comboLineId ? { ...line, qty: line.qty + 1 } : line,
        );
        setActiveRegisterTray(nextTray);
        return;
      }

      const itemId = resolveTrayItemId(trayItem);
      const item = catalogById.get(itemId);
      if (!item) return;
      const stockUsage = buildStockUsageFromTray(currentTray, comboById);
      if ((stockUsage[itemId] ?? 0) >= item.stock) return;
      const nextTray = currentTray.map((line) =>
        line.id === lineId ? { ...line, qty: line.qty + 1, unitPrice: item.price } : line,
      );
      setActiveRegisterTray(nextTray);
    },

    onDecreaseTrayItem: (id) => {
      if (!canUseEmployeeActions || session.phase !== "employee" || session.isProcessing)
        return;
      const nextTray = (appState.traysByRegister[appState.activeRegisterId] ?? [])
        .map((trayItem) =>
          trayItem.id === id ? { ...trayItem, qty: trayItem.qty - 1 } : trayItem,
        )
        .filter((trayItem) => trayItem.qty > 0);

      setActiveRegisterTray(nextTray);
    },

    onRemoveTrayItem: (id) => {
      if (!canUseEmployeeActions || session.phase !== "employee" || session.isProcessing)
        return;
      const nextTray = (appState.traysByRegister[appState.activeRegisterId] ?? []).filter(
        (trayItem) => trayItem.id !== id,
      );

      setActiveRegisterTray(nextTray);
    },

    onClearTransaction: () => {
      if (!canUseEmployeeActions) return;
      if (session.phase === "stealMinigame" || session.isProcessing) return;
      const nextReceipts = { ...appState.receiptsByRegister };
      delete nextReceipts[appState.activeRegisterId];
      patchState({
        traysByRegister: { ...appState.traysByRegister, [appState.activeRegisterId]: [] },
        sessionsByRegister: {
          ...appState.sessionsByRegister,
          [appState.activeRegisterId]: mkSession(),
        },
        receiptsByRegister: nextReceipts,
      });
    },

    onRingUp: () => {
      if (!canUseEmployeeActions || !tray.length || session.phase !== "employee") return;
      if (session.isProcessing) return;
      const registerId = appState.activeRegisterId;
      clearReceiptForRegister(registerId);
      const tierLevel = registerTierByRegister[registerId] ?? 1;
      const tier = getRegisterTier(tierLevel);
      const processingMs = tier.processingMs;
      const trayItemIds = new Set(Object.keys(stockUsageByItemId));
      const autoDiscountIds = tier.autoDiscountAssist
        ? discounts
            .filter(
              (discount) =>
                isDiscountActive(discount, discountActivityContext) &&
                discount.itemIds.some((itemId) => trayItemIds.has(itemId)),
            )
            .map((discount) => discount.id)
        : [];
      const nextSelectedDiscountIds = [
        ...new Set([...session.selectedDiscountIds, ...autoDiscountIds]),
      ];
      const nextSession = {
        ...session,
        isRungUp: false,
        isProcessing: true,
        processingProgress: 0,
        processingError: "",
        selectedDiscountIds: nextSelectedDiscountIds,
      };
      const nextTray = buildNormalizedTrayForRegister({
        trayLines: appState.traysByRegister[registerId] ?? EMPTY_ARRAY,
        currentSession: nextSession,
        catalogItems: catalog,
        comboItems: combos,
        discountItems: discounts,
        discountContext: discountActivityContext,
        useDiscountPricing: true,
      });
      patchState({
        sessionsByRegister: {
          ...appState.sessionsByRegister,
          [registerId]: nextSession,
        },
        traysByRegister: {
          ...appState.traysByRegister,
          [registerId]: nextTray,
        },
      });

      const startedAt = Date.now();
      const progressIntervalId = window.setInterval(() => {
        const elapsed = Date.now() - startedAt;
        const pct = Math.min(100, Math.round((elapsed / processingMs) * 100));
        setSession(registerId, (sessionState) => {
          if (!sessionState.isProcessing) return sessionState;
          return { ...sessionState, processingProgress: pct };
        });
      }, 90);

      window.setTimeout(() => {
        window.clearInterval(progressIntervalId);
        const failed = Math.random() < (tier.ringUpErrorChance ?? 0);
        if (failed) {
          setSession(registerId, (sessionState) => ({
            ...sessionState,
            isRungUp: false,
            isProcessing: false,
            processingProgress: 0,
            processingError:
              "Register jam detected. Re-ring this order.",
          }));
          void sendNuiEvent("ringUpMachineError", {
            storeId: activeStore?.id,
            registerId,
            registerTierLevel: tierLevel,
          });
          return;
        }

        setSession(registerId, (sessionState) => ({
          ...sessionState,
          isRungUp: true,
          isProcessing: false,
          processingProgress: 100,
          processingError: "",
        }));
        void sendNuiEvent("ringUp", {
          storeId: activeStore?.id,
          registerId,
          registerTierLevel: tierLevel,
          processingMs,
          tray: nextTray,
          total: nextTray.reduce((sum, item) => sum + item.unitPrice * item.qty, 0),
        });
      }, processingMs);
    },

    onToggleSessionDiscount: (id) => {
      if (!canUseEmployeeActions || session.phase !== "employee" || session.isProcessing)
        return;
      setSession(appState.activeRegisterId, (currentSession) => ({
        ...currentSession,
        isRungUp: false,
        processingError: "",
        selectedDiscountIds: currentSession.selectedDiscountIds.includes(id)
          ? currentSession.selectedDiscountIds.filter((discountId) => discountId !== id)
          : [...currentSession.selectedDiscountIds, id],
      }));
    },

    // Locks register into customer phase. Customer UI can then pay or steal.
    onConfirmCustomerActions: () => {
      if (!canUseEmployeeActions || !session.isRungUp || session.phase !== "employee")
        return;
      if (session.isProcessing) return;
      clearReceiptForRegister(appState.activeRegisterId);
      setSession(appState.activeRegisterId, (currentSession) => ({
        ...currentSession,
        phase: "customer",
      }));
      void sendNuiEvent("enableCustomerActions", {
        storeId: activeStore?.id,
        registerId: appState.activeRegisterId,
      });
    },

    // Ends transaction + emits event for server-side payment handling/chime.
    onCustomerPay: () => {
      if (session.phase !== "customer") return;
      if (session.stealMinigame?.active) return;
      const registerId = appState.activeRegisterId;
      const itemsInTransaction = countItemsInTray(tray);
      const receiptItems = tray.map((trayItem) => ({
        id: trayItem.id,
        name: trayItem.name,
        lineType: trayItem.lineType ?? "item",
        itemIds: trayItem.itemIds ?? [],
        qty: trayItem.qty,
        unitPrice: trayItem.unitPrice,
        lineTotal: trayItem.unitPrice * trayItem.qty,
      }));
      playPaymentChime();
      completeCustomerPaid(registerId, total, itemsInTransaction, receiptItems);
    },

    onDismissCustomerReceipt: () => {
      clearReceiptForRegister(appState.activeRegisterId);
    },

    // Starts a minigame instead of immediately completing the theft.
    onCustomerSteal: () => {
      if (session.phase !== "customer") return;
      if (session.stealMinigame?.active) return;
      if (session.stealMinigame?.winner === "employee") return;
      const registerId = appState.activeRegisterId;
      recordSuspiciousEvent(registerId, ABUSE_EVENT_KEYS.RAPID_STEAL);
      const tier = getRegisterTier(registerTierByRegister[registerId] ?? 1);
      const instantBlockChance = tier.instantStealBlockChance ?? 0;
      if (Math.random() < instantBlockChance) {
        setSession(registerId, (sessionState) => ({
          ...sessionState,
          phase: "customer",
          stealMinigame: {
            ...(sessionState.stealMinigame ?? {}),
            active: false,
            winner: "employee",
          },
        }));
        playStealBlockedSiren();
        setRegisterStats(registerId, (current) => ({
          ...current,
          stealAttempts: current.stealAttempts + 1,
          blockedStealAttempts: current.blockedStealAttempts + 1,
          lastTransactionAt: new Date().toISOString(),
        }));
        void sendNuiEvent("stealAttemptAutoBlocked", {
          storeId: activeStore?.id,
          registerId,
          registerTierLevel: tier.level,
          instantBlockChance,
        });
        return;
      }

      const now = Date.now();
      const durationMs = tier.stealMinigameDurationMs ?? 10000;
      const employeeDefenseBonus = tier.employeeDefenseBonus ?? 0;
      setSession(registerId, (sessionState) => ({
        ...sessionState,
        phase: "stealMinigame",
        stealMinigame: {
          active: true,
          startedAt: now,
          endsAt: now + durationMs,
          durationMs,
          customerScore: 0,
          employeeScore: employeeDefenseBonus,
          winner: "",
        },
      }));
      setRegisterStats(appState.activeRegisterId, (current) => ({
        ...current,
        stealAttempts: current.stealAttempts + 1,
      }));
      void sendNuiEvent("stealMinigameStarted", {
        storeId: activeStore?.id,
        registerId,
        durationMs,
        employeeDefenseBonus,
        registerTierLevel: tier.level,
      });
    },

    onStealMinigameTap: () => {
      if (session.phase !== "stealMinigame" || !session.stealMinigame?.active) return;
      const registerId = appState.activeRegisterId;
      if (Date.now() >= session.stealMinigame.endsAt) {
        resolveStealMinigame(registerId);
        return;
      }

      const isCustomer = appState.currentRole === "customer";
      const isEmployeeSide =
        appState.currentRole === "employee" || appState.currentRole === "manager";
      if (!isCustomer && !isEmployeeSide) return;

      setSession(registerId, (sessionState) => ({
        ...sessionState,
        stealMinigame: {
          ...sessionState.stealMinigame,
          customerScore: sessionState.stealMinigame.customerScore + (isCustomer ? 1 : 0),
          employeeScore: sessionState.stealMinigame.employeeScore + (isEmployeeSide ? 1 : 0),
        },
      }));
    },

    onResolveStealMinigame: () => {
      if (session.phase !== "stealMinigame") return;
      resolveStealMinigame(appState.activeRegisterId);
    },

    onUpdateItem: (id, field, raw) => {
      if (!isManager) return;
      const nextCatalog = catalog.map((item) => {
        if (item.id !== id) return item;
        if (field === "name") return { ...item, name: raw };
        if (field === "category")
          return { ...item, category: raw.trim() || "Uncategorized" };
        if (field === "price") {
          const value = Number(raw);
          return Number.isNaN(value) || value < 0 ? item : { ...item, price: value };
        }
        if (field === "stock") {
          const value = Number(raw);
          return !Number.isInteger(value) || value < 0 ? item : { ...item, stock: value };
        }
        if (field === "sortOrder") {
          const value = Number(raw);
          return !Number.isInteger(value) ? item : { ...item, sortOrder: value };
        }
        return item;
      });
      setActiveStore((store) => ({ ...store, catalog: nextCatalog }));
      syncStoreTrays(activeStore.id, nextCatalog, discounts, combos);
    },

    onAddMenuItem: () => {
      if (!isManager) return;
      const name = appState.newItem.name.trim();
      const price = Number(appState.newItem.price);
      const stockInput = Number(appState.newItem.stock);
      const stock = Number.isInteger(stockInput) && stockInput >= 0 ? stockInput : 999;
      const sortOrder = Number(appState.newItem.sortOrder);
      const category = appState.newItem.category.trim() || "Uncategorized";
      if (
        !name ||
        Number.isNaN(price) ||
        price < 0 ||
        !Number.isInteger(sortOrder)
      ) {
        return;
      }
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const nextCatalog = [...catalog, { id, name, price, stock, sortOrder, category }];
      setActiveStore((store) => ({ ...store, catalog: nextCatalog }));
      setStateValue("newItem", {
        name: "",
        price: "",
        stock: "",
        sortOrder: "",
        category: "",
      });
      syncStoreTrays(activeStore.id, nextCatalog, discounts, combos);
    },

    onRemoveMenuItem: (id) => {
      if (!isManager) return;
      const nextCatalog = catalog.filter((item) => item.id !== id);
      const nextDiscounts = discounts.map((discount) => ({
        ...discount,
        itemIds: discount.itemIds.filter((itemId) => itemId !== id),
      }));
      const nextCombos = combos
        .map((combo) => ({
          ...combo,
          itemIds: combo.itemIds.filter((itemId) => itemId !== id),
        }))
        .filter((combo) => combo.itemIds.length >= 2);
      setActiveStore((store) => ({
        ...store,
        catalog: nextCatalog,
        discounts: nextDiscounts,
        combos: nextCombos,
      }));
      syncStoreTrays(activeStore.id, nextCatalog, nextDiscounts, nextCombos);
    },

    onToggleNewComboItem: (itemId) => {
      if (!isManager) return;
      const itemIds = appState.newCombo.itemIds.includes(itemId)
        ? appState.newCombo.itemIds.filter((id) => id !== itemId)
        : [...appState.newCombo.itemIds, itemId];
      setStateValue("newCombo", { ...appState.newCombo, itemIds });
    },

    onAddCombo: () => {
      if (!isManager) return;
      const name = appState.newCombo.name.trim();
      const bundlePrice = Number(appState.newCombo.bundlePrice);
      if (
        !name ||
        Number.isNaN(bundlePrice) ||
        bundlePrice < 0 ||
        appState.newCombo.itemIds.length < 2
      ) {
        return;
      }
      const id = `combo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const nextCombos = [
        ...combos,
        {
          id,
          name,
          bundlePrice,
          itemIds: [...new Set(appState.newCombo.itemIds)],
        },
      ];
      setActiveStore((store) => ({ ...store, combos: nextCombos }));
      setStateValue("newCombo", {
        name: "",
        bundlePrice: "",
        itemIds: [],
      });
      syncStoreTrays(activeStore.id, catalog, discounts, nextCombos);
    },

    onUpdateCombo: (id, field, raw) => {
      if (!isManager) return;
      const nextCombos = combos.map((combo) => {
        if (combo.id !== id) return combo;
        if (field === "name") return { ...combo, name: raw };
        if (field === "bundlePrice") {
          const value = Number(raw);
          return Number.isNaN(value) || value < 0
            ? combo
            : { ...combo, bundlePrice: value };
        }
        return combo;
      });
      setActiveStore((store) => ({ ...store, combos: nextCombos }));
      syncStoreTrays(activeStore.id, catalog, discounts, nextCombos);
    },

    onToggleComboItem: (comboId, itemId) => {
      if (!isManager) return;
      const nextCombos = combos.map((combo) => {
        if (combo.id !== comboId) return combo;
        if (combo.itemIds.includes(itemId)) {
          if (combo.itemIds.length <= 2) return combo;
          return {
            ...combo,
            itemIds: combo.itemIds.filter((id) => id !== itemId),
          };
        }
        return {
          ...combo,
          itemIds: [...combo.itemIds, itemId],
        };
      });
      setActiveStore((store) => ({ ...store, combos: nextCombos }));
      syncStoreTrays(activeStore.id, catalog, discounts, nextCombos);
    },

    onRemoveCombo: (id) => {
      if (!isManager) return;
      const nextCombos = combos.filter((combo) => combo.id !== id);
      setActiveStore((store) => ({ ...store, combos: nextCombos }));
      syncStoreTrays(activeStore.id, catalog, discounts, nextCombos);
    },

    onToggleNewDiscountItem: (itemId) => {
      if (!isManager) return;
      const itemIds = appState.newDiscount.itemIds.includes(itemId)
        ? appState.newDiscount.itemIds.filter((id) => id !== itemId)
        : [...appState.newDiscount.itemIds, itemId];
      setStateValue("newDiscount", { ...appState.newDiscount, itemIds });
    },

    onToggleNewDiscountWeekday: (weekday) => {
      if (!isManager) return;
      const day = Number(weekday);
      if (!Number.isInteger(day) || day < 0 || day > 6) return;
      const currentWeekdays = Array.isArray(appState.newDiscount.weekdays)
        ? appState.newDiscount.weekdays
        : [];
      const weekdays = currentWeekdays.includes(day)
        ? currentWeekdays.filter((value) => value !== day)
        : [...currentWeekdays, day];
      setStateValue("newDiscount", {
        ...appState.newDiscount,
        weekdays: [...new Set(weekdays)].sort(),
      });
    },

    onAddDiscount: () => {
      if (!isManager) return;
      const name = appState.newDiscount.name.trim();
      const discountPrice = Number(appState.newDiscount.discountPrice);
      const promotionType = appState.newDiscount.promotionType || "standard";
      const eventTag = (appState.newDiscount.eventTag ?? "").trim();
      const weekdays = [...new Set(appState.newDiscount.weekdays ?? EMPTY_ARRAY)]
        .map((day) => Number(day))
        .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
        .sort();
      if (
        !name ||
        Number.isNaN(discountPrice) ||
        discountPrice < 0 ||
        !appState.newDiscount.itemIds.length
      ) {
        return;
      }
      if (
        appState.newDiscount.startDate &&
        appState.newDiscount.endDate &&
        appState.newDiscount.endDate < appState.newDiscount.startDate
      ) {
        return;
      }
      if (
        (appState.newDiscount.startTime && !appState.newDiscount.endTime) ||
        (!appState.newDiscount.startTime && appState.newDiscount.endTime)
      ) {
        return;
      }
      if (promotionType === "weekdayDeal" && weekdays.length === 0) return;
      if (promotionType === "eventSpecial" && !eventTag) return;
      const id = `d-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const nextDiscounts = [
        ...discounts,
        {
          id,
          name,
          discountPrice,
          promotionType,
          startDate: appState.newDiscount.startDate,
          endDate: appState.newDiscount.endDate,
          startTime: appState.newDiscount.startTime,
          endTime: appState.newDiscount.endTime,
          weekdays,
          eventTag,
          itemIds: appState.newDiscount.itemIds,
        },
      ];
      setActiveStore((store) => ({ ...store, discounts: nextDiscounts }));
      setStateValue("newDiscount", {
        name: "",
        discountPrice: "",
        promotionType: "standard",
        startDate: "",
        endDate: "",
        startTime: "",
        endTime: "",
        weekdays: [],
        eventTag: "",
        itemIds: [],
      });
      syncStoreTrays(activeStore.id, catalog, nextDiscounts, combos);
    },

    onUpdateDiscount: (id, field, raw) => {
      if (!isManager) return;
      const nextDiscounts = discounts.map((discount) => {
        if (discount.id !== id) return discount;
        if (field === "name") return { ...discount, name: raw };
        if (field === "discountPrice") {
          const value = Number(raw);
          return Number.isNaN(value) || value < 0
            ? discount
            : { ...discount, discountPrice: value };
        }
        if (field === "promotionType") return { ...discount, promotionType: raw };
        if (field === "startDate") return { ...discount, startDate: raw };
        if (field === "endDate") return { ...discount, endDate: raw };
        if (field === "startTime") return { ...discount, startTime: raw };
        if (field === "endTime") return { ...discount, endTime: raw };
        if (field === "eventTag") return { ...discount, eventTag: raw };
        return discount;
      });
      setActiveStore((store) => ({ ...store, discounts: nextDiscounts }));
      syncStoreTrays(activeStore.id, catalog, nextDiscounts, combos);
    },

    onToggleDiscountWeekday: (discountId, weekday) => {
      if (!isManager) return;
      const day = Number(weekday);
      if (!Number.isInteger(day) || day < 0 || day > 6) return;
      const nextDiscounts = discounts.map((discount) => {
        if (discount.id !== discountId) return discount;
        const weekdays = Array.isArray(discount.weekdays)
          ? discount.weekdays
              .map((value) => Number(value))
              .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6)
          : [];
        const nextWeekdays = weekdays.includes(day)
          ? weekdays.filter((value) => value !== day)
          : [...weekdays, day];
        return {
          ...discount,
          weekdays: [...new Set(nextWeekdays)].sort(),
        };
      });
      setActiveStore((store) => ({ ...store, discounts: nextDiscounts }));
      syncStoreTrays(activeStore.id, catalog, nextDiscounts, combos);
    },

    onToggleDiscountItem: (discountId, itemId) => {
      if (!isManager) return;
      const nextDiscounts = discounts.map((discount) =>
        discount.id !== discountId
          ? discount
          : {
              ...discount,
              itemIds: discount.itemIds.includes(itemId)
                ? discount.itemIds.filter((id) => id !== itemId)
                : [...discount.itemIds, itemId],
            },
      );
      setActiveStore((store) => ({ ...store, discounts: nextDiscounts }));
      syncStoreTrays(activeStore.id, catalog, nextDiscounts, combos);
    },

    onRemoveDiscount: (id) => {
      if (!isManager) return;
      const nextDiscounts = discounts.filter((discount) => discount.id !== id);
      setActiveStore((store) => ({ ...store, discounts: nextDiscounts }));
      syncStoreTrays(activeStore.id, catalog, nextDiscounts, combos);
    },
  };

  const closeUiRef = useRef(actions.closeUi);
  closeUiRef.current = actions.closeUi;

  const resolveStealMinigameRef = useRef(resolveStealMinigame);
  resolveStealMinigameRef.current = resolveStealMinigame;

  useEffect(() => {
    // Inbound message contract from FiveM client scripts.
    // Keep action names aligned with FIVEM_INTEGRATION.md.
    const unsub = onNuiMessage((message) => {
      const payload = message.payload ?? {};
      switch (message.action) {
        case "openRegister": {
          const role = payload.role ?? "employee";
          const requestedView = payload.view ?? (role === "manager" ? "manager" : role);
          const membership = resolveOrganizationMembership(payload);
          const isOrganizationMember = membership === true;
          patchState({
            uiVisible: true,
            isOrganizationMember,
            currentRole: role,
            ...(Array.isArray(payload.activeEventTags)
              ? { activeEventTags: payload.activeEventTags }
              : {}),
            ...(Array.isArray(payload.eventTags)
              ? { activeEventTags: payload.eventTags }
              : {}),
            ...(payload.storeId ? { activeStoreId: payload.storeId } : {}),
            ...(payload.registerId ? { activeRegisterId: payload.registerId } : {}),
            interactionContext: payload.interaction ?? null,
            view: isOrganizationMember ? requestedView : "customer",
          });
          break;
        }
        case "closeRegister":
          patchState({
            uiVisible: false,
            interactionContext: null,
            isOrganizationMember: false,
            view: "customer",
          });
          break;
        case "setRole":
          {
            const membership = resolveOrganizationMembership(payload);
            const requestedView = payload.view ?? (payload.role === "manager" ? "manager" : payload.role);
            const next = {
              currentRole: payload.role ?? "employee",
              ...(membership === null ? {} : { isOrganizationMember: membership }),
              ...(Array.isArray(payload.activeEventTags)
                ? { activeEventTags: payload.activeEventTags }
                : {}),
              ...(Array.isArray(payload.eventTags)
                ? { activeEventTags: payload.eventTags }
                : {}),
            };
            if (payload.view) {
              next.view = membership === true ? requestedView : "customer";
            }
            patchState(next);
          }
          break;
        case "setView":
          if (typeof payload.view === "string") {
            setStateValue("view", payload.view);
          }
          break;
        case "syncState": {
          // Accept only known keys so random payload keys cannot mutate arbitrary state.
          const safe = {};
          if (Array.isArray(payload.stores)) safe.stores = payload.stores;
          if (payload.activeStoreId) safe.activeStoreId = payload.activeStoreId;
          if (payload.activeRegisterId) safe.activeRegisterId = payload.activeRegisterId;
          if (payload.traysByRegister) safe.traysByRegister = payload.traysByRegister;
          if (payload.sessionsByRegister) safe.sessionsByRegister = payload.sessionsByRegister;
          if (payload.receiptsByRegister) safe.receiptsByRegister = payload.receiptsByRegister;
          if (payload.registerTierByRegister) {
            safe.registerTierByRegister = payload.registerTierByRegister;
          }
          if (payload.registerLevelsByRegister) {
            safe.registerTierByRegister = payload.registerLevelsByRegister;
          }
          if (payload.registerStatsByRegister) {
            safe.registerStatsByRegister = payload.registerStatsByRegister;
          }
          if (payload.statsByRegister) safe.registerStatsByRegister = payload.statsByRegister;
          if (payload.abuseSignalsByRegister) {
            safe.abuseSignalsByRegister = payload.abuseSignalsByRegister;
          }
          if (payload.currentRole) safe.currentRole = payload.currentRole;
          if (payload.view) safe.view = payload.view;
          if (Array.isArray(payload.activeEventTags)) {
            safe.activeEventTags = payload.activeEventTags;
          }
          if (Array.isArray(payload.eventTags)) {
            safe.activeEventTags = payload.eventTags;
          }
          const membership = resolveOrganizationMembership(payload);
          if (membership !== null) safe.isOrganizationMember = membership;
          if (payload.interactionContext !== undefined) {
            safe.interactionContext = payload.interactionContext;
          }
          patchState(safe);
          break;
        }
        default:
          break;
      }
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    // Common NUI UX: ESC closes the panel and releases focus.
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      if (!appState.uiVisible) return;
      closeUiRef.current();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [appState.uiVisible]);

  useEffect(() => {
    if (session.phase !== "stealMinigame" || !session.stealMinigame?.active) return;
    const msLeft = session.stealMinigame.endsAt - Date.now();
    if (msLeft <= 0) {
      resolveStealMinigameRef.current(appState.activeRegisterId);
      return;
    }
    const timeoutId = window.setTimeout(() => {
      resolveStealMinigameRef.current(appState.activeRegisterId);
    }, msLeft);
    return () => window.clearTimeout(timeoutId);
  }, [
    appState.activeRegisterId,
    session.phase,
    session.stealMinigame?.active,
    session.stealMinigame?.endsAt,
  ]);

  const state = {
    stores: appState.stores,
    storesCount: appState.stores.length,
    activeStoreId: activeStore?.id ?? "",
    activeStoreName: activeStore?.name ?? "",
    registers,
    activeRegisterId: appState.activeRegisterId,
    registerName,
    view: appState.view,
    currentRole: appState.currentRole,
    isOrganizationMember: appState.isOrganizationMember,
    activeEventTags: appState.activeEventTags,
    allowedViews,
    uiVisible: appState.uiVisible,
    nuiPendingAction: appState.nuiPendingAction,
    nuiError: appState.nuiError,
    lastNuiEvent: appState.lastNuiEvent,
    interactionContext: appState.interactionContext,
    businessInteractions,
    session,
    customerReceipt: appState.receiptsByRegister[appState.activeRegisterId] ?? null,
    tray,
    customerItems,
    combos,
    availableCombos,
    remainingStockByItemId,
    availableSessionDiscounts,
    total,
    categories,
    categoryFilter: appState.managerCategoryFilter,
    managerItems,
    sortedCatalog,
    discounts,
    managerRegisterStats,
    abuseSignalsByRegister,
    registerTierByRegister,
    registerTierCatalog: REGISTER_TIERS,
    activeRegisterTierLevel,
    activeRegisterTier,
    newStoreName: appState.newStoreName,
    newRegisterName: appState.newRegisterName,
    newItem: appState.newItem,
    newDiscount: appState.newDiscount,
    newCombo: appState.newCombo,
  };

  return (
    <RegisterContext.Provider value={{ state, actions }}>
      {children}
    </RegisterContext.Provider>
  );
}
