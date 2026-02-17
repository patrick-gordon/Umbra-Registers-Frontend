import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CustomerView from "./CustomerView";
import EmployeeView from "./EmployeeView";
import { useRegisterStore } from "../context/useRegisterStore";

vi.mock("../context/useRegisterStore", () => ({
  useRegisterStore: vi.fn(),
}));

const mockedUseRegisterStore = vi.mocked(useRegisterStore);

const buildCustomerState = (winner = "employee") => ({
  activeStoreName: "Store 1",
  registerName: "Register 1",
  tray: [],
  total: 0,
  customerReceipt: null,
  minigameResult: {
    winner,
    customerScore: winner === "customer" ? 9 : 3,
    employeeScore: winner === "customer" ? 5 : 8,
  },
  session: {
    phase: "customer",
    isProcessing: false,
    stealMinigame: {
      winner: "",
    },
  },
});

const buildEmployeeState = (winner = "customer") => ({
  activeStoreName: "Store 1",
  registerName: "Register 1",
  customerItems: [],
  remainingStockByItemId: {},
  availableCombos: [],
  tray: [],
  total: 0,
  availableSessionDiscounts: [],
  minigameResult: {
    winner,
    customerScore: winner === "customer" ? 11 : 4,
    employeeScore: winner === "customer" ? 6 : 10,
  },
  activeRegisterTier: {
    level: 1,
    name: "Starter Terminal",
  },
  session: {
    phase: "customer",
    isRungUp: false,
    isProcessing: false,
    processingProgress: 0,
    processingError: "",
    selectedDiscountIds: [],
    stealMinigame: {
      winner: "",
    },
  },
});

describe("Minigame result visibility in views", () => {
  const onDismissMinigameResult = vi.fn();

  beforeEach(() => {
    onDismissMinigameResult.mockReset();
  });

  it("shows winner result in customer view and displays the winner", () => {
    mockedUseRegisterStore.mockReturnValue({
      state: buildCustomerState("employee"),
      actions: {
        onCustomerPay: vi.fn(),
        onCustomerSteal: vi.fn(),
        onStealMinigameTap: vi.fn(),
        onDismissCustomerReceipt: vi.fn(),
        onDismissMinigameResult,
      },
    });

    render(<CustomerView />);

    expect(screen.getByRole("heading", { name: "Food War Result" })).toBeInTheDocument();
    expect(screen.getByText("Employee Won The Minigame")).toBeInTheDocument();
    expect(screen.getByText("Employee Victory")).toBeInTheDocument();
    expect(screen.getByText("Winner")).toBeInTheDocument();
    expect(
      screen.getByText("Employee", { selector: ".minigame-result-winner-value" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(onDismissMinigameResult).toHaveBeenCalledTimes(1);
  });

  it("shows winner result in employee view and displays the winner", () => {
    mockedUseRegisterStore.mockReturnValue({
      state: buildEmployeeState("customer"),
      actions: {
        onToggleSessionDiscount: vi.fn(),
        onRingUp: vi.fn(),
        onConfirmCustomerActions: vi.fn(),
        onClearTransaction: vi.fn(),
        onStealMinigameTap: vi.fn(),
        onAddToTray: vi.fn(),
        onAddComboToTray: vi.fn(),
        onIncreaseTrayLine: vi.fn(),
        onDecreaseTrayItem: vi.fn(),
        onRemoveTrayItem: vi.fn(),
        onDismissProcessingError: vi.fn(),
        onDismissMinigameResult,
      },
    });

    render(<EmployeeView />);

    expect(screen.getByRole("heading", { name: "Food War Result" })).toBeInTheDocument();
    expect(screen.getByText("Customer Won The Minigame")).toBeInTheDocument();
    expect(screen.getByText("Customer Victory")).toBeInTheDocument();
    expect(screen.getByText("Winner")).toBeInTheDocument();
    expect(
      screen.getByText("Customer", { selector: ".minigame-result-winner-value" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(onDismissMinigameResult).toHaveBeenCalledTimes(1);
  });
});
