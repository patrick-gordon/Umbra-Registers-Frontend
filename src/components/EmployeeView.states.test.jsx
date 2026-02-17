import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import EmployeeView from "./EmployeeView";
import { useRegisterStore } from "../context/useRegisterStore";

vi.mock("../context/useRegisterStore", () => ({
  useRegisterStore: vi.fn(),
}));

const mockedUseRegisterStore = vi.mocked(useRegisterStore);

function makeActions() {
  return {
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
    onDismissMinigameResult: vi.fn(),
  };
}

function makeBaseState(overrides = {}) {
  return {
    activeStoreName: "Store 1",
    registerName: "Register 1",
    customerItems: [],
    remainingStockByItemId: {},
    availableCombos: [],
    tray: [],
    total: 0,
    availableSessionDiscounts: [],
    minigameResult: null,
    activeRegisterTier: {
      level: 1,
      name: "Starter Terminal",
      autoDiscountAssist: false,
      employeeDefenseBonus: 0,
      instantStealBlockChance: 0,
    },
    session: {
      phase: "employee",
      isRungUp: false,
      isProcessing: false,
      processingProgress: 0,
      processingError: "",
      selectedDiscountIds: [],
      stealMinigame: {
        winner: "",
      },
    },
    ...overrides,
  };
}

describe("EmployeeView state branches", () => {
  it("shows discounted item pricing in employee order breakdown after ring up", () => {
    mockedUseRegisterStore.mockReturnValue({
      state: makeBaseState({
        total: 3.5,
        tray: [
          {
            id: "1",
            name: "Coffee",
            qty: 2,
            unitPrice: 1.75,
            basePrice: 3.5,
            lineType: "item",
          },
        ],
        session: {
          phase: "employee",
          isRungUp: true,
          isProcessing: false,
          processingProgress: 0,
          processingError: "",
          selectedDiscountIds: [],
          stealMinigame: { winner: "" },
        },
      }),
      actions: makeActions(),
    });

    render(<EmployeeView />);

    expect(screen.getByText("Discounted $3.50 -> $1.75 each")).toBeInTheDocument();
    expect(
      screen.getByText("$3.50", { selector: ".employee-line-total" }),
    ).toBeInTheDocument();
  });

  it("hides discounted item pricing in employee order breakdown before ring up", () => {
    mockedUseRegisterStore.mockReturnValue({
      state: makeBaseState({
        tray: [
          {
            id: "1",
            name: "Coffee",
            qty: 1,
            unitPrice: 3.5,
            basePrice: 3.5,
            lineType: "item",
          },
        ],
      }),
      actions: makeActions(),
    });

    render(<EmployeeView />);

    expect(
      screen.queryByText("Discounted $3.50 -> $1.75 each"),
    ).not.toBeInTheDocument();
  });

  it("shows discounted item pricing in employee order breakdown before ring up when pricing is already discounted", () => {
    mockedUseRegisterStore.mockReturnValue({
      state: makeBaseState({
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
      }),
      actions: makeActions(),
    });

    render(<EmployeeView />);

    expect(screen.getByText("Discounted $3.50 -> $1.75 each")).toBeInTheDocument();
  });

  it("shows discounted combo pricing in employee order breakdown", () => {
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
      }),
      actions: makeActions(),
    });

    render(<EmployeeView />);

    expect(screen.getByText("Combo")).toBeInTheDocument();
    expect(screen.getByText("Discounted $8.50 -> $4.25 each")).toBeInTheDocument();
    expect(
      screen.getByText("$4.25", { selector: ".employee-line-total" }),
    ).toBeInTheDocument();
  });
});
