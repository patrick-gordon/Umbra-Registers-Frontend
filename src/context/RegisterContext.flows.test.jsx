import { act } from "react";
import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RegisterProvider } from "./RegisterContext";
import { useRegisterStore } from "./useRegisterStore";
import { postNui } from "../utils/fivemNui";

vi.mock("../utils/fivemNui", () => ({
  isFiveM: () => false,
  onNuiMessage: () => () => {},
  postNui: vi.fn(() => Promise.resolve({ ok: true, data: null })),
}));

const postNuiMock = vi.mocked(postNui);

function createStoreHarness() {
  const wrapper = ({ children }) => (
    <RegisterProvider>{children}</RegisterProvider>
  );
  const hook = renderHook(() => useRegisterStore(), { wrapper });

  return {
    getState: () => hook.result.current.state,
    getActions: () => hook.result.current.actions,
  };
}

function addDiscountForItem(harness, {
  name = "Promo",
  discountType = "percentage",
  discountValue = 50,
  itemId = "1",
  applyToAllItems = false,
} = {}) {
  act(() => {
    harness.getActions().onNewDiscountChange("name", name);
  });
  act(() => {
    harness.getActions().onNewDiscountChange("discountType", discountType);
  });
  act(() => {
    harness.getActions().onNewDiscountChange("discountValue", String(discountValue));
  });
  act(() => {
    harness.getActions().onNewDiscountChange("applyToAllItems", applyToAllItems);
  });
  if (!applyToAllItems) {
    act(() => {
      harness.getActions().onToggleNewDiscountItem(itemId);
    });
  }
  act(() => {
    harness.getActions().onAddDiscount();
  });

  const createdDiscount = harness
    .getState()
    .discounts.find((discount) => discount.name === name);
  expect(createdDiscount).toBeTruthy();
  return createdDiscount;
}

