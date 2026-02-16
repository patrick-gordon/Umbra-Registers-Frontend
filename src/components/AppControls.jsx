import { useRegisterStore } from "../context/useRegisterStore";

export default function AppControls() {
  const { state, actions } = useRegisterStore();

  return (
    <div className="app-controls">
      <div className="app-view-tabs">
        {state.allowedViews.includes("employee") && (
          <button
            type="button"
            onClick={() => actions.setView("employee")}
            className={state.view === "employee" ? "is-active" : ""}
          >
            Employee
          </button>
        )}
        {state.allowedViews.includes("customer") && (
          <button
            type="button"
            onClick={() => actions.setView("customer")}
            className={state.view === "customer" ? "is-active" : ""}
          >
            Customer
          </button>
        )}
        {state.allowedViews.includes("manager") && (
          <button
            type="button"
            onClick={() => actions.setView("manager")}
            className={state.view === "manager" ? "is-active" : ""}
          >
            Manager
          </button>
        )}
        <button type="button" className="app-view-close-btn" onClick={actions.closeUi}>
          Close Panel
        </button>
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
        <div className="app-status app-status--error" role="alert">
          <span>
            NUI Error: <strong>{state.nuiError}</strong>
          </span>
          <button type="button" className="app-status-action" onClick={actions.clearNuiError}>
            Dismiss
          </button>
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
