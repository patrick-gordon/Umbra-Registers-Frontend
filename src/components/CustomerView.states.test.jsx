import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CustomerView from "./CustomerView";
import { useRegisterStore } from "../context/useRegisterStore";

vi.mock("../context/useRegisterStore", () => ({
  useRegisterStore: vi.fn(),
}));

const mockedUseRegisterStore = vi.mocked(useRegisterStore);

function makeActions() {
  return {
    onCustomerPay: vi.fn(),
    onCustomerSteal: vi.fn(),
    onStealMinigameTap: vi.fn(),
    onDismissCustomerReceipt: vi.fn(),
    onDismissMinigameResult: vi.fn(),
  };
}

function makeBaseState(overrides = {}) {
  return {
    activeStoreName: "Store 1",
    registerName: "Register 1",
    tray: [],
    total: 0,
    customerReceipt: null,
    minigameResult: null,
    session: {
      phase: "customer",
      isProcessing: false,
      stealMinigame: {
        winner: "",
        endsAt: 0,
        customerScore: 0,
        employeeScore: 0,
      },
    },
    ...overrides,
  };
}

describe("CustomerView state branches", () => {
  it("renders checkout screen during customer phase", () => {
    mockedUseRegisterStore.mockReturnValue({
      state: makeBaseState({ session: { phase: "customer", isProcessing: false, stealMinigame: { winner: "" } } }),
      actions: makeActions(),
    });

    render(<CustomerView />);
    expect(screen.getByRole("heading", { name: "Customer Checkout" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pay" })).toBeInTheDocument();
  });

  it("shows discounted item pricing in customer checkout breakdown", () => {
    mockedUseRegisterStore.mockReturnValue({
      state: makeBaseState({
        total: 1.75,
        tray: [
          {
            id: "1",
            name: "Coffee",
            qty: 1,
            unitPrice: 1.75,
            basePrice: 3.5,
            lineType: "item",
          },
        ],
        session: { phase: "customer", isProcessing: false, stealMinigame: { winner: "" } },
      }),
      actions: makeActions(),
    });

    render(<CustomerView />);

    expect(screen.getByText("Discounted $3.50 -> $1.75 each")).toBeInTheDocument();
    expect(
      screen.getByText("$1.75", { selector: ".customer-order-row strong" }),
    ).toBeInTheDocument();
  });

  it("shows discounted combo pricing in customer checkout breakdown", () => {
    mockedUseRegisterStore.mockReturnValue({
      state: makeBaseState({
        total: 4.25,
        tray: [
          {
            id: "combo-breakfast",
            name: "Breakfast Combo",
            qty: 1,
            unitPrice: 4.25,
            basePrice: 8.5,
            lineType: "combo",
          },
        ],
        session: { phase: "customer", isProcessing: false, stealMinigame: { winner: "" } },
      }),
      actions: makeActions(),
    });

    render(<CustomerView />);

    expect(screen.getByText("Discounted $8.50 -> $4.25 each")).toBeInTheDocument();
    expect(
      screen.getByText("$4.25", { selector: ".customer-order-row strong" }),
    ).toBeInTheDocument();
  });

  it("renders steal minigame screen during stealMinigame phase", () => {
    mockedUseRegisterStore.mockReturnValue({
      state: makeBaseState({
        session: {
          phase: "stealMinigame",
          isProcessing: false,
          stealMinigame: {
            winner: "",
            endsAt: Date.now() + 5000,
            customerScore: 2,
            employeeScore: 3,
          },
        },
      }),
      actions: makeActions(),
    });

    render(<CustomerView />);
    expect(screen.getByRole("heading", { name: "Steal Minigame" })).toBeInTheDocument();
    expect(screen.getByText("Press E repeatedly to pull the bar to your side.")).toBeInTheDocument();
  });

  it("renders receipt view when receipt is available and customer phase is complete", () => {
    mockedUseRegisterStore.mockReturnValue({
      state: makeBaseState({
        session: {
          phase: "employee",
          isProcessing: false,
          stealMinigame: { winner: "" },
        },
        tray: [],
        customerReceipt: {
          id: "rcpt-1",
          storeName: "Store 1",
          registerName: "Register 1",
          paidAt: "2026-02-16T20:00:00.000Z",
          items: [{ id: "1", name: "Coffee", qty: 1, lineTotal: 3.5 }],
          itemCount: 1,
          total: 3.5,
        },
      }),
      actions: makeActions(),
    });

    render(<CustomerView />);
    expect(screen.getByRole("heading", { name: "Payment Complete" })).toBeInTheDocument();
    expect(screen.getByText("Total Paid: $3.50")).toBeInTheDocument();
  });

  it("renders empty state when no active customer flow content is available", () => {
    mockedUseRegisterStore.mockReturnValue({
      state: makeBaseState({
        session: {
          phase: "employee",
          isProcessing: false,
          stealMinigame: { winner: "" },
        },
        tray: [{ id: "1", qty: 1 }],
        customerReceipt: null,
      }),
      actions: makeActions(),
    });

    render(<CustomerView />);
    expect(screen.getByText("Welcome to Store 1")).toBeInTheDocument();
    expect(screen.getByText("Your order appears here once an employee starts the transaction.")).toBeInTheDocument();
  });
});
