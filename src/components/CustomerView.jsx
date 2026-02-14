import Tray from "./Tray";
import { useRegisterStore } from "../context/RegisterContext";

function CustomerActions({ total, onPay, onSteal }) {
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
      <h3>Customer Actions</h3>
      <p>Total due: ${total.toFixed(2)}</p>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onPay}>Pay Total Price</button>
        <button onClick={onSteal}>Steal Food</button>
      </div>
    </div>
  );
}

export default function CustomerView() {
  const { state, actions } = useRegisterStore();
  const noop = () => {};

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>
        {state.activeStoreName} - {state.registerName}
      </h2>

      {state.session.phase === "customer" ? (
        <CustomerActions
          total={state.total}
          onPay={actions.onCustomerPay}
          onSteal={actions.onCustomerSteal}
        />
      ) : (
        <p>Waiting for employee to ring up and confirm customer actions.</p>
      )}

      <Tray
        tray={state.tray}
        onAdd={noop}
        onDecrease={noop}
        onRemove={noop}
        controlsDisabled
        showCheckout={false}
      />
    </div>
  );
}
