import { useRegisterStore } from "../context/RegisterContext";

export default function AppControls() {
  const { state, actions } = useRegisterStore();

  return (
    <div className="app-controls">
      <div className="app-controls-row">
        <label>
          Store
          <select
            value={state.activeStoreId}
            onChange={(e) => actions.onStoreChange(e.target.value)}
          >
            {state.stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="app-view-tabs">
        {state.allowedViews.includes("employee") && (
          <button
            onClick={() => actions.setView("employee")}
            className={state.view === "employee" ? "is-active" : ""}
          >
            Employee
          </button>
        )}
        {state.allowedViews.includes("customer") && (
          <button
            onClick={() => actions.setView("customer")}
            className={state.view === "customer" ? "is-active" : ""}
          >
            Customer
          </button>
        )}
        {state.allowedViews.includes("manager") && (
          <button
            onClick={() => actions.setView("manager")}
            className={state.view === "manager" ? "is-active" : ""}
          >
            Manager
          </button>
        )}
        <button onClick={actions.closeUi}>Close Panel</button>
      </div>

      {state.nuiPendingAction && (
        <div className="app-status">
          Syncing: <strong>{state.nuiPendingAction}</strong>
        </div>
      )}

      {state.lastNuiEvent && !state.nuiPendingAction && (
        <div className="app-status">
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
          <button onClick={actions.clearNuiError}>Close Error</button>
        </div>
      )}

      <div className="app-controls-row">
        <label>
          Register
          <select
            value={state.activeRegisterId}
            onChange={(e) => actions.onRegisterChange(e.target.value)}
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
        <div className="app-status">
          Interaction: <strong>{state.interactionContext.businessId}</strong> /{" "}
          <strong>{state.interactionContext.interactionId}</strong>
        </div>
      )}
    </div>
  );
}