async function ringUpToCustomerPhase(harness) {
  act(() => {
    harness.getActions().onAddToTray("1");
  });

  const processingMs = harness.getState().activeRegisterTier.processingMs;
  act(() => {
    harness.getActions().onRingUp();
  });
  expect(harness.getState().session.isProcessing).toBe(true);

  act(() => {
    vi.advanceTimersByTime(processingMs + 10);
  });
  await act(async () => {});

  expect(harness.getState().session.isRungUp).toBe(true);
  act(() => {
    harness.getActions().onConfirmCustomerActions();
  });
  expect(harness.getState().session.phase).toBe("customer");
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(Math, "random").mockReturnValue(0.99);
  postNuiMock.mockClear();
  postNuiMock.mockResolvedValue({ ok: true, data: null });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("Register flow coverage", () => {
  it("completes employee ring-up and transitions to customer phase", async () => {
    const harness = createStoreHarness();

    await ringUpToCustomerPhase(harness);

    const session = harness.getState().session;
    expect(session.phase).toBe("customer");
    expect(session.isRungUp).toBe(true);
    expect(session.processingError).toBe("");
  });

  it("handles a jam and allows a successful re-ring", async () => {
    const harness = createStoreHarness();

    act(() => {
      harness.getActions().onAddToTray("1");
    });

    Math.random.mockReturnValue(0.0);
    const processingMs = harness.getState().activeRegisterTier.processingMs;
    act(() => {
      harness.getActions().onRingUp();
    });
    act(() => {
      vi.advanceTimersByTime(processingMs + 10);
    });
    await act(async () => {});

    expect(harness.getState().session.isRungUp).toBe(false);
    expect(harness.getState().session.processingError).toContain("jam");

    Math.random.mockReturnValue(0.99);
    act(() => {
      harness.getActions().onRingUp();
    });
    act(() => {
      vi.advanceTimersByTime(processingMs + 10);
    });
    await act(async () => {});

    expect(harness.getState().session.isRungUp).toBe(true);
    expect(harness.getState().session.processingError).toBe("");
  });

  it("keeps employee in edit mode when ring-up inventory validation fails", async () => {
    const harness = createStoreHarness();

    act(() => {
      harness.getActions().onAddToTray("1");
    });

    postNuiMock.mockResolvedValueOnce({
      ok: true,
      data: {
        ok: false,
        error: {
          code: "INSUFFICIENT_STOCK",
          message: "Inventory validation failed.",
          details: {
            missingItems: ["Coffee Beans"],
            insufficientQty: [{ name: "Bagel", required: 2, available: 1 }],
            comboInvalid: ["combo-breakfast"],
          },
        },
      },
    });

    const processingMs = harness.getState().activeRegisterTier.processingMs;
    act(() => {
      harness.getActions().onRingUp();
    });
    act(() => {
      vi.advanceTimersByTime(processingMs + 10);
    });
    await act(async () => {});
    await act(async () => {});

    const state = harness.getState();
    expect(state.session.phase).toBe("employee");
    expect(state.session.isRungUp).toBe(false);
    expect(state.session.processingError).toContain("Inventory validation failed.");
    expect(state.session.processingError).toContain("Missing items");
    expect(state.session.processingError).toContain("Insufficient quantities");
    expect(state.session.processingError).toContain("Invalid combos");
  });

  it("uses server-authoritative tray totals returned from ring-up", async () => {
    const harness = createStoreHarness();

    act(() => {
      harness.getActions().onAddToTray("1");
    });

    postNuiMock.mockResolvedValueOnce({
      ok: true,
      data: {
        ok: true,
        data: {
          tray: [
            {
              id: "1",
              lineType: "item",
              itemId: "1",
              name: "Coffee",
              qty: 1,
              basePrice: 3.5,
              unitPrice: 2.25,
            },
          ],
          selectedDiscountIds: [],
        },
      },
    });

    const processingMs = harness.getState().activeRegisterTier.processingMs;
    act(() => {
      harness.getActions().onRingUp();
    });
    act(() => {
      vi.advanceTimersByTime(processingMs + 10);
    });
    await act(async () => {});

    const state = harness.getState();
    const coffeeLine = state.tray.find((line) => line.id === "1");
    expect(state.session.isRungUp).toBe(true);
    expect(coffeeLine).toBeTruthy();
    expect(coffeeLine.unitPrice).toBeCloseTo(2.25, 2);
    expect(state.total).toBeCloseTo(2.25, 2);
  });

  it("finalizes payment and resets the register session", async () => {
    const harness = createStoreHarness();
    await ringUpToCustomerPhase(harness);

    const totalBeforePay = harness.getState().total;
    act(() => {
      harness.getActions().onCustomerPay();
    });
    await act(async () => {});

    const state = harness.getState();
    const stats = state.managerRegisterStats.find(
      (row) => row.registerId === state.activeRegisterId,
    );

    expect(state.tray).toHaveLength(0);
    expect(state.session.phase).toBe("employee");
    expect(state.customerReceipt).toBeTruthy();
    expect(state.customerReceipt.total).toBe(totalBeforePay);
    expect(stats.paidTransactions).toBe(1);
    expect(stats.totalTransactions).toBe(1);

    const customerPaidCall = postNuiMock.mock.calls.find(
      ([eventName]) => eventName === "customerPaid",
    );
    expect(customerPaidCall).toBeTruthy();
    const customerPaidPayload = customerPaidCall[1];
    expect(customerPaidPayload.receiptId).toBeTruthy();
    expect(customerPaidPayload.receipt).toBeTruthy();
    expect(customerPaidPayload.receipt.id).toBe(customerPaidPayload.receiptId);
    expect(customerPaidPayload.receipt.items.length).toBeGreaterThan(0);
  });

  it("runs steal minigame and resolves with employee defense win", async () => {
    const harness = createStoreHarness();
    await ringUpToCustomerPhase(harness);

    act(() => {
      harness.getActions().onCustomerSteal();
    });
    expect(harness.getState().session.phase).toBe("stealMinigame");

    act(() => {
      for (let i = 0; i < 3; i += 1) harness.getActions().onStealMinigameTap("customer");
      for (let i = 0; i < 5; i += 1) harness.getActions().onStealMinigameTap("employee");
    });
    act(() => {
      harness.getActions().onResolveStealMinigame();
    });

    const state = harness.getState();
    const stats = state.managerRegisterStats.find(
      (row) => row.registerId === state.activeRegisterId,
    );

    expect(state.session.phase).toBe("customer");
    expect(state.session.stealMinigame.winner).toBe("employee");
    expect(state.minigameResult).toMatchObject({
      winner: "employee",
      customerScore: 3,
      employeeScore: 5,
    });
    expect(stats.blockedStealAttempts).toBe(1);
    expect(stats.stealAttempts).toBe(1);

    act(() => {
      harness.getActions().onDismissMinigameResult();
    });
    expect(harness.getState().minigameResult).toBeNull();
  });

  it("resolves steal minigame to customer win and clears the transaction", async () => {
    const harness = createStoreHarness();
    await ringUpToCustomerPhase(harness);

    act(() => {
      harness.getActions().onCustomerSteal();
    });
    expect(harness.getState().session.phase).toBe("stealMinigame");

    act(() => {
      for (let i = 0; i < 7; i += 1) harness.getActions().onStealMinigameTap("customer");
      for (let i = 0; i < 2; i += 1) harness.getActions().onStealMinigameTap("employee");
    });
    act(() => {
      harness.getActions().onResolveStealMinigame();
    });

    const state = harness.getState();
    const stats = state.managerRegisterStats.find(
      (row) => row.registerId === state.activeRegisterId,
    );

    expect(state.session.phase).toBe("employee");
    expect(state.tray).toHaveLength(0);
    expect(state.customerReceipt).toBeNull();
    expect(state.minigameResult).toMatchObject({
      winner: "customer",
      customerScore: 7,
      employeeScore: 2,
    });
    expect(stats.stolenTransactions).toBe(1);
    expect(stats.totalTransactions).toBe(1);
  });

  it("supports concurrent customer and employee taps in the minigame", async () => {
    const harness = createStoreHarness();
    await ringUpToCustomerPhase(harness);

    act(() => {
      harness.getActions().onCustomerSteal();
    });
    expect(harness.getState().session.phase).toBe("stealMinigame");

    const customerTaps = 41;
    const employeeTaps = 37;
    const actions = harness.getActions();
    await act(async () => {
      await Promise.all([
        ...Array.from({ length: customerTaps }, () =>
          Promise.resolve().then(() => actions.onStealMinigameTap("customer")),
        ),
        ...Array.from({ length: employeeTaps }, () =>
          Promise.resolve().then(() => actions.onStealMinigameTap("employee")),
        ),
      ]);
    });

    const duringGame = harness.getState().session.stealMinigame;
    expect(duringGame.customerScore).toBe(customerTaps);
    expect(duringGame.employeeScore).toBe(employeeTaps);

    act(() => {
      harness.getActions().onResolveStealMinigame();
    });

    const finalState = harness.getState();
    const stats = finalState.managerRegisterStats.find(
      (row) => row.registerId === finalState.activeRegisterId,
    );
    expect(finalState.session.phase).toBe("employee");
    expect(stats.stolenTransactions).toBe(1);
  });

  it("applies selected percentage discounts to ring-up totals and keeps discounted amount through payment", async () => {
    const harness = createStoreHarness();
    const discount = addDiscountForItem(harness, {
      name: "Government Employee 50%",
      discountType: "percentage",
      discountValue: 50,
      itemId: "1",
    });

    act(() => {
      harness.getActions().onAddToTray("1");
    });
    expect(
      harness.getState().availableSessionDiscounts.some((entry) => entry.id === discount.id),
    ).toBe(true);

    act(() => {
      harness.getActions().onToggleSessionDiscount(discount.id);
    });
    expect(harness.getState().session.selectedDiscountIds).toContain(discount.id);

    const processingMs = harness.getState().activeRegisterTier.processingMs;
    act(() => {
      harness.getActions().onRingUp();
    });
    act(() => {
      vi.advanceTimersByTime(processingMs + 10);
    });
    await act(async () => {});

    const rungUpState = harness.getState();
    const coffeeLine = rungUpState.tray.find((line) => line.id === "1");
    expect(coffeeLine).toBeTruthy();
    expect(coffeeLine.unitPrice).toBeCloseTo(1.75, 2);
    expect(rungUpState.total).toBeCloseTo(1.75, 2);

    act(() => {
      harness.getActions().onConfirmCustomerActions();
    });
    act(() => {
      harness.getActions().onCustomerPay();
    });
    await act(async () => {});

    expect(harness.getState().customerReceipt).toBeTruthy();
    expect(harness.getState().customerReceipt.total).toBeCloseTo(1.75, 2);
  });

  it("auto-selects eligible percentage discounts at tier 3 and applies reduced pricing on ring-up", async () => {
    const harness = createStoreHarness();
    const discount = addDiscountForItem(harness, {
      name: "Auto Government 50%",
      discountType: "percentage",
      discountValue: 50,
      itemId: "1",
    });

    const registerId = harness.getState().activeRegisterId;
    act(() => {
      harness.getActions().onUpgradeRegisterTier(registerId);
    });
    act(() => {
      harness.getActions().onUpgradeRegisterTier(registerId);
    });
    expect(harness.getState().activeRegisterTierLevel).toBe(3);

    act(() => {
      harness.getActions().onAddToTray("1");
    });

    const processingMs = harness.getState().activeRegisterTier.processingMs;
    act(() => {
      harness.getActions().onRingUp();
    });
    act(() => {
      vi.advanceTimersByTime(processingMs + 10);
    });
    await act(async () => {});

    const state = harness.getState();
    expect(state.session.selectedDiscountIds).toContain(discount.id);
    const coffeeLine = state.tray.find((line) => line.id === "1");
    expect(coffeeLine.unitPrice).toBeCloseTo(1.75, 2);
    expect(state.total).toBeCloseTo(1.75, 2);
  });

  it("allows manager to create an order-wide 50% discount and employee can select it", async () => {
    const harness = createStoreHarness();

    act(() => {
      harness.getActions().onNewDiscountChange("name", "Government 50% Order");
    });
    act(() => {
      harness.getActions().onNewDiscountChange("discountType", "percentage");
    });
    act(() => {
      harness.getActions().onNewDiscountChange("discountValue", "50");
    });
    act(() => {
      harness.getActions().onNewDiscountChange("applyToAllItems", true);
    });
    act(() => {
      harness.getActions().onAddDiscount();
    });

    const createdDiscount = harness
      .getState()
      .discounts.find((discount) => discount.name === "Government 50% Order");
    expect(createdDiscount).toBeTruthy();
    expect(createdDiscount.applyToAllItems).toBe(true);

    act(() => {
      harness.getActions().onAddToTray("1");
    });
    expect(
      harness
        .getState()
        .availableSessionDiscounts.some((discount) => discount.id === createdDiscount.id),
    ).toBe(true);

    act(() => {
      harness.getActions().onToggleSessionDiscount(createdDiscount.id);
    });
    act(() => {
      harness.getActions().onRingUp();
    });
    const processingMs = harness.getState().activeRegisterTier.processingMs;
    act(() => {
      vi.advanceTimersByTime(processingMs + 10);
    });
    await act(async () => {});

    expect(harness.getState().total).toBeCloseTo(1.75, 2);
  });

  it("allows manager to update a discount weekday schedule from dropdown presets", () => {
    const harness = createStoreHarness();

    act(() => {
      harness.getActions().onNewDiscountChange("name", "Weekday Government Discount");
    });
    act(() => {
      harness.getActions().onNewDiscountChange("discountType", "percentage");
    });
    act(() => {
      harness.getActions().onNewDiscountChange("discountValue", "50");
    });
    act(() => {
      harness.getActions().onNewDiscountChange("applyToAllItems", true);
    });
    act(() => {
      harness.getActions().onAddDiscount();
    });

    const createdDiscount = harness
      .getState()
      .discounts.find((discount) => discount.name === "Weekday Government Discount");
    expect(createdDiscount).toBeTruthy();

    act(() => {
      harness
        .getActions()
        .onUpdateDiscount(createdDiscount.id, "weekdays", [1, 2, 3, 4, 5]);
    });

    const updatedDiscount = harness
      .getState()
      .discounts.find((discount) => discount.id === createdDiscount.id);
    expect(updatedDiscount.weekdays).toEqual([1, 2, 3, 4, 5]);

    act(() => {
      harness.getActions().onUpdateDiscount(createdDiscount.id, "weekdays", []);
    });

    const resetDiscount = harness
      .getState()
      .discounts.find((discount) => discount.id === createdDiscount.id);
    expect(resetDiscount.weekdays).toEqual([]);
  });

  it("supports forever discounts without requiring future end dates", async () => {
    const harness = createStoreHarness();

    act(() => {
      harness.getActions().onNewDiscountChange("name", "Forever 50%");
    });
    act(() => {
      harness.getActions().onNewDiscountChange("discountType", "percentage");
    });
    act(() => {
      harness.getActions().onNewDiscountChange("discountValue", "50");
    });
    act(() => {
      harness.getActions().onNewDiscountChange("applyToAllItems", true);
    });
    act(() => {
      harness.getActions().onNewDiscountChange("startDate", "2099-01-01");
    });
    act(() => {
      harness.getActions().onNewDiscountChange("endDate", "2099-12-31");
    });
    act(() => {
      harness.getActions().onNewDiscountChange("isForever", true);
    });
    act(() => {
      harness.getActions().onAddDiscount();
    });

    const createdDiscount = harness
      .getState()
      .discounts.find((discount) => discount.name === "Forever 50%");
    expect(createdDiscount).toBeTruthy();
    expect(createdDiscount.isForever).toBe(true);
    expect(createdDiscount.startDate).toBe("");
    expect(createdDiscount.endDate).toBe("");

    act(() => {
      harness.getActions().onAddToTray("1");
    });

    expect(
      harness
        .getState()
        .availableSessionDiscounts.some((discount) => discount.id === createdDiscount.id),
    ).toBe(true);

    act(() => {
      harness.getActions().onToggleSessionDiscount(createdDiscount.id);
    });
    act(() => {
      harness.getActions().onRingUp();
    });
    const processingMs = harness.getState().activeRegisterTier.processingMs;
    act(() => {
      vi.advanceTimersByTime(processingMs + 10);
    });
    await act(async () => {});

    expect(harness.getState().total).toBeCloseTo(1.75, 2);
  });

  it("updates tray total immediately when employee selects or clears a discount", () => {
    const harness = createStoreHarness();
    const discount = addDiscountForItem(harness, {
      name: "Immediate 50%",
      discountType: "percentage",
      discountValue: 50,
      itemId: "1",
    });

    act(() => {
      harness.getActions().onAddToTray("1");
    });
    expect(harness.getState().total).toBeCloseTo(3.5, 2);

    act(() => {
      harness.getActions().onToggleSessionDiscount(discount.id);
    });
    expect(harness.getState().session.selectedDiscountIds).toContain(discount.id);
    expect(harness.getState().total).toBeCloseTo(1.75, 2);

    act(() => {
      harness.getActions().onToggleSessionDiscount(discount.id);
    });
    expect(harness.getState().session.selectedDiscountIds).not.toContain(discount.id);
    expect(harness.getState().total).toBeCloseTo(3.5, 2);
  });

  it("applies selected discounts to combo meals and keeps discounted combo totals through customer view", async () => {
    const harness = createStoreHarness();
    const discount = addDiscountForItem(harness, {
      name: "Combo 50%",
      discountType: "percentage",
      discountValue: 50,
      applyToAllItems: true,
    });

    act(() => {
      harness.getActions().onAddComboToTray("combo-breakfast");
    });
    expect(harness.getState().total).toBeCloseTo(8.5, 2);

    act(() => {
      harness.getActions().onToggleSessionDiscount(discount.id);
    });
    expect(harness.getState().total).toBeCloseTo(4.25, 2);

    const processingMs = harness.getState().activeRegisterTier.processingMs;
    act(() => {
      harness.getActions().onRingUp();
    });
    act(() => {
      vi.advanceTimersByTime(processingMs + 10);
    });
    await act(async () => {});

    const rungUpState = harness.getState();
    const comboLine = rungUpState.tray.find((line) => line.lineType === "combo");
    expect(comboLine).toBeTruthy();
    expect(comboLine.basePrice).toBeCloseTo(8.5, 2);
    expect(comboLine.unitPrice).toBeCloseTo(4.25, 2);
    expect(rungUpState.total).toBeCloseTo(4.25, 2);

    act(() => {
      harness.getActions().onConfirmCustomerActions();
    });
    expect(harness.getState().session.phase).toBe("customer");
    expect(harness.getState().total).toBeCloseTo(4.25, 2);
  });
});
