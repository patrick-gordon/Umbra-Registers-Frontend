import { useRegisterStore } from "../context/RegisterContext";

export default function AppControls() {
  const { state, actions } = useRegisterStore();

  return (
    <div className="app-controls">
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

      {state.interactionContext && (
        <div className="app-status">
          Interaction: <strong>{state.interactionContext.businessId}</strong> /{" "}
          <strong>{state.interactionContext.interactionId}</strong>
        </div>
      )}
    </div>
  );
}
