import ItemGrid from "./ItemGrid";
import Tray from "./Tray";
import { useRegisterStore } from "../context/RegisterContext";

function EmployeeActions({
  availableSessionDiscounts,
  selectedDiscountIds,
  onToggleDiscount,
  onRingUp,
  onConfirm,
  hasTrayItems,
  canConfirm,
}) {
  return (
    <div
      style={{
        border: "1px solid var(--umbra-border)",
        borderRadius: 8,
        padding: 12,
        marginBottom: 16,
        background: "var(--umbra-surface-2)",
      }}
    >
      <h3>Employee Actions</h3>
      <p>Place items in tray, select discounts, Ring It Up, then confirm customer actions.</p>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
        {availableSessionDiscounts.length === 0 && (
          <span>No available discounts for this tray.</span>
        )}
        {availableSessionDiscounts.map((discount) => (
          <label key={discount.id} style={{ display: "flex", gap: 4 }}>
            <input
              type="checkbox"
              checked={selectedDiscountIds.includes(discount.id)}
              onChange={() => onToggleDiscount(discount.id)}
            />
            {discount.name}
          </label>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onRingUp} disabled={!hasTrayItems}>
          Ring It Up
        </button>
        <button onClick={onConfirm} disabled={!canConfirm}>
          Confirm & Enable Customer Actions
        </button>
      </div>
    </div>
  );
}

export default function EmployeeView() {
  const { state, actions } = useRegisterStore();

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>
        {state.activeStoreName} - {state.registerName}
      </h2>

      <EmployeeActions
        availableSessionDiscounts={state.availableSessionDiscounts}
        selectedDiscountIds={state.session.selectedDiscountIds}
        onToggleDiscount={actions.onToggleSessionDiscount}
        onRingUp={actions.onRingUp}
        onConfirm={actions.onConfirmCustomerActions}
        hasTrayItems={state.tray.length > 0}
        canConfirm={state.session.isRungUp}
      />

      {state.session.phase === "customer" && (
        <p style={{ marginBottom: 12 }}>
          Customer actions are enabled. Switch to Customer View for payment or steal.
        </p>
      )}

      <div style={{ display: "flex", gap: 40 }}>
        <ItemGrid
          items={state.customerItems}
          tray={state.tray}
          onAdd={actions.onAddToTray}
          disabled={state.session.phase !== "employee"}
        />
        <Tray
          tray={state.tray}
          onAdd={actions.onAddToTray}
          onDecrease={actions.onDecreaseTrayItem}
          onRemove={actions.onRemoveTrayItem}
          controlsDisabled={state.session.phase !== "employee"}
          showCheckout={false}
        />
      </div>
    </div>
  );
}
