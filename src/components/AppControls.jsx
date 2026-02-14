import { useRegisterStore } from "../context/RegisterContext";

export default function AppControls() {
  const { state, actions } = useRegisterStore();

  return (
    <>
      <div style={{ marginBottom: 16, display: "flex", gap: 8, alignItems: "center" }}>
        <label>
          Active Store:
          <select
            value={state.activeStoreId}
            onChange={(e) => actions.onStoreChange(e.target.value)}
            style={{ marginLeft: 8 }}
          >
            {state.stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div style={{ marginBottom: 20, display: "flex", gap: 8 }}>
        {state.allowedViews.includes("employee") && (
          <button
            onClick={() => actions.setView("employee")}
            style={{ fontWeight: state.view === "employee" ? "bold" : "normal" }}
          >
            Employee View
          </button>
        )}
        {state.allowedViews.includes("customer") && (
          <button
            onClick={() => actions.setView("customer")}
            style={{ fontWeight: state.view === "customer" ? "bold" : "normal" }}
          >
            Customer View
          </button>
        )}
        {state.allowedViews.includes("manager") && (
          <button
            onClick={() => actions.setView("manager")}
            style={{ fontWeight: state.view === "manager" ? "bold" : "normal" }}
          >
            Manager View
          </button>
        )}
        <button onClick={actions.closeUi}>Close</button>
      </div>

      {state.nuiPendingAction && (
        <div style={{ marginBottom: 8 }}>
          Syncing: <strong>{state.nuiPendingAction}</strong>
        </div>
      )}

      {state.lastNuiEvent && !state.nuiPendingAction && (
        <div style={{ marginBottom: 8 }}>
          Last NUI event: <strong>{state.lastNuiEvent}</strong>
        </div>
      )}

      {state.nuiError && (
        <div
          style={{
            marginBottom: 12,
            padding: 8,
            border: "1px solid var(--umbra-accent)",
            borderRadius: 8,
            background: "rgba(234, 80, 31, 0.15)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span>NUI Error: {state.nuiError}</span>
          <button onClick={actions.clearNuiError}>Dismiss</button>
        </div>
      )}

      <div style={{ marginBottom: 16, display: "flex", gap: 8, alignItems: "center" }}>
        <label>
          Active Register:
          <select
            value={state.activeRegisterId}
            onChange={(e) => actions.onRegisterChange(e.target.value)}
            style={{ marginLeft: 8 }}
          >
            {state.registers.map((register) => (
              <option key={register.id} value={register.id}>
                {register.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {state.interactionContext && (
        <div style={{ marginBottom: 10 }}>
          Interaction: <strong>{state.interactionContext.businessId}</strong> /{" "}
          <strong>{state.interactionContext.interactionId}</strong>
        </div>
      )}
    </>
  );
}
