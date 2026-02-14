import { createContext, useContext, useMemo, useReducer } from "react";
import {
  effectivePrice,
  isDiscountActive,
  mkSession,
  mkStore,
} from "../utils/registerUtils";

const RegisterContext = createContext(null);

const initialState = {
  view: "employee",
  stores: [mkStore("store-1", "Store 1")],
  activeStoreId: "store-1",
  activeRegisterId: "store-1-register-1",
  traysByRegister: { "store-1-register-1": [] },
  sessionsByRegister: { "store-1-register-1": mkSession() },
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
};

function reducer(state, action) {
  switch (action.type) {
    case "SET":
      return { ...state, [action.key]: action.value };
    case "PATCH":
      return { ...state, ...action.payload };
    default:
      return state;
  }
}

export function RegisterProvider({ children }) {
  const [appState, dispatch] = useReducer(reducer, initialState);

  const activeStore =
    appState.stores.find((store) => store.id === appState.activeStoreId) ?? appState.stores[0];
  const catalog = activeStore?.catalog ?? [];
  const discounts = activeStore?.discounts ?? [];
  const registers = activeStore?.registers ?? [];
  const tray = appState.traysByRegister[appState.activeRegisterId] ?? [];
  const session = appState.sessionsByRegister[appState.activeRegisterId] ?? mkSession();
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

  const setStateValue = (key, value) => dispatch({ type: "SET", key, value });
  const patchState = (payload) => dispatch({ type: "PATCH", payload });

  const setActiveStore = (updater) => {
    const nextStores = appState.stores.map((store) =>
      store.id === activeStore.id ? updater(store) : store,
    );
    setStateValue("stores", nextStores);
  };

  const setSession = (registerId, updater) => {
    const nextSessions = {
      ...appState.sessionsByRegister,
      [registerId]: updater(appState.sessionsByRegister[registerId] ?? mkSession()),
    };
    setStateValue("sessionsByRegister", nextSessions);
  };

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

  const actions = {
    setView: (value) => setStateValue("view", value),
    onStoreChange: (storeId) => {
      const store = appState.stores.find((candidate) => candidate.id === storeId);
      if (!store) return;
      patchState({
        activeStoreId: store.id,
        activeRegisterId: store.registers[0].id,
        managerCategoryFilter: "All Categories",
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

    onAddStore: () => {
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
        activeStoreId: id,
        activeRegisterId: firstRegisterId,
        managerCategoryFilter: "All Categories",
        newStoreName: "",
      });
    },

    onRemoveStore: (id) => {
      if (appState.stores.length <= 1) return;
      const removed = appState.stores.find((store) => store.id === id);
      if (!removed) return;
      const nextStores = appState.stores.filter((store) => store.id !== id);
      const nextTrays = { ...appState.traysByRegister };
      const nextSessions = { ...appState.sessionsByRegister };
      removed.registers.forEach((register) => {
        delete nextTrays[register.id];
        delete nextSessions[register.id];
      });
      patchState({
        stores: nextStores,
        traysByRegister: nextTrays,
        sessionsByRegister: nextSessions,
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
        activeRegisterId: id,
        newRegisterName: "",
      });
    },

    onRemoveRegister: (id) => {
      if (registers.length <= 1) return;
      const nextRegisters = registers.filter((register) => register.id !== id);
      setActiveStore((store) => ({ ...store, registers: nextRegisters }));
      const nextTrays = { ...appState.traysByRegister };
      const nextSessions = { ...appState.sessionsByRegister };
      delete nextTrays[id];
      delete nextSessions[id];
      patchState({
        traysByRegister: nextTrays,
        sessionsByRegister: nextSessions,
        ...(appState.activeRegisterId === id
          ? { activeRegisterId: nextRegisters[0].id }
          : {}),
      });
    },

    onAddToTray: (id) => {
      if (session.phase !== "employee") return;
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
      }));
    },

    onDecreaseTrayItem: (id) => {
      if (session.phase !== "employee") return;
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
      }));
    },

    onRemoveTrayItem: (id) => {
      if (session.phase !== "employee") return;
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
      }));
    },

    onRingUp: () => {
      if (!tray.length || session.phase !== "employee") return;
      const nextSession = { ...session, isRungUp: true };
      const selected = discounts.filter(
        (discount) =>
          nextSession.selectedDiscountIds.includes(discount.id) &&
          isDiscountActive(discount),
      );
      const nextTray = (appState.traysByRegister[appState.activeRegisterId] ?? []).map(
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
          [appState.activeRegisterId]: nextSession,
        },
        traysByRegister: {
          ...appState.traysByRegister,
          [appState.activeRegisterId]: nextTray,
        },
      });
    },

    onToggleSessionDiscount: (id) => {
      if (session.phase !== "employee") return;
      setSession(appState.activeRegisterId, (currentSession) => ({
        ...currentSession,
        isRungUp: false,
        selectedDiscountIds: currentSession.selectedDiscountIds.includes(id)
          ? currentSession.selectedDiscountIds.filter((discountId) => discountId !== id)
          : [...currentSession.selectedDiscountIds, id],
      }));
    },

    onConfirmCustomerActions: () => {
      if (!session.isRungUp || session.phase !== "employee") return;
      setSession(appState.activeRegisterId, (currentSession) => ({
        ...currentSession,
        phase: "customer",
      }));
    },

    onCustomerPay: () => {
      if (session.phase !== "customer") return;
      playPaymentChime();
      patchState({
        traysByRegister: { ...appState.traysByRegister, [appState.activeRegisterId]: [] },
        sessionsByRegister: {
          ...appState.sessionsByRegister,
          [appState.activeRegisterId]: mkSession(),
        },
      });
    },

    onCustomerSteal: () => {
      if (session.phase !== "customer") return;
      patchState({
        traysByRegister: { ...appState.traysByRegister, [appState.activeRegisterId]: [] },
        sessionsByRegister: {
          ...appState.sessionsByRegister,
          [appState.activeRegisterId]: mkSession(),
        },
      });
    },

    onUpdateItem: (id, field, raw) => {
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
      const name = appState.newItem.name.trim();
      const price = Number(appState.newItem.price);
      const stock = Number(appState.newItem.stock);
      const sortOrder = Number(appState.newItem.sortOrder);
      const category = appState.newItem.category.trim() || "Uncategorized";
      if (
        !name ||
        Number.isNaN(price) ||
        price < 0 ||
        !Number.isInteger(stock) ||
        stock < 0 ||
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
      const itemIds = appState.newDiscount.itemIds.includes(itemId)
        ? appState.newDiscount.itemIds.filter((id) => id !== itemId)
        : [...appState.newDiscount.itemIds, itemId];
      setStateValue("newDiscount", { ...appState.newDiscount, itemIds });
    },

    onAddDiscount: () => {
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
      const nextDiscounts = discounts.filter((discount) => discount.id !== id);
      setActiveStore((store) => ({ ...store, discounts: nextDiscounts }));
      syncStoreTrays(activeStore.id, catalog, nextDiscounts);
    },
  };

  const state = {
    stores: appState.stores,
    storesCount: appState.stores.length,
    activeStoreId: activeStore?.id ?? "",
    activeStoreName: activeStore?.name ?? "",
    registers,
    activeRegisterId: appState.activeRegisterId,
    registerName,
    view: appState.view,
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
