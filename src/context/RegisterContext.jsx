import { createContext, useContext, useEffect, useMemo, useReducer } from "react";
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

const RegisterContext = createContext(null);

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
  managerCategoryFilter: "All Categories",
  newStoreName: "",
  newRegisterName: "",
  newItem: { name: "", price: "", stock: "", sortOrder: "", category: "" },
  newDiscount: {
    name: "",
    discountPrice: "",
    startDate: "",
    endDate: "",
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
    default:
      return state;
  }
}

export function RegisterProvider({ children }) {
  const [appState, dispatch] = useReducer(reducer, undefined, createInitialState);

  const activeStore =
    appState.stores.find((store) => store.id === appState.activeStoreId) ?? appState.stores[0];
  const catalog = activeStore?.catalog ?? [];
  const discounts = activeStore?.discounts ?? [];
  const registers = activeStore?.registers ?? [];
  const tray = appState.traysByRegister[appState.activeRegisterId] ?? [];
  const session = appState.sessionsByRegister[appState.activeRegisterId] ?? mkSession();
  const registerStatsByRegister = appState.registerStatsByRegister ?? {};
  const registerTierByRegister = appState.registerTierByRegister ?? {};
  const activeRegisterTierLevel = registerTierByRegister[appState.activeRegisterId] ?? 1;
  const activeRegisterTier = getRegisterTier(activeRegisterTierLevel);
  const registerName =
    registers.find((register) => register.id === appState.activeRegisterId)?.name ??
    "Register";

  const selectedDiscounts = useMemo(
    () =>
      discounts.filter(
        (discount) =>
          session.selectedDiscountIds.includes(discount.id) &&
          isDiscountActive(discount),
      ),
    [discounts, session.selectedDiscountIds],
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
          ? effectivePrice(item.id, item.price, selectedDiscounts)
          : item.price;
        return { ...item, effectivePrice: price, hasDiscount: price < item.price };
      }),
    [sortedCatalog, session.isRungUp, selectedDiscounts],
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
    const trayItemIds = new Set(tray.map((item) => item.id));
    return discounts.filter(
      (discount) =>
        isDiscountActive(discount) &&
        discount.itemIds.some((itemId) => trayItemIds.has(itemId)),
    );
  }, [discounts, tray]);

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
          ...stats,
          theftRate,
          avgTicket,
        };
      }),
    [registers, registerStatsByRegister, registerTierByRegister],
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

  const completeCustomerPaid = (registerId, amount, itemsInTransaction, meta = {}) => {
    const completedAt = new Date().toISOString();
    patchState({
      traysByRegister: { ...appState.traysByRegister, [registerId]: [] },
      sessionsByRegister: {
        ...appState.sessionsByRegister,
        [registerId]: mkSession(),
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
    patchState({
      traysByRegister: { ...appState.traysByRegister, [registerId]: [] },
      sessionsByRegister: {
        ...appState.sessionsByRegister,
        [registerId]: mkSession(),
      },
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
    const itemsInTransaction = (appState.traysByRegister[registerId] ?? []).reduce(
      (sum, trayItem) => sum + trayItem.qty,
      0,
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

  // Recomputes tray prices/qty after manager changes (prices, stock, discounts) or session updates.
  // This keeps frontend totals deterministic with currently selected discounts.
  const syncStoreTrays = (
    storeId,
    nextCatalog,
    nextDiscounts,
    sessions = appState.sessionsByRegister,
  ) => {
    const store = appState.stores.find((candidate) => candidate.id === storeId);
    if (!store) return;

    const registerIds = store.registers.map((register) => register.id);
    const nextTrays = { ...appState.traysByRegister };

    registerIds.forEach((registerId) => {
      const currentSession = sessions[registerId] ?? mkSession();
      const sessionDiscounts = nextDiscounts.filter(
        (discount) =>
          currentSession.selectedDiscountIds.includes(discount.id) &&
          isDiscountActive(discount),
      );

      nextTrays[registerId] = (appState.traysByRegister[registerId] ?? [])
        .map((trayItem) => {
          const item = nextCatalog.find((catalogItem) => catalogItem.id === trayItem.id);
          if (!item) return null;

          const qty = Math.min(trayItem.qty, item.stock);
          if (qty <= 0) return null;

          return {
            ...trayItem,
            name: item.name,
            basePrice: item.price,
            unitPrice: currentSession.isRungUp
              ? effectivePrice(item.id, item.price, sessionDiscounts)
              : item.price,
            qty,
          };
        })
        .filter(Boolean);
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
    } catch {}
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
    } catch {}
  };

  // Standardized outbound NUI call wrapper so every action gets consistent pending/error UI.
  const sendNuiEvent = async (eventName, payload) => {
    setStateValue("nuiPendingAction", eventName);
    setStateValue("nuiError", "");
    const response = await postNui(eventName, payload);
    if (!response.ok) {
      setStateValue("nuiError", response.error?.message ?? "NUI callback failed");
    }
    setStateValue("lastNuiEvent", eventName);
    setStateValue("nuiPendingAction", "");
    return response;
  };

  const isManager = hasOrganizationAccess && appState.currentRole === "manager";
  const canUseEmployeeActions =
    hasOrganizationAccess &&
    (appState.currentRole === "manager" || appState.currentRole === "employee");

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
    onSelectRegister: (value) => setStateValue("activeRegisterId", value),
    onUpgradeRegisterTier: (registerId) => {
      if (!isManager) return;
      const currentLevel = registerTierByRegister[registerId] ?? 1;
      if (currentLevel >= MAX_REGISTER_TIER) return;
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
      removed.registers.forEach((register) => {
        delete nextTrays[register.id];
        delete nextSessions[register.id];
        delete nextRegisterTiers[register.id];
        delete nextRegisterStats[register.id];
      });
      patchState({
        stores: nextStores,
        traysByRegister: nextTrays,
        sessionsByRegister: nextSessions,
        registerTierByRegister: nextRegisterTiers,
        registerStatsByRegister: nextRegisterStats,
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
      delete nextTrays[id];
      delete nextSessions[id];
      delete nextRegisterTiers[id];
      delete nextRegisterStats[id];
      patchState({
        traysByRegister: nextTrays,
        sessionsByRegister: nextSessions,
        registerTierByRegister: nextRegisterTiers,
        registerStatsByRegister: nextRegisterStats,
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
      const existing = currentTray.find((trayItem) => trayItem.id === id);
      const qty = existing?.qty ?? 0;
      if (qty >= item.stock) return;

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
              name: item.name,
              basePrice: item.price,
              unitPrice: item.price,
              qty: 1,
            },
          ];

      setStateValue("traysByRegister", {
        ...appState.traysByRegister,
        [appState.activeRegisterId]: nextTray,
      });
      setSession(appState.activeRegisterId, (currentSession) => ({
        ...currentSession,
        isRungUp: false,
        processingError: "",
      }));
    },

    onDecreaseTrayItem: (id) => {
      if (!canUseEmployeeActions || session.phase !== "employee" || session.isProcessing)
        return;
      const nextTray = (appState.traysByRegister[appState.activeRegisterId] ?? [])
        .map((trayItem) =>
          trayItem.id === id ? { ...trayItem, qty: trayItem.qty - 1 } : trayItem,
        )
        .filter((trayItem) => trayItem.qty > 0);

      setStateValue("traysByRegister", {
        ...appState.traysByRegister,
        [appState.activeRegisterId]: nextTray,
      });
      setSession(appState.activeRegisterId, (currentSession) => ({
        ...currentSession,
        isRungUp: false,
        processingError: "",
      }));
    },

    onRemoveTrayItem: (id) => {
      if (!canUseEmployeeActions || session.phase !== "employee" || session.isProcessing)
        return;
      const nextTray = (appState.traysByRegister[appState.activeRegisterId] ?? []).filter(
        (trayItem) => trayItem.id !== id,
      );

      setStateValue("traysByRegister", {
        ...appState.traysByRegister,
        [appState.activeRegisterId]: nextTray,
      });
      setSession(appState.activeRegisterId, (currentSession) => ({
        ...currentSession,
        isRungUp: false,
        processingError: "",
      }));
    },

    onClearTransaction: () => {
      if (!canUseEmployeeActions) return;
      if (session.phase === "stealMinigame" || session.isProcessing) return;
      patchState({
        traysByRegister: { ...appState.traysByRegister, [appState.activeRegisterId]: [] },
        sessionsByRegister: {
          ...appState.sessionsByRegister,
          [appState.activeRegisterId]: mkSession(),
        },
      });
    },

    onRingUp: () => {
      if (!canUseEmployeeActions || !tray.length || session.phase !== "employee") return;
      if (session.isProcessing) return;
      const registerId = appState.activeRegisterId;
      const tierLevel = registerTierByRegister[registerId] ?? 1;
      const tier = getRegisterTier(tierLevel);
      const processingMs = tier.processingMs;
      const trayItemIds = new Set(tray.map((trayItem) => trayItem.id));
      const autoDiscountIds = tier.autoDiscountAssist
        ? discounts
            .filter(
              (discount) =>
                isDiscountActive(discount) &&
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
      const selected = discounts.filter(
        (discount) =>
          nextSession.selectedDiscountIds.includes(discount.id) &&
          isDiscountActive(discount),
      );
      const nextTray = (appState.traysByRegister[registerId] ?? []).map(
        (trayItem) => {
          const item = catalog.find((catalogItem) => catalogItem.id === trayItem.id);
          if (!item) return trayItem;
          return {
            ...trayItem,
            basePrice: item.price,
            unitPrice: effectivePrice(item.id, item.price, selected),
          };
        },
      );
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
      const itemsInTransaction = tray.reduce((sum, trayItem) => sum + trayItem.qty, 0);
      playPaymentChime();
      completeCustomerPaid(registerId, total, itemsInTransaction);
    },

    // Starts a minigame instead of immediately completing the theft.
    onCustomerSteal: () => {
      if (session.phase !== "customer") return;
      if (session.stealMinigame?.active) return;
      if (session.stealMinigame?.winner === "employee") return;
      const registerId = appState.activeRegisterId;
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
      syncStoreTrays(activeStore.id, nextCatalog, discounts);
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
      syncStoreTrays(activeStore.id, nextCatalog, discounts);
    },

    onRemoveMenuItem: (id) => {
      if (!isManager) return;
      const nextCatalog = catalog.filter((item) => item.id !== id);
      const nextDiscounts = discounts.map((discount) => ({
        ...discount,
        itemIds: discount.itemIds.filter((itemId) => itemId !== id),
      }));
      setActiveStore((store) => ({ ...store, catalog: nextCatalog, discounts: nextDiscounts }));
      const nextTrays = { ...appState.traysByRegister };
      registers.forEach((register) => {
        nextTrays[register.id] = (nextTrays[register.id] ?? []).filter(
          (trayItem) => trayItem.id !== id,
        );
      });
      setStateValue("traysByRegister", nextTrays);
    },

    onToggleNewDiscountItem: (itemId) => {
      if (!isManager) return;
      const itemIds = appState.newDiscount.itemIds.includes(itemId)
        ? appState.newDiscount.itemIds.filter((id) => id !== itemId)
        : [...appState.newDiscount.itemIds, itemId];
      setStateValue("newDiscount", { ...appState.newDiscount, itemIds });
    },

    onAddDiscount: () => {
      if (!isManager) return;
      const name = appState.newDiscount.name.trim();
      const discountPrice = Number(appState.newDiscount.discountPrice);
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
      const id = `d-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const nextDiscounts = [
        ...discounts,
        {
          id,
          name,
          discountPrice,
          startDate: appState.newDiscount.startDate,
          endDate: appState.newDiscount.endDate,
          itemIds: appState.newDiscount.itemIds,
        },
      ];
      setActiveStore((store) => ({ ...store, discounts: nextDiscounts }));
      setStateValue("newDiscount", {
        name: "",
        discountPrice: "",
        startDate: "",
        endDate: "",
        itemIds: [],
      });
      syncStoreTrays(activeStore.id, catalog, nextDiscounts);
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
        if (field === "startDate") return { ...discount, startDate: raw };
        if (field === "endDate") return { ...discount, endDate: raw };
        return discount;
      });
      setActiveStore((store) => ({ ...store, discounts: nextDiscounts }));
      syncStoreTrays(activeStore.id, catalog, nextDiscounts);
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
      syncStoreTrays(activeStore.id, catalog, nextDiscounts);
    },

    onRemoveDiscount: (id) => {
      if (!isManager) return;
      const nextDiscounts = discounts.filter((discount) => discount.id !== id);
      setActiveStore((store) => ({ ...store, discounts: nextDiscounts }));
      syncStoreTrays(activeStore.id, catalog, nextDiscounts);
    },
  };

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
          if (payload.currentRole) safe.currentRole = payload.currentRole;
          if (payload.view) safe.view = payload.view;
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
      actions.closeUi();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [appState.uiVisible]);

  useEffect(() => {
    const minigame = session.stealMinigame;
    if (session.phase !== "stealMinigame" || !minigame?.active) return;
    const msLeft = minigame.endsAt - Date.now();
    if (msLeft <= 0) {
      resolveStealMinigame(appState.activeRegisterId);
      return;
    }
    const timeoutId = window.setTimeout(() => {
      resolveStealMinigame(appState.activeRegisterId);
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
    allowedViews,
    uiVisible: appState.uiVisible,
    nuiPendingAction: appState.nuiPendingAction,
    nuiError: appState.nuiError,
    lastNuiEvent: appState.lastNuiEvent,
    interactionContext: appState.interactionContext,
    businessInteractions,
    session,
    tray,
    customerItems,
    availableSessionDiscounts,
    total,
    categories,
    categoryFilter: appState.managerCategoryFilter,
    managerItems,
    sortedCatalog,
    discounts,
    managerRegisterStats,
    registerTierByRegister,
    registerTierCatalog: REGISTER_TIERS,
    activeRegisterTierLevel,
    activeRegisterTier,
    newStoreName: appState.newStoreName,
    newRegisterName: appState.newRegisterName,
    newItem: appState.newItem,
    newDiscount: appState.newDiscount,
  };

  return (
    <RegisterContext.Provider value={{ state, actions }}>
      {children}
    </RegisterContext.Provider>
  );
}

export function useRegisterStore() {
  const context = useContext(RegisterContext);
  if (!context) {
    throw new Error("useRegisterStore must be used within RegisterProvider");
  }
  return context;
}
